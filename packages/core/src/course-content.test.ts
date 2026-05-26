import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
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
  assertCanViewCourse: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("./authorization", () => authMocks);

const {
  createActivityContentItem,
  createContentFolder,
  createMaterialContentItem,
  deleteContentItem,
  listContentItems,
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
    mockPrisma.courseContentItem.count.mockResolvedValue(0);
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

  it("creates a material content item only for course materials in scope", async () => {
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
        kind: "material",
        parentId: "folder-1",
        materialId: "material-1",
        titleSnapshot: "Variables.pdf"
      })
    });
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
        kind: "material"
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
