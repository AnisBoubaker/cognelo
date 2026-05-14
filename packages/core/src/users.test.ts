import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    update: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma
}));

const { updateMyProfile } = await import("./users");

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
});
