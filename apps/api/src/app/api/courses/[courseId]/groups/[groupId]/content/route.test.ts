import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createActivityContentItem: vi.fn(),
  createContentFolder: vi.fn(),
  createMaterialContentItem: vi.fn(),
  deleteContentItem: vi.fn(),
  listContentItems: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateGroupContentItem: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createActivityContentItem: mocks.createActivityContentItem,
  createContentFolder: mocks.createContentFolder,
  createMaterialContentItem: mocks.createMaterialContentItem,
  deleteContentItem: mocks.deleteContentItem,
  listContentItems: mocks.listContentItems,
  updateGroupContentItem: mocks.updateGroupContentItem
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const listRoute = await import("./route");
const folderRoute = await import("./folders/route");
const materialRoute = await import("./materials/route");
const activityRoute = await import("./activities/route");
const itemRoute = await import("./[contentItemId]/route");

const params = { params: Promise.resolve({ courseId: "course-1", groupId: "group-1" }) };

describe("group content routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.listContentItems.mockResolvedValue([{ id: "group-item-1" }]);
    mocks.createContentFolder.mockResolvedValue({ id: "folder-1" });
    mocks.createMaterialContentItem.mockResolvedValue({ id: "material-item-1" });
    mocks.createActivityContentItem.mockResolvedValue({ id: "activity-item-1" });
    mocks.updateGroupContentItem.mockResolvedValue({ id: "item-1", isVisible: false });
    mocks.deleteContentItem.mockResolvedValue({ ok: true });
  });

  it("lists group content with group scope and visible-only filtering", async () => {
    const request = {
      nextUrl: new URL("http://test.local/api/courses/course-1/groups/group-1/content?visibleOnly=true")
    };

    const response = await listRoute.GET(request as never, params);

    await expect(response.json()).resolves.toEqual({ contentItems: [{ id: "group-item-1" }] });
    expect(mocks.listContentItems).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      groupId: "group-1",
      visibleOnly: true
    });
  });

  it("keeps folders course-scoped while injecting group scope for content items", async () => {
    mocks.readJson
      .mockResolvedValueOnce({ title: "Week 1", groupId: "ignored-client-group" })
      .mockResolvedValueOnce({ materialId: "material-1" })
      .mockResolvedValueOnce({ courseGroupActivityId: "assignment-1" });

    await folderRoute.POST(new Request("http://test.local") as never, params);
    await materialRoute.POST(new Request("http://test.local") as never, params);
    await activityRoute.POST(new Request("http://test.local") as never, params);

    expect(mocks.createContentFolder).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      title: "Week 1"
    });
    expect(mocks.createMaterialContentItem).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      materialId: "material-1",
      groupId: "group-1"
    });
    expect(mocks.createActivityContentItem).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      courseGroupActivityId: "assignment-1",
      groupId: "group-1"
    });
  });

  it("scopes group content item updates and deletes to the route group", async () => {
    mocks.readJson.mockResolvedValue({ isVisible: false });
    const itemParams = { params: Promise.resolve({ courseId: "course-1", groupId: "group-1", contentItemId: "item-1" }) };

    await itemRoute.PATCH(new Request("http://test.local") as never, itemParams);
    await itemRoute.DELETE(new Request("http://test.local") as never, itemParams);

    expect(mocks.updateGroupContentItem).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "group-1",
      "item-1",
      { isVisible: false }
    );
    expect(mocks.deleteContentItem).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "item-1",
      { groupId: "group-1" }
    );
  });
});
