import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createActivityContentItem: vi.fn(),
  createContentFolder: vi.fn(),
  createMaterialContentItem: vi.fn(),
  deleteContentItem: vi.fn(),
  getCourseContentItemDeletionImpact: vi.fn(),
  listContentItems: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateContentItem: vi.fn(),
  runCourseActivityDeletionHooks: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createActivityContentItem: mocks.createActivityContentItem,
  createContentFolder: mocks.createContentFolder,
  createMaterialContentItem: mocks.createMaterialContentItem,
  deleteContentItem: mocks.deleteContentItem,
  getCourseContentItemDeletionImpact: mocks.getCourseContentItemDeletionImpact,
  listContentItems: mocks.listContentItems,
  updateContentItem: mocks.updateContentItem
}));

vi.mock("@/lib/course-activity-deletion", () => ({
  runCourseActivityDeletionHooks: mocks.runCourseActivityDeletionHooks
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
const deletionImpactRoute = await import("./[contentItemId]/deletion-impact/route");

const params = { params: Promise.resolve({ courseId: "course-1" }) };

describe("course content routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.listContentItems.mockResolvedValue([{ id: "item-1" }]);
    mocks.createContentFolder.mockResolvedValue({ id: "folder-1" });
    mocks.createMaterialContentItem.mockResolvedValue({ id: "material-item-1" });
    mocks.createActivityContentItem.mockResolvedValue({ id: "activity-item-1" });
    mocks.updateContentItem.mockResolvedValue({ id: "item-1", isVisible: false });
    mocks.deleteContentItem.mockResolvedValue({ ok: true });
    mocks.getCourseContentItemDeletionImpact.mockResolvedValue({
      contentItemId: "item-1",
      kind: "content",
      activities: [],
      blockedActivities: []
    });
  });

  it("lists course content items and forwards visible-only filtering", async () => {
    const request = {
      nextUrl: new URL("http://test.local/api/courses/course-1/content?visibleOnly=true")
    };

    const response = await listRoute.GET(request as never, params);

    await expect(response.json()).resolves.toEqual({ contentItems: [{ id: "item-1" }] });
    expect(mocks.listContentItems).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      includeGroupItems: false,
      visibleOnly: true
    });
  });

  it("creates folder, material, and activity content items", async () => {
    mocks.readJson
      .mockResolvedValueOnce({ title: "Week 1" })
      .mockResolvedValueOnce({ materialId: "material-1", parentId: "folder-1" })
      .mockResolvedValueOnce({ activityId: "activity-1", parentId: "folder-1" });

    const folderResponse = await folderRoute.POST(new Request("http://test.local") as never, params);
    const materialResponse = await materialRoute.POST(new Request("http://test.local") as never, params);
    const activityResponse = await activityRoute.POST(new Request("http://test.local") as never, params);

    expect(folderResponse.status).toBe(201);
    expect(materialResponse.status).toBe(201);
    expect(activityResponse.status).toBe(201);
    expect(mocks.createContentFolder).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      title: "Week 1"
    });
    expect(mocks.createMaterialContentItem).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      materialId: "material-1",
      parentId: "folder-1"
    });
    expect(mocks.createActivityContentItem).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      activityId: "activity-1",
      parentId: "folder-1"
    });
  });

  it("updates and deletes course content items", async () => {
    mocks.readJson.mockResolvedValue({ isVisible: false });
    const itemParams = { params: Promise.resolve({ courseId: "course-1", contentItemId: "item-1" }) };

    const updateResponse = await itemRoute.PATCH(new Request("http://test.local") as never, itemParams);
    const deleteResponse = await itemRoute.DELETE(new Request("http://test.local") as never, itemParams);

    await expect(updateResponse.json()).resolves.toEqual({ contentItem: { id: "item-1", isVisible: false } });
    await expect(deleteResponse.json()).resolves.toEqual({ ok: true });
    expect(mocks.updateContentItem).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "item-1",
      { isVisible: false }
    );
    expect(mocks.deleteContentItem).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", "item-1");
  });

  it("reports folder deletion impact and runs activity cleanup hooks before an allowed batch", async () => {
    const impact = {
      contentItemId: "folder-1",
      kind: "folder",
      blockedActivities: [],
      activities: [{
        activityId: "activity-1",
        activityTypeKey: "mcq",
        isTest: false,
        title: "Loops",
        recordedAttemptCount: 0,
        testItems: []
      }]
    };
    mocks.getCourseContentItemDeletionImpact.mockResolvedValue(impact);
    const itemParams = { params: Promise.resolve({ courseId: "course-1", contentItemId: "folder-1" }) };

    const impactResponse = await deletionImpactRoute.GET(new Request("http://test.local"), itemParams);
    await expect(impactResponse.json()).resolves.toEqual({ impact });

    await itemRoute.DELETE(new Request("http://test.local") as never, itemParams);
    expect(mocks.runCourseActivityDeletionHooks).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      impact.activities[0]
    );
    expect(mocks.deleteContentItem).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "folder-1"
    );
  });

  it("does not run activity cleanup hooks when any folder activity has recorded attempts", async () => {
    const protectedActivity = {
      activityId: "activity-1",
      activityTypeKey: "mcq",
      isTest: false,
      title: "Loops",
      recordedAttemptCount: 2,
      testItems: []
    };
    mocks.getCourseContentItemDeletionImpact.mockResolvedValue({
      contentItemId: "folder-1",
      kind: "folder",
      blockedActivities: [protectedActivity],
      activities: [protectedActivity]
    });
    mocks.deleteContentItem.mockRejectedValueOnce(Object.assign(
      new Error("This folder contains activities with recorded attempts."),
      { code: "CONTENT_FOLDER_ACTIVITIES_HAVE_ATTEMPTS", status: 409 }
    ));

    await expect(itemRoute.DELETE(
      new Request("http://test.local") as never,
      { params: Promise.resolve({ courseId: "course-1", contentItemId: "folder-1" }) }
    )).rejects.toMatchObject({
      code: "CONTENT_FOLDER_ACTIVITIES_HAVE_ATTEMPTS",
      status: 409
    });

    expect(mocks.runCourseActivityDeletionHooks).not.toHaveBeenCalled();
  });
});
