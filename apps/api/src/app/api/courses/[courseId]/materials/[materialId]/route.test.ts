import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMaterial: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateMaterial: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  deleteMaterial: mocks.deleteMaterial,
  updateMaterial: mocks.updateMaterial
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { DELETE, PATCH } = await import("./route");

describe("course material detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ title: "Updated material" });
    mocks.updateMaterial.mockResolvedValue({ id: "material-1", title: "Updated material" });
    mocks.deleteMaterial.mockResolvedValue({ ok: true });
  });

  it("updates course materials", async () => {
    const response = await PATCH(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", materialId: "material-1" })
    });

    await expect(response.json()).resolves.toEqual({ material: { id: "material-1", title: "Updated material" } });
    expect(mocks.updateMaterial).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", "material-1", {
      title: "Updated material"
    });
  });

  it("deletes course materials", async () => {
    const response = await DELETE(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", materialId: "material-1" })
    });

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.deleteMaterial).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", "material-1");
  });
});
