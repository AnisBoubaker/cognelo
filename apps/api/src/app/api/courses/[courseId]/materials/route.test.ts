import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMaterial: vi.fn(),
  listMaterials: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createMaterial: mocks.createMaterial,
  listMaterials: mocks.listMaterials
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");

describe("course materials route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.listMaterials.mockResolvedValue([{ id: "material-1" }]);
    mocks.readJson.mockResolvedValue({ title: "Repository", kind: "github_repo", url: "https://github.com/example/repo" });
    mocks.createMaterial.mockResolvedValue({ id: "material-1" });
  });

  it("lists and creates course materials for the selected course", async () => {
    await expect(
      (
        await GET(new Request("http://test.local") as never, { params: Promise.resolve({ courseId: "course-1" }) })
      ).json()
    ).resolves.toEqual({ materials: [{ id: "material-1" }] });

    const createResponse = await POST(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1" })
    });

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({ material: { id: "material-1" } });
    expect(mocks.listMaterials).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1");
    expect(mocks.createMaterial).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      { title: "Repository", kind: "github_repo", url: "https://github.com/example/repo" }
    );
  });
});
