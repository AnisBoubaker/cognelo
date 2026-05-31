import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  getContentResourceEmbeddingDocuments: vi.fn()
}));

const dbMocks = vi.hoisted(() => ({
  pluginCodingHomeworkDocumentationSnapshot: {
    findFirst: vi.fn(),
    update: vi.fn()
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
  getContentResourceEmbeddingDocuments: coreMocks.getContentResourceEmbeddingDocuments
}));

vi.mock("./db-client", () => ({
  prisma: dbMocks
}));

const { extractCodingHomeworkDocumentationSnapshot } = await import("./extraction");

describe("coding homework source extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.pluginCodingHomeworkDocumentationSnapshot.findFirst.mockResolvedValue(snapshot());
    dbMocks.pluginCodingHomeworkDocumentationSnapshot.update.mockImplementation(async ({ data }) => ({
      ...snapshot(),
      metadata: data.metadata,
      updatedAt: new Date("2026-05-28T13:00:00.000Z")
    }));
    coreMocks.getContentResourceEmbeddingDocuments.mockResolvedValue({
      sourceId: "resource-1",
      documents: [
        {
          id: "resource-1:body",
          sourceId: "resource-1",
          title: "Variables",
          text: "int add(int a, int b) { return a + b; }",
          kind: "code",
          languageKey: "c"
        }
      ],
      diagnostics: []
    });
  });

  it("extracts documents through the generic content type interface", async () => {
    const result = await extractCodingHomeworkDocumentationSnapshot(testScope());

    expect(coreMocks.getContentResourceEmbeddingDocuments).toHaveBeenCalledWith(testUser(), "course-1", "resource-1", {
      enforceVisibility: false
    });
    expect(result.extraction.documentCount).toBe(1);
    expect(result.extraction.documents[0]).toMatchObject({
      contentResourceId: "resource-1",
      text: "int add(int a, int b) { return a + b; }",
      kind: "code",
      languageKey: "c"
    });
    expect(dbMocks.pluginCodingHomeworkDocumentationSnapshot.update).toHaveBeenCalledWith({
      where: { id: "snapshot-1" },
      data: {
        metadata: expect.objectContaining({
          extraction: expect.objectContaining({
            status: "ready",
            documentCount: 1
          })
        })
      }
    });
  });

  it("reports non-content-plugin snapshot entries without crashing extraction", async () => {
    dbMocks.pluginCodingHomeworkDocumentationSnapshot.findFirst.mockResolvedValue(
      snapshot({
        includedResources: [
          {
            itemId: "legacy-item",
            materialId: "material-1",
            sourceKind: "legacy_material",
            title: "Legacy notes"
          }
        ]
      })
    );

    const result = await extractCodingHomeworkDocumentationSnapshot(testScope());

    expect(coreMocks.getContentResourceEmbeddingDocuments).not.toHaveBeenCalled();
    expect(result.extraction.documentCount).toBe(0);
    expect(result.extraction.diagnostics[0]).toMatchObject({
      code: "CONTENT_RESOURCE_EXTRACTION_UNAVAILABLE",
      severity: "warning"
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

function snapshot(metadata?: Record<string, unknown>) {
  return {
    id: "snapshot-1",
    activityId: "activity-1",
    courseId: "course-1",
    groupId: null,
    contentTreeAnchorItemId: "anchor-1",
    contentTreeFingerprint: "fingerprint",
    status: "ready",
    metadata: metadata ?? {
      includedResources: [
        {
          contentResourceId: "resource-1",
          contentTypeKey: "text",
          itemId: "item-1",
          orderIndex: 0,
          path: ["Week 1"],
          pluginKey: "text-content",
          resourceFingerprint: "resource-fingerprint",
          sourceKind: "content_resource",
          title: "Variables"
        }
      ]
    },
    createdAt: new Date("2026-05-28T12:00:00.000Z"),
    updatedAt: new Date("2026-05-28T12:00:00.000Z")
  };
}
