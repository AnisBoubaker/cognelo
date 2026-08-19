import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  role: { findMany: vi.fn() }
}));

const bcryptMocks = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma
}));

vi.mock("bcryptjs", () => ({
  default: bcryptMocks
}));

const { changeMyPassword, createUser, listUsers, resetUserPassword, updateMyProfile, updateUser } = await import("./users");

const admin = { id: "admin-1", email: "admin@example.test", name: "Admin", firstName: "Ada", lastName: "Admin", roles: ["admin" as const] };

describe("user services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trims names and returns the public current-user shape", async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "ada@example.test",
      name: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      roles: [{ role: { key: "teacher" } }]
    });

    await expect(
      updateMyProfile(
        {
          id: "user-1",
          email: "ada@example.test",
          name: null,
          firstName: null,
          lastName: null,
          roles: ["teacher"]
        },
        { firstName: " Ada ", lastName: " Lovelace " }
      )
    ).resolves.toEqual({
      id: "user-1",
      email: "ada@example.test",
      name: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      roles: ["teacher"]
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: {
          firstName: "Ada",
          lastName: "Lovelace",
          name: "Ada Lovelace"
        }
      })
    );
  });

  it("changes the password after verifying the current password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: true, passwordHash: "old-hash" });
    bcryptMocks.compare.mockResolvedValue(true);
    bcryptMocks.hash.mockResolvedValue("new-hash");
    mockPrisma.user.update.mockResolvedValue({ id: "user-1" });

    await expect(
      changeMyPassword(
        { id: "user-1", email: "ada@example.test", name: "Ada", firstName: "Ada", lastName: "", roles: ["teacher"] },
        {
          currentPassword: "OldPassword123!",
          newPassword: "NewPassword456!",
          confirmNewPassword: "NewPassword456!"
        }
      )
    ).resolves.toEqual({ ok: true });

    expect(bcryptMocks.compare).toHaveBeenCalledWith("OldPassword123!", "old-hash");
    expect(bcryptMocks.hash).toHaveBeenCalledWith("NewPassword456!", 12);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-hash", mustChangePassword: false }
    });
  });

  it("lets an administrator set a temporary password and invalidate existing sessions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    bcryptMocks.hash.mockResolvedValue("temporary-hash");
    mockPrisma.user.update.mockResolvedValue({ id: "user-1" });

    await expect(resetUserPassword(admin, "user-1", {
      password: "Temporary123!",
      confirmPassword: "Temporary123!"
    })).resolves.toEqual({ ok: true });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "temporary-hash",
        mustChangePassword: true,
        authVersion: { increment: 1 }
      }
    });
  });

  it("does not let an administrator reset their own password", async () => {
    await expect(resetUserPassword(admin, admin.id, {
      password: "Temporary123!",
      confirmPassword: "Temporary123!"
    })).rejects.toMatchObject({ code: "CANNOT_RESET_OWN_PASSWORD", status: 400 });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password without updating the account", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: true, passwordHash: "old-hash" });
    bcryptMocks.compare.mockResolvedValue(false);

    await expect(
      changeMyPassword(
        { id: "user-1", email: "ada@example.test", name: "Ada", firstName: "Ada", lastName: "", roles: ["teacher"] },
        {
          currentPassword: "WrongPassword123!",
          newPassword: "NewPassword456!",
          confirmNewPassword: "NewPassword456!"
        }
      )
    ).rejects.toMatchObject({ code: "CURRENT_PASSWORD_INCORRECT", status: 400 });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("requires admin access to list users", async () => {
    await expect(listUsers({ ...admin, roles: ["teacher"] }, {})).rejects.toMatchObject({ status: 403 });
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("builds case-insensitive user filters and returns role summaries", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "user-1", email: "ada@example.test", firstName: "Ada", lastName: "Lovelace", name: "Ada Lovelace", isActive: true, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"), roles: [{ role: { key: "teacher", name: "Teacher" } }] }]);
    mockPrisma.user.count.mockResolvedValue(31);
    await expect(listUsers(admin, { role: "teacher", firstName: "ad", email: "example", page: 2, pageSize: 10 })).resolves.toEqual({ users: [expect.objectContaining({ id: "user-1", roles: [{ key: "teacher", name: "Teacher" }] })], pagination: { page: 2, pageSize: 10, total: 31, totalPages: 4 } });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ roles: { some: { role: { key: "teacher" } } }, firstName: { contains: "ad", mode: "insensitive" }, email: { contains: "example", mode: "insensitive" } }), skip: 10, take: 10 }));
  });

  it("creates an active user with all selected roles", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.role.findMany.mockResolvedValue([{ id: "role-teacher", key: "teacher", name: "Teacher" }, { id: "role-student", key: "student", name: "Student" }]);
    bcryptMocks.hash.mockResolvedValue("password-hash");
    mockPrisma.user.create.mockResolvedValue({ id: "user-2", email: "new@example.test", firstName: "New", lastName: "User", name: "New User", isActive: true, createdAt: new Date(), updatedAt: new Date(), roles: [{ role: { key: "teacher", name: "Teacher" } }, { role: { key: "student", name: "Student" } }] });
    await createUser(admin, { email: "NEW@example.test", firstName: "New", lastName: "User", password: "Password123!", roles: ["teacher", "student"] });
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "new@example.test", passwordHash: "password-hash", roles: { create: [{ roleId: "role-teacher" }, { roleId: "role-student" }] } }) }));
  });

  it("does not let an administrator remove their own admin role", async () => {
    await expect(updateUser(admin, admin.id, { email: admin.email, firstName: "Ada", lastName: "Admin", roles: ["teacher"] })).rejects.toMatchObject({ code: "CANNOT_REMOVE_OWN_ADMIN_ROLE" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
