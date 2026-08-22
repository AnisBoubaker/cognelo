import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  emailDeliveryConfiguration: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  user: {
    findFirst: vi.fn()
  },
  courseGroupParticipant: {
    findFirst: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma }));

const {
  assertEligibleSystemRecipient,
  getEmailDeliveryConfiguration,
  sendEmailDeliveryTest,
  updateEmailDeliveryConfiguration
} = await import("./email-delivery");

const encryptionKey = "11".repeat(32);
const now = new Date("2026-08-22T12:00:00.000Z");
const admin = {
  id: "admin-1",
  email: "admin@cognelo.test",
  name: null,
  firstName: "Admin",
  lastName: "User",
  roles: ["admin" as const]
};
const teacher = { ...admin, id: "teacher-1", roles: ["teacher" as const] };

describe("email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.emailDeliveryConfiguration.findUnique.mockResolvedValue(null);
    mockPrisma.emailDeliveryConfiguration.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      ...create,
      createdAt: now,
      updatedAt: now
    }));
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue(null);
  });

  it("keeps email delivery configuration admin-only", async () => {
    await expect(getEmailDeliveryConfiguration(teacher)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(mockPrisma.emailDeliveryConfiguration.findUnique).not.toHaveBeenCalled();
  });

  it("encrypts SMTP passwords and never returns them", async () => {
    const result = await updateEmailDeliveryConfiguration(admin, {
      transport: "smtp",
      fromName: "Cognelo Registrar",
      fromEmail: "Notify@Cognelo.org",
      smtpHost: "smtp.example.test",
      smtpPort: 587,
      smtpSecurity: "starttls",
      smtpUsername: "mailer",
      smtpPassword: "smtp-secret"
    }, encryptionKey);

    const create = mockPrisma.emailDeliveryConfiguration.upsert.mock.calls[0][0].create;
    expect(create.smtpPasswordEncrypted).not.toContain("smtp-secret");
    expect(create.fromEmail).toBe("notify@cognelo.org");
    expect(result).toMatchObject({ configured: true, hasSmtpPassword: true, smtpUsername: "mailer" });
    expect(result).not.toHaveProperty("smtpPasswordEncrypted");
  });

  it("allows the admin test message to target any valid address", async () => {
    mockPrisma.emailDeliveryConfiguration.findUnique.mockResolvedValue({
      id: "global",
      transport: "smtp",
      fromName: "Cognelo",
      fromEmail: "notify@cognelo.org",
      smtpHost: "smtp.example.test",
      smtpPort: 587,
      smtpSecurity: "starttls",
      smtpUsername: null,
      smtpPasswordEncrypted: null,
      graphTenantId: null,
      graphClientId: null,
      graphClientSecretEncrypted: null,
      updatedById: "admin-1",
      createdAt: now,
      updatedAt: now
    });
    const sendMail = vi.fn().mockResolvedValue({ messageId: "test-1" });
    const createTransport = vi.fn(() => ({ sendMail }));

    await expect(sendEmailDeliveryTest(admin, { recipientEmail: "Outside@Example.net" }, encryptionKey, {
      createTransport: createTransport as never
    })).resolves.toEqual({ ok: true });

    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.courseGroupParticipant.findFirst).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "outside@example.net" }));
  });

  it("rejects a future system recipient who is neither active nor activating", async () => {
    await expect(assertEligibleSystemRecipient("unknown@example.net")).rejects.toMatchObject({
      status: 400,
      code: "EMAIL_RECIPIENT_NOT_ELIGIBLE"
    });

    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1" });
    await expect(assertEligibleSystemRecipient("pending@example.net")).resolves.toBeUndefined();
  });

  it("sends through Microsoft Graph with OAuth client credentials", async () => {
    await updateEmailDeliveryConfiguration(admin, {
      transport: "microsoft_graph",
      fromName: "Cognelo Registrar",
      fromEmail: "notify@institution.test",
      graphTenantId: "tenant-id",
      graphClientId: "client-id",
      graphClientSecret: "graph-secret"
    }, encryptionKey);
    const created = mockPrisma.emailDeliveryConfiguration.upsert.mock.calls[0][0].create;
    mockPrisma.emailDeliveryConfiguration.findUnique.mockResolvedValue({ ...created, createdAt: now, updatedAt: now });
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: "access-token" }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));

    await expect(sendEmailDeliveryTest(admin, { recipientEmail: "student@gmail.com" }, encryptionKey, {
      fetch: fetchImplementation as typeof fetch
    })).resolves.toEqual({ ok: true });

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      "https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      "https://graph.microsoft.com/v1.0/users/notify%40institution.test/sendMail",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" })
      })
    );
    const sendRequest = fetchImplementation.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(sendRequest.body))).toMatchObject({
      message: { toRecipients: [{ emailAddress: { address: "student@gmail.com" } }] },
      saveToSentItems: true
    });
  });
});
