import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  activity: {
    findFirst: vi.fn()
  },
  courseContentItem: {
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  courseContentResource: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  courseGroup: {
    findFirst: vi.fn()
  },
  courseGroupActivity: {
    findFirst: vi.fn()
  },
  courseMaterial: {
    findFirst: vi.fn()
  }
}));

const authMocks = vi.hoisted(() => ({
  assertCanManageCourse: vi.fn(),
  assertCanViewCourse: vi.fn(),
  canManageCourse: vi.fn()
}));

const pluginMocks = vi.hoisted(() => ({
  assertContentResourcePluginActive: vi.fn(),
  assertContentTypePluginEnabled: vi.fn()
}));

const serverContentTypePlugin = vi.hoisted(() => ({
  key: "github-repo-content",
  handlers: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getEmbeddingSource: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("./authorization", () => authMocks);
vi.mock("./plugins", () => pluginMocks);
vi.mock("@cognelo/content-type-sdk", () => ({
  getContentTypePluginForType: vi.fn((key: string) => (key === "github-repo" ? { key: "github-repo-content" } : undefined))
}));
vi.mock("@cognelo/content-type-sdk/server", () => ({
  getServerContentTypePlugin: vi.fn((key: string) => (key === "github-repo-content" ? serverContentTypePlugin : undefined))
}));

const {
  createActivityContentItem,
  createContentFolder,
  createContentResource,
  createContentResourceContentItem,
  createPluginContentResource,
  createMaterialContentItem,
  deletePluginContentResource,
  deleteContentResource,
  deleteContentItem,
  getContentResourceEmbeddingSource,
  getContentResourceForPluginRoute,
  listContentResources,
  listContentItems,
  updatePluginContentResource,
  updateContentResource,
  updateContentItem
} = await import("./course-content");

const teacherUser: CurrentUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher"]
};

describe("course content services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof mockPrisma) => unknown) => handler(mockPrisma));
    mockPrisma.courseContentItem.count.mockResolvedValue(0);
    authMocks.canManageCourse.mockResolvedValue(true);
    pluginMocks.assertContentResourcePluginActive.mockResolvedValue(undefined);
    pluginMocks.assertContentTypePluginEnabled.mockResolvedValue(undefined);
  });

  it("creates visible folders in the course-level structure", async () => {
    mockPrisma.courseContentItem.create.mockResolvedValue({ id: "folder-1" });

    await expect(
      createContentFolder(teacherUser, "course-1", {
        title: " Week 1 ",
        metadata: { week: 1 }
      })
    ).resolves.toEqual({ id: "folder-1" });

    expect(mockPrisma.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        courseId: "course-1",
        groupId: null,
        kind: "folder",
        titleSnapshot: "Week 1",
        isVisible: true,
        metadata: { week: 1 }
      })
    });
  });

  it("rejects group-scoped folders because folders are shared course structure", async () => {
    await expect(
      createContentFolder(teacherUser, "course-1", {
        groupId: "group-1",
        title: "Week 1"
      })
    ).rejects.toMatchObject({ status: 400, code: "CONTENT_FOLDERS_ARE_COURSE_SCOPED" });

    expect(mockPrisma.courseContentItem.create).not.toHaveBeenCalled();
  });

  it("creates a legacy material-backed content item only for course materials in scope", async () => {
    mockPrisma.courseContentItem.findFirst.mockResolvedValue({ id: "folder-1" });
    mockPrisma.courseMaterial.findFirst.mockResolvedValue({ id: "material-1", title: "Variables.pdf" });
    mockPrisma.courseContentItem.create.mockResolvedValue({ id: "item-1" });

    await createMaterialContentItem(teacherUser, "course-1", {
      parentId: "folder-1",
      materialId: "material-1"
    });

    expect(mockPrisma.courseMaterial.findFirst).toHaveBeenCalledWith({
      where: { id: "material-1", courseId: "course-1" },
      select: { id: true, title: true }
    });
    expect(mockPrisma.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "content",
        parentId: "folder-1",
        materialId: "material-1",
        titleSnapshot: "Variables.pdf"
      })
    });
  });

  it("creates generic plugin-backed content resources without concrete content type branching", async () => {
    mockPrisma.courseContentResource.create.mockResolvedValue({ id: "resource-1" });

    await expect(
      createContentResource(teacherUser, "course-1", {
        contentTypeKey: "github-repo",
        pluginKey: "github-repo-content",
        title: " Examples ",
        metadata: { url: "https://github.com/org/repo" }
      })
    ).resolves.toEqual({ id: "resource-1" });

    expect(mockPrisma.courseContentResource.create).toHaveBeenCalledWith({
      data: {
        courseId: "course-1",
        groupId: null,
        contentTypeKey: "github-repo",
        pluginKey: "github-repo-content",
        title: "Examples",
        metadata: { url: "https://github.com/org/repo" }
      }
    });
  });

  it("creates content tree items for generic content resources", async () => {
    mockPrisma.courseContentItem.findFirst.mockResolvedValue({ id: "folder-1" });
    mockPrisma.courseContentResource.findFirst.mockResolvedValue({ id: "resource-1", title: "Examples" });
    mockPrisma.courseContentItem.create.mockResolvedValue({ id: "content-item-1" });

    await createContentResourceContentItem(teacherUser, "course-1", {
      contentResourceId: "resource-1",
      parentId: "folder-1"
    });

    expect(mockPrisma.courseContentResource.findFirst).toHaveBeenCalledWith({
      where: { id: "resource-1", courseId: "course-1", groupId: null },
      select: { id: true, title: true }
    });
    expect(mockPrisma.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "content",
        contentResourceId: "resource-1",
        titleSnapshot: "Examples"
      })
    });
  });

  it("creates plugin-backed content resources through the active content type plugin", async () => {
    mockPrisma.courseContentItem.findFirst.mockResolvedValue({ id: "folder-1" });
    serverContentTypePlugin.handlers.create.mockResolvedValue({
      title: "Examples",
      metadata: { url: "https://github.com/org/repo" }
    });
    mockPrisma.courseContentResource.create.mockResolvedValue({ id: "resource-1", title: "Examples" });
    mockPrisma.courseContentItem.create.mockResolvedValue({ id: "content-item-1" });

    await expect(
      createPluginContentResource(teacherUser, "course-1", {
        contentTypeKey: "github-repo",
        parentId: "folder-1",
        payload: { url: "https://github.com/org/repo" }
      })
    ).resolves.toEqual({
      resource: { id: "resource-1", title: "Examples" },
      contentItem: { id: "content-item-1" }
    });

    expect(pluginMocks.assertContentTypePluginEnabled).toHaveBeenCalledWith("github-repo");
    expect(serverContentTypePlugin.handlers.create).toHaveBeenCalledWith({
      user: teacherUser,
      courseId: "course-1",
      groupId: null,
      contentTypeKey: "github-repo",
      payload: { url: "https://github.com/org/repo" }
    });
    expect(mockPrisma.courseContentResource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentTypeKey: "github-repo",
        pluginKey: "github-repo-content",
        title: "Examples",
        metadata: { url: "https://github.com/org/repo" }
      })
    });
    expect(mockPrisma.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "content",
        contentResourceId: "resource-1",
        titleSnapshot: "Examples"
      })
    });
  });

  it("updates and deletes plugin-backed content resources through plugin hooks", async () => {
    mockPrisma.courseContentResource.findFirst.mockResolvedValue({
      id: "resource-1",
      courseId: "course-1",
      groupId: null,
      contentTypeKey: "github-repo",
      pluginKey: "github-repo-content",
      title: "Examples",
      metadata: { url: "https://github.com/org/repo" }
    });
    serverContentTypePlugin.handlers.update.mockResolvedValue({
      title: "Updated examples",
      metadata: { url: "https://github.com/org/updated" }
    });
    mockPrisma.courseContentResource.update.mockResolvedValue({ id: "resource-1", title: "Updated examples" });
    mockPrisma.courseContentResource.delete.mockResolvedValue({ id: "resource-1" });

    await expect(
      updatePluginContentResource(teacherUser, "course-1", "resource-1", {
        payload: { title: "Updated examples" }
      })
    ).resolves.toEqual({ id: "resource-1", title: "Updated examples" });
    await expect(deletePluginContentResource(teacherUser, "course-1", "resource-1")).resolves.toEqual({ ok: true });

    expect(serverContentTypePlugin.handlers.update).toHaveBeenCalledWith({
      user: teacherUser,
      resource: expect.objectContaining({ id: "resource-1", pluginKey: "github-repo-content" }),
      payload: { title: "Updated examples" }
    });
    expect(serverContentTypePlugin.handlers.delete).toHaveBeenCalledWith({
      user: teacherUser,
      resource: expect.objectContaining({ id: "resource-1", pluginKey: "github-repo-content" })
    });
  });

  it("resolves generic embedding descriptors through content type plugin hooks", async () => {
    mockPrisma.courseContentResource.findFirst.mockResolvedValue({
      id: "resource-1",
      courseId: "course-1",
      groupId: null,
      contentTypeKey: "github-repo",
      pluginKey: "github-repo-content",
      title: "Examples",
      metadata: { url: "https://github.com/org/repo" }
    });
    serverContentTypePlugin.handlers.getEmbeddingSource.mockResolvedValue({
      kind: "external_url",
      url: "https://github.com/org/repo",
      sourceId: "resource-1"
    });

    await expect(getContentResourceEmbeddingSource(teacherUser, "course-1", "resource-1")).resolves.toEqual({
      kind: "external_url",
      url: "https://github.com/org/repo",
      sourceId: "resource-1"
    });
    expect(serverContentTypePlugin.handlers.getEmbeddingSource).toHaveBeenCalledWith({
      resource: expect.objectContaining({ id: "resource-1", pluginKey: "github-repo-content" })
    });
  });

  it("enforces content tree visibility before serving plugin resource routes to non-managers", async () => {
    authMocks.canManageCourse.mockResolvedValue(false);
    mockPrisma.courseContentResource.findFirst.mockResolvedValue({
      id: "resource-1",
      courseId: "course-1",
      groupId: null,
      contentTypeKey: "github-repo",
      pluginKey: "github-repo-content",
      title: "Examples",
      metadata: {}
    });
    mockPrisma.courseContentItem.findMany.mockResolvedValue([
      { id: "week-1", parentId: null, isVisible: false, contentResourceId: null },
      { id: "item-1", parentId: "week-1", isVisible: true, contentResourceId: "resource-1" }
    ]);

    await expect(getContentResourceForPluginRoute(teacherUser, "course-1", "resource-1")).rejects.toMatchObject({
      status: 404,
      code: "CONTENT_RESOURCE_NOT_AVAILABLE"
    });
  });

  it("updates, lists, and deletes generic content resources in scope", async () => {
    mockPrisma.courseContentResource.findFirst.mockResolvedValue({ id: "resource-1", courseId: "course-1", groupId: null });
    mockPrisma.courseContentResource.update.mockResolvedValue({ id: "resource-1", title: "Updated" });
    mockPrisma.courseContentResource.findMany.mockResolvedValue([{ id: "resource-1" }]);
    mockPrisma.courseContentResource.delete.mockResolvedValue({ id: "resource-1" });

    await expect(updateContentResource(teacherUser, "course-1", "resource-1", { title: " Updated " })).resolves.toEqual({
      id: "resource-1",
      title: "Updated"
    });
    await expect(listContentResources(teacherUser, "course-1")).resolves.toEqual([{ id: "resource-1" }]);
    await expect(deleteContentResource(teacherUser, "course-1", "resource-1")).resolves.toEqual({ ok: true });

    expect(mockPrisma.courseContentResource.update).toHaveBeenCalledWith({
      where: { id: "resource-1" },
      data: { title: "Updated" }
    });
    expect(mockPrisma.courseContentResource.findMany).toHaveBeenCalledWith({
      where: { courseId: "course-1", groupId: null },
      orderBy: [{ title: "asc" }, { createdAt: "asc" }]
    });
    expect(mockPrisma.courseContentResource.delete).toHaveBeenCalledWith({ where: { id: "resource-1" } });
  });

  it("filters content resource lists by effective visibility for non-managers", async () => {
    authMocks.canManageCourse.mockResolvedValue(false);
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1" });
    mockPrisma.courseContentResource.findMany.mockResolvedValue([{ id: "visible-resource" }, { id: "hidden-resource" }]);
    mockPrisma.courseContentItem.findMany.mockResolvedValue([
      { id: "visible-item", parentId: null, isVisible: true, contentResourceId: "visible-resource" },
      { id: "hidden-folder", parentId: null, isVisible: false, contentResourceId: null },
      { id: "hidden-item", parentId: "hidden-folder", isVisible: true, contentResourceId: "hidden-resource" }
    ]);

    await expect(listContentResources(teacherUser, "course-1", { groupId: "group-1" })).resolves.toEqual([{ id: "visible-resource" }]);
  });

  it("lets group content use course-level folders as parents", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1" });
    mockPrisma.courseContentItem.findFirst.mockResolvedValue({ id: "course-level-folder" });
    mockPrisma.courseMaterial.findFirst.mockResolvedValue({ id: "material-1", title: "Variables.pdf" });
    mockPrisma.courseContentItem.create.mockResolvedValue({ id: "item-1" });

    await createMaterialContentItem(teacherUser, "course-1", {
      groupId: "group-1",
      materialId: "material-1",
      parentId: "course-level-folder"
    });

    expect(mockPrisma.courseContentItem.findFirst).toHaveBeenCalledWith({
      where: { id: "course-level-folder", courseId: "course-1", groupId: null, kind: "folder" },
      select: { id: true }
    });
    expect(mockPrisma.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "group-1",
        parentId: "course-level-folder",
        kind: "content"
      })
    });
  });

  it("creates activity content for assigned group activities without inspecting plugin data", async () => {
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      id: "assignment-1",
      group: { id: "group-1" },
      activity: { id: "activity-1", title: "Use the right variable" }
    });
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1" });
    mockPrisma.courseContentItem.create.mockResolvedValue({ id: "activity-item-1" });

    await createActivityContentItem(teacherUser, "course-1", {
      courseGroupActivityId: "assignment-1",
      groupId: "group-1",
      isVisible: false
    });

    expect(mockPrisma.courseGroupActivity.findFirst).toHaveBeenCalledWith({
      where: { id: "assignment-1", group: { courseId: "course-1" } },
      include: {
        activity: { select: { id: true, title: true } },
        group: { select: { id: true } }
      }
    });
    expect(mockPrisma.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "activity",
        groupId: "group-1",
        activityId: "activity-1",
        courseGroupActivityId: "assignment-1",
        isVisible: false,
        titleSnapshot: "Use the right variable"
      })
    });
  });

  it("rejects ambiguous activity content targets", async () => {
    await expect(
      createActivityContentItem(teacherUser, "course-1", {
        activityId: "activity-1",
        courseGroupActivityId: "assignment-1"
      })
    ).rejects.toMatchObject({ status: 400, code: "ACTIVITY_CONTENT_TARGET_AMBIGUOUS" });

    expect(mockPrisma.courseContentItem.create).not.toHaveBeenCalled();
  });

  it("rejects moving a content item into itself", async () => {
    mockPrisma.courseContentItem.findFirst.mockResolvedValue({ id: "folder-1", courseId: "course-1", groupId: null });

    await expect(updateContentItem(teacherUser, "course-1", "folder-1", { parentId: "folder-1" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_CONTENT_PARENT"
    });

    expect(mockPrisma.courseContentItem.update).not.toHaveBeenCalled();
  });

  it("rejects moving a folder into one of its descendants", async () => {
    mockPrisma.courseContentItem.findFirst
      .mockResolvedValueOnce({ id: "folder-1", courseId: "course-1", groupId: null })
      .mockResolvedValueOnce({ id: "folder-2" });
    mockPrisma.courseContentItem.findMany
      .mockResolvedValueOnce([{ id: "folder-2" }])
      .mockResolvedValueOnce([]);

    await expect(updateContentItem(teacherUser, "course-1", "folder-1", { parentId: "folder-2" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_CONTENT_PARENT"
    });
  });

  it("lists all content for teachers with effective visibility", async () => {
    mockPrisma.courseContentItem.findMany.mockResolvedValue([
      { id: "week-1", parentId: null, isVisible: false, position: 0 },
      { id: "activity-1", parentId: "week-1", isVisible: true, position: 1 },
      { id: "week-2", parentId: null, isVisible: true, position: 2 }
    ]);

    await expect(listContentItems(teacherUser, "course-1")).resolves.toMatchObject([
      { id: "week-1", effectiveVisibility: "hidden" },
      { id: "activity-1", effectiveVisibility: "hidden_by_parent" },
      { id: "week-2", effectiveVisibility: "visible" }
    ]);
  });

  it("filters hidden and hidden-by-parent content for student-visible lists", async () => {
    mockPrisma.courseContentItem.findMany.mockResolvedValue([
      { id: "week-1", parentId: null, isVisible: false, position: 0 },
      { id: "activity-1", parentId: "week-1", isVisible: true, position: 1 },
      { id: "week-2", parentId: null, isVisible: true, position: 2 }
    ]);

    await expect(listContentItems(teacherUser, "course-1", { visibleOnly: true })).resolves.toMatchObject([
      { id: "week-2", effectiveVisibility: "visible" }
    ]);
  });

  it("lists group content with shared course folders and group-specific items", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1" });
    mockPrisma.courseContentItem.findMany.mockResolvedValue([
      { id: "week-1", parentId: null, isVisible: true, groupId: null },
      { id: "activity-1", parentId: "week-1", isVisible: true, groupId: "group-1" }
    ]);

    await listContentItems(teacherUser, "course-1", { groupId: "group-1" });

    expect(mockPrisma.courseContentItem.findMany).toHaveBeenCalledWith({
      where: {
        courseId: "course-1",
        OR: [{ groupId: null }, { groupId: "group-1" }]
      },
      orderBy: [{ parentId: "asc" }, { position: "asc" }, { createdAt: "asc" }]
    });
  });

  it("deletes only content items belonging to the course", async () => {
    mockPrisma.courseContentItem.findFirst.mockResolvedValue({ id: "item-1", courseId: "course-1" });

    await expect(deleteContentItem(teacherUser, "course-1", "item-1")).resolves.toEqual({ ok: true });
    expect(mockPrisma.courseContentItem.delete).toHaveBeenCalledWith({ where: { id: "item-1" } });
  });
});
