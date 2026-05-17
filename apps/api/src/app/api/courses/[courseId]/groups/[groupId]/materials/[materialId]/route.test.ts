import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteGroupMaterial: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateGroupMaterial: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  deleteGroupMaterial: mocks.deleteGroupMaterial,
  updateGroupMaterial: mocks.updateGroupMaterial
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { DELETE, PATCH } = await import("./route");

describe("group material detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ title: "Updated group material" });
    mocks.updateGroupMaterial.mockResolvedValue({ id: "material-1", title: "Updated group material" });
    mocks.deleteGroupMaterial.mockResolvedValue({ ok: true });
  });

  it("updates group materials", async () => {
    const response = await PATCH(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", groupId: "group-1", materialId: "material-1" })
    });

    await expect(response.json()).resolves.toEqual({ material: { id: "material-1", title: "Updated group material" } });
    expect(mocks.updateGroupMaterial).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "group-1",
      "material-1",
      { title: "Updated group material" }
    );
  });

  it("deletes group materials", async () => {
    const response = await DELETE(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", groupId: "group-1", materialId: "material-1" })
    });

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.deleteGroupMaterial).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "group-1",
      "material-1"
    );
  });
});
