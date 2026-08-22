import bcrypt from "bcryptjs";
import { describe, expect, it, vi, beforeEach } from "vitest";

const tx = vi.hoisted(() => ({
  courseGroupParticipant: {
    updateMany: vi.fn()
  },
  courseMembership: {
    upsert: vi.fn()
  },
  role: {
    findUnique: vi.fn()
  },
  user: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn()
  },
  userRole: {
    upsert: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  courseGroupParticipant: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  user: {
    findUnique: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma
}));

const { activatePendingAccount, loginWithPassword, verifyAuthToken } = await import("./auth");

const secret = "unit-test-secret";
const activeUser = {
  id: "user-1",
  email: "teacher@example.test",
  name: "Ada Teacher",
  firstName: "Ada",
  lastName: "Teacher",
  isActive: true,
  authVersion: 0,
  mustChangePassword: false,
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  passwordHash: "",
  roles: [{ role: { key: "teacher" } }]
};

describe("auth services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
  });

  it("rejects wrong passwords and unknown emails", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...activeUser,
      passwordHash: await bcrypt.hash("right-password", 4)
    });

    await expect(loginWithPassword("teacher@example.test", "wrong-password", secret)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED"
    });

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValueOnce(null);

    await expect(loginWithPassword("missing@example.test", "password", secret)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED"
    });
  });

  it("returns the pending setup error for emails already added to groups", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1" });

    await expect(loginWithPassword("student@example.test", "password", secret)).rejects.toMatchObject({
      status: 403,
      code: "PENDING_ACCOUNT_SETUP"
    });
  });

  it("signs in valid users and verifies the resulting token", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...activeUser,
      passwordHash: await bcrypt.hash("Password123!", 4)
    });

    const result = await loginWithPassword("Teacher@Example.Test", "Password123!", secret);

    expect(result.user).toMatchObject({ id: "user-1", email: "teacher@example.test", roles: ["teacher"], emailVerified: true });

    mockPrisma.user.findUnique.mockResolvedValueOnce(activeUser);
    await expect(verifyAuthToken(result.token, secret)).resolves.toMatchObject({
      id: "user-1",
      email: "teacher@example.test",
      roles: ["teacher"]
    });
  });

  it("returns an email-verification requirement for a new account", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...activeUser,
      emailVerifiedAt: null,
      passwordHash: await bcrypt.hash("Password123!", 4)
    });

    const result = await loginWithPassword("teacher@example.test", "Password123!", secret);
    expect(result.user.emailVerified).toBe(false);
  });

  it("returns the forced-change state and rejects tokens issued before an administrator reset", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...activeUser,
      authVersion: 2,
      mustChangePassword: true,
      passwordHash: await bcrypt.hash("Temporary123!", 4)
    });

    const result = await loginWithPassword("teacher@example.test", "Temporary123!", secret);
    expect(result.user.mustChangePassword).toBe(true);

    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...activeUser, authVersion: 3 });
    await expect(verifyAuthToken(result.token, secret)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("rejects missing, invalid, wrong-secret, and inactive-user tokens", async () => {
    await expect(verifyAuthToken(undefined, secret)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    await expect(verifyAuthToken("not-a-token", secret)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...activeUser,
      passwordHash: await bcrypt.hash("Password123!", 4)
    });
    const { token } = await loginWithPassword("teacher@example.test", "Password123!", secret);

    await expect(verifyAuthToken(token, "different-secret")).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });

    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...activeUser, isActive: false });
    await expect(verifyAuthToken(token, secret)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("rejects invalid activation requests", async () => {
    await expect(
      activatePendingAccount(
        {
          email: "student@example.test",
          password: "Password123!",
          confirmPassword: "Different123!"
        },
        secret
      )
    ).rejects.toThrow();

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "existing-user" });
    await expect(
      activatePendingAccount(
        {
          email: "student@example.test",
          password: "Password123!",
          confirmPassword: "Password123!"
        },
        secret
      )
    ).rejects.toMatchObject({ status: 409, code: "ACCOUNT_ALREADY_EXISTS" });

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.courseGroupParticipant.findMany.mockResolvedValueOnce([]);
    await expect(
      activatePendingAccount(
        {
          email: "student@example.test",
          password: "Password123!",
          confirmPassword: "Password123!"
        },
        secret
      )
    ).rejects.toMatchObject({ status: 403, code: "ACCOUNT_ACTIVATION_NOT_ALLOWED" });
  });

  it("activates pending participants and creates the highest course memberships", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.courseGroupParticipant.findMany.mockResolvedValue([
      {
        id: "participant-1",
        email: "student@example.test",
        firstName: "Student",
        lastName: "One",
        role: "student",
        group: { courseId: "course-1" }
      },
      {
        id: "participant-2",
        email: "student@example.test",
        firstName: "Student",
        lastName: "One",
        role: "ta",
        group: { courseId: "course-1" }
      }
    ]);
    tx.user.create.mockResolvedValue({
      id: "student-1",
      email: "student@example.test",
      name: "Student One",
      roles: []
    });
    tx.role.findUnique.mockResolvedValue({ id: "role-student", key: "student" });
    tx.user.findUniqueOrThrow.mockResolvedValue({
      id: "student-1",
      email: "student@example.test",
      name: "Student One",
      firstName: "Student",
      lastName: "One",
      roles: [{ role: { key: "student" } }]
    });

    await activatePendingAccount(
      {
        email: "student@example.test",
        password: "Password123!",
        confirmPassword: "Password123!"
      },
      secret
    );

    expect(tx.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_roleId: { userId: "student-1", roleId: "role-student" } }
      })
    );
    expect(tx.courseMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseId_userId_role: { courseId: "course-1", userId: "student-1", role: "ta" } }
      })
    );
    expect(tx.courseGroupParticipant.updateMany).toHaveBeenCalledWith({
      where: { email: "student@example.test", userId: null },
      data: { userId: "student-1" }
    });
  });
});
