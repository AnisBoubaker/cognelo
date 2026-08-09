import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
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

const { changeMyPassword, updateMyProfile } = await import("./users");

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
      data: { passwordHash: "new-hash" }
    });
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
});
