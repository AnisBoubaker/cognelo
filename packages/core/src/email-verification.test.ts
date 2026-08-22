import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  emailVerificationChallenge: {
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn()
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma }));

const { requestEmailVerification, verifyEmailAddress } = await import("./email-verification");

const encryptionKey = "33".repeat(32);
const now = new Date("2026-08-22T16:00:00.000Z");
const user = {
  id: "user-1",
  email: "student@example.test",
  name: "Student",
  firstName: "Student",
  lastName: "One",
  roles: ["student" as const],
  emailVerified: false
};

describe("email verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      email: user.email,
      emailVerifiedAt: null,
      isActive: true
    });
    mockPrisma.emailVerificationChallenge.findUnique.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue({ id: user.id });
    mockPrisma.emailVerificationChallenge.delete.mockResolvedValue({ userId: user.id });
  });

  it("sends a six-digit code and stores only its keyed hash", async () => {
    const deliver = vi.fn().mockResolvedValue({ ok: true });

    await expect(requestEmailVerification(user, { locale: "en" }, encryptionKey, {
      now: () => now,
      generateCode: () => "042731",
      deliver
    })).resolves.toEqual({ required: true, sent: true, retryAfterSeconds: 60, expiresInSeconds: 600 });

    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: user.email,
      text: expect.stringContaining("042731")
    }), encryptionKey);
    const create = mockPrisma.emailVerificationChallenge.upsert.mock.calls[0][0].create;
    expect(create.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(create.codeHash).not.toContain("042731");
    expect(create.expiresAt).toEqual(new Date(now.getTime() + 10 * 60 * 1000));
  });

  it.each([
    ["en", "Verify your Cognelo email address", "Your Cognelo verification code is:", 'lang="en" dir="ltr"'],
    ["fr", "Vérifiez votre adresse courriel Cognelo", "Votre code de vérification Cognelo est :", 'lang="fr" dir="ltr"'],
    ["zh", "验证您的 Cognelo 电子邮件地址", "您的 Cognelo 验证码是：", 'lang="zh" dir="ltr"'],
    ["ar", "تحقق من عنوان بريدك الإلكتروني في Cognelo", "رمز التحقق الخاص بك في Cognelo هو:", 'lang="ar" dir="rtl"']
  ] as const)("renders the verification message in %s", async (locale, subject, intro, languageAttributes) => {
    const deliver = vi.fn().mockResolvedValue({ ok: true });

    await requestEmailVerification(user, { locale }, encryptionKey, {
      now: () => now,
      generateCode: () => "654321",
      deliver
    });

    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      subject,
      text: expect.stringContaining(`${intro}\n\n654321`),
      html: expect.stringContaining(languageAttributes)
    }), encryptionKey);
  });

  it("does not send again during the resend cooldown", async () => {
    mockPrisma.emailVerificationChallenge.findUnique.mockResolvedValue({
      userId: user.id,
      sentAt: new Date(now.getTime() - 15_000),
      expiresAt: new Date(now.getTime() + 500_000)
    });
    const deliver = vi.fn();

    await expect(requestEmailVerification(user, { locale: "en" }, encryptionKey, { now: () => now, deliver })).resolves.toEqual({
      required: true,
      sent: false,
      retryAfterSeconds: 45,
      expiresInSeconds: 500
    });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("verifies the matching code and deletes its challenge", async () => {
    await requestEmailVerification(user, { locale: "en" }, encryptionKey, {
      now: () => now,
      generateCode: () => "123456",
      deliver: vi.fn().mockResolvedValue({ ok: true })
    });
    const challengeData = mockPrisma.emailVerificationChallenge.upsert.mock.calls[0][0].create;
    mockPrisma.emailVerificationChallenge.findUnique.mockResolvedValue(challengeData);

    await expect(verifyEmailAddress(user, { code: "123456" }, encryptionKey, { now: () => now })).resolves.toEqual({ verified: true });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { emailVerifiedAt: now }
    });
    expect(mockPrisma.emailVerificationChallenge.delete).toHaveBeenCalledWith({ where: { userId: user.id } });
  });

  it("counts incorrect codes and locks the challenge after five failures", async () => {
    mockPrisma.emailVerificationChallenge.update.mockResolvedValue({ failedAttempts: 5 });
    mockPrisma.emailVerificationChallenge.findUnique.mockResolvedValue({
      userId: user.id,
      codeHash: "00".repeat(32),
      expiresAt: new Date(now.getTime() + 60_000),
      sentAt: now,
      failedAttempts: 4
    });

    await expect(verifyEmailAddress(user, { code: "111111" }, encryptionKey, { now: () => now })).rejects.toMatchObject({
      status: 429,
      code: "EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED"
    });
    expect(mockPrisma.emailVerificationChallenge.update).toHaveBeenCalledWith({
      where: { userId: user.id },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true }
    });
  });

  it("removes expired challenges and requires a new code", async () => {
    mockPrisma.emailVerificationChallenge.findUnique.mockResolvedValue({
      userId: user.id,
      codeHash: "00".repeat(32),
      expiresAt: new Date(now.getTime() - 1),
      sentAt: new Date(now.getTime() - 60_000),
      failedAttempts: 0
    });

    await expect(verifyEmailAddress(user, { code: "111111" }, encryptionKey, { now: () => now })).rejects.toMatchObject({
      status: 400,
      code: "EMAIL_VERIFICATION_CODE_EXPIRED"
    });
    expect(mockPrisma.emailVerificationChallenge.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id } });
  });
});
