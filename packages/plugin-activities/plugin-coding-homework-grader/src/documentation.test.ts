import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  listContentItems: vi.fn(),
  listContentResources: vi.fn(),
  listMaterials: vi.fn()
}));

const dbMocks = vi.hoisted(() => ({
  pluginCodingHomeworkDocumentationSnapshot: {
    create: vi.fn(),
    findFirst: vi.fn()
  }
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  listContentItems: coreMocks.listContentItems,
  listContentResources: coreMocks.listContentResources,
  listMaterials: coreMocks.listMaterials
}));

vi.mock("./db-client", () => ({
  prisma: dbMocks
}));

const { buildCodingHomeworkDocumentationPreview, createCodingHomeworkDocumentationSnapshot } = await import("./documentation");

describe("coding homework documentation snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.pluginCodingHomeworkDocumentationSnapshot.findFirst.mockResolvedValue(null);
    dbMocks.pluginCodingHomeworkDocumentationSnapshot.create.mockImplementation(async ({ data }) => ({
      id: "snapshot-1",
      ...data,
      createdAt: new Date("2026-05-28T12:00:00.000Z"),
      updatedAt: new Date("2026-05-28T12:00:00.000Z")
    }));
    coreMocks.listContentItems.mockResolvedValue(testContentItems());
    coreMocks.listContentResources.mockResolvedValue([
      resource("resource-1", "Slides", "text", "plugin-text", "2026-05-28T10:00:00.000Z"),
      resource("resource-after", "After", "text", "plugin-text", "2026-05-28T11:00:00.000Z")
    ]);
    coreMocks.listMaterials.mockResolvedValue([material("material-1", "Legacy Notes", "text", "2026-05-28T10:30:00.000Z")]);
  });

  it("lists visible resources before the activity anchor in content-tree order", async () => {
    const preview = await buildCodingHomeworkDocumentationPreview(testScope());

    expect(coreMocks.listContentItems).toHaveBeenCalledWith(testUser(), "course-1", { visibleOnly: true });
    expect(preview.anchor?.id).toBe("anchor-item");
    expect(preview.resourceCount).toBe(2);
    expect(preview.resources.map((resource) => resource.title)).toEqual(["Slides", "Legacy Notes"]);
    expect(preview.resources.map((resource) => resource.path)).toEqual([["Week 1"], ["Week 1"]]);
    expect(preview.resources.map((resource) => resource.sourceKind)).toEqual(["content_resource", "legacy_material"]);
    expect(preview.contentTreeFingerprint).toHaveLength(64);
  });

  it("writes a ready snapshot with the exact preview metadata", async () => {
    const result = await createCodingHomeworkDocumentationSnapshot(testScope());

    expect(dbMocks.pluginCodingHomeworkDocumentationSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityId: "activity-1",
        contentTreeAnchorItemId: "anchor-item",
        courseId: "course-1",
        groupId: null,
        status: "ready",
        metadata: expect.objectContaining({
          resourceCount: 2,
          includedResources: expect.arrayContaining([expect.objectContaining({ title: "Slides" })])
        })
      })
    });
    expect(result.snapshot?.id).toBe("snapshot-1");
    expect(result.preview.latestSnapshot?.id).toBe("snapshot-1");
  });

  it("requires the activity to be placed in the content tree before snapshot creation", async () => {
    coreMocks.listContentItems.mockResolvedValue(testContentItems().filter((item) => item.id !== "anchor-item"));

    await expect(createCodingHomeworkDocumentationSnapshot(testScope())).rejects.toMatchObject({
      code: "CODING_HOMEWORK_CONTENT_ANCHOR_NOT_FOUND"
    });
  });
});

function testScope() {
  return {
    activityId: "activity-1",
    courseId: "course-1",
    groupId: null,
    user: testUser()
  };
}

function testUser() {
  return {
    id: "teacher-1",
    email: "teacher@example.test",
    name: null,
    firstName: null,
    lastName: null,
    roles: ["teacher" as const]
  };
}

function testContentItems() {
  return [
    item({ id: "week-1", kind: "folder", position: 0, titleSnapshot: "Week 1" }),
    item({ id: "resource-item", parentId: "week-1", kind: "content", position: 0, titleSnapshot: "Slides", contentResourceId: "resource-1" }),
    item({ id: "material-item", parentId: "week-1", kind: "content", position: 1, titleSnapshot: "Legacy Notes", materialId: "material-1" }),
    item({ id: "anchor-item", kind: "activity", position: 1, titleSnapshot: "Homework", activityId: "activity-1" }),
    item({ id: "after-item", kind: "content", position: 2, titleSnapshot: "After", contentResourceId: "resource-after" })
  ];
}

function item(input: {
  activityId?: string | null;
  contentResourceId?: string | null;
  courseGroupActivityId?: string | null;
  id: string;
  kind: "folder" | "content" | "activity";
  materialId?: string | null;
  parentId?: string | null;
  position: number;
  titleSnapshot?: string | null;
}) {
  return {
    id: input.id,
    courseId: "course-1",
    groupId: null,
    parentId: input.parentId ?? null,
    kind: input.kind,
    titleSnapshot: input.titleSnapshot ?? null,
    position: input.position,
    isVisible: true,
    materialId: input.materialId ?? null,
    activityId: input.activityId ?? null,
    courseGroupActivityId: input.courseGroupActivityId ?? null,
    contentResourceId: input.contentResourceId ?? null,
    createdAt: new Date(`2026-05-28T09:0${input.position}:00.000Z`),
    updatedAt: new Date(`2026-05-28T09:0${input.position}:00.000Z`),
    metadata: {}
  };
}

function resource(id: string, title: string, contentTypeKey: string, pluginKey: string, updatedAt: string) {
  return {
    id,
    courseId: "course-1",
    groupId: null,
    contentTypeKey,
    pluginKey,
    title,
    metadata: {},
    createdAt: new Date(updatedAt),
    updatedAt: new Date(updatedAt)
  };
}

function material(id: string, title: string, kind: string, updatedAt: string) {
  return {
    id,
    title,
    kind,
    body: "notes",
    url: null,
    metadata: {},
    createdAt: new Date(updatedAt),
    updatedAt: new Date(updatedAt)
  };
}
