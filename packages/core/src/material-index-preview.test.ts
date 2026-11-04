import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), resource: vi.fn(), index: vi.fn() }));
vi.mock("@cognelo/db", () => ({ prisma: { contentMaterialIndex: { findFirst: mocks.index } }, Prisma: {} }));
vi.mock("./authorization", () => ({ assertCanManageCourse: mocks.authorize, assertCanViewCourse: vi.fn() }));
vi.mock("./course-content", () => ({ getContentResourceForPluginRoute: mocks.resource }));
const { getMaterialIndexPreview } = await import("./material-embeddings");
const user = { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.authorize.mockResolvedValue(undefined); mocks.resource.mockResolvedValue({ title: "Reference" });
  mocks.index.mockResolvedValue({ id: "pinned", createdAt: new Date("2026-01-01T00:00:00Z"), documents: Array.from({ length: 12 }, (_, i) => ({ title: `Part ${i}`, text: `Teaching content ${i}`, vectorId: "private-vector-id", metadata: { private: true } })) });
});
describe("indexed material preview", () => {
  it("returns bounded exact saved text without vectors or private metadata", async () => {
    const first = await getMaterialIndexPreview(user, "course", "resource", ["pinned"]);
    expect(first).toMatchObject({ indexId: "pinned", offset: 0, total: 12, nextOffset: 10 });
    expect(first.passages).toHaveLength(10);
    expect(first.passages[0]).toEqual({ number: 1, title: "Part 0", text: "Teaching content 0" });
    expect(JSON.stringify(first)).not.toContain("private");
    const last = await getMaterialIndexPreview(user, "course", "resource", ["pinned"], 10);
    expect(last).toMatchObject({ nextOffset: null, passages: [{ number: 11 }, { number: 12 }] });
    expect(mocks.index).toHaveBeenCalledWith(expect.objectContaining({ where: { courseId: "course", resourceId: "resource", id: { in: ["pinned"] } } }));
  });
  it("authorizes before reading and cannot fall back to another course/resource/index", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(getMaterialIndexPreview(user, "course", "resource", ["pinned"])).rejects.toThrow("Forbidden");
    expect(mocks.index).not.toHaveBeenCalled();
    mocks.index.mockResolvedValueOnce(null);
    await expect(getMaterialIndexPreview(user, "course", "resource", ["foreign"])).rejects.toMatchObject({ code: "MATERIAL_PREVIEW_UNAVAILABLE" });
  });
  it.each([-1, 1.5, 2001, 12])("rejects an invalid/out-of-range page %i", async offset => {
    await expect(getMaterialIndexPreview(user, "course", "resource", ["pinned"], offset)).rejects.toMatchObject({ code: "MATERIAL_PREVIEW_PAGE_INVALID" });
  });
  it("does not present an empty saved index as a valid preview", async () => {
    mocks.index.mockResolvedValueOnce({ id: "empty", createdAt: new Date(), documents: [] });
    await expect(getMaterialIndexPreview(user, "course", "resource", ["empty"])).rejects.toMatchObject({ code: "MATERIAL_PREVIEW_UNAVAILABLE" });
  });
});
