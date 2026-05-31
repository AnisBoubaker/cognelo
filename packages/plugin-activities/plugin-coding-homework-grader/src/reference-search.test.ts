import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  searchContentResourceEmbeddingDocuments: vi.fn()
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
  searchContentResourceEmbeddingDocuments: coreMocks.searchContentResourceEmbeddingDocuments
}));

vi.mock("./db-client", () => ({
  prisma: dbMocks
}));

const { searchCodingHomeworkReferenceContent } = await import("./reference-search");

describe("coding homework reference search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.pluginCodingHomeworkDocumentationSnapshot.findFirst.mockResolvedValue(snapshot());
    dbMocks.pluginCodingHomeworkDocumentationSnapshot.update.mockImplementation(async ({ data }) => ({
      ...snapshot(),
      metadata: data.metadata,
      updatedAt: new Date("2026-05-28T14:00:00.000Z")
    }));
    coreMocks.searchContentResourceEmbeddingDocuments.mockResolvedValue({
      diagnostics: [],
      matches: [
        {
          contentResourceId: "resource-1",
          contentTypeKey: "text",
          distance: 0.1,
          documentId: "resource-1:body",
          kind: "code",
          pluginKey: "text-content",
          resourceTitle: "Variables",
          score: 0.9,
          sourceId: "resource-1",
          text: "int add(int a, int b) { return a + b; }",
          title: "Variables"
        }
      ]
    });
  });

  it("searches snapshot resources through the generic content vector dispatcher", async () => {
    const result = await searchCodingHomeworkReferenceContent(testScope(), {
      queryText: "add function",
      limit: 3
    });

    expect(coreMocks.searchContentResourceEmbeddingDocuments).toHaveBeenCalledWith(testUser(), "course-1", {
      contentResourceIds: ["resource-1"],
      enforceVisibility: false,
      limit: 3,
      minScore: undefined,
      queryText: "add function"
    });
    expect(result.referenceSearch).toMatchObject({
      status: "ready",
      resourceCount: 1,
      matchCount: 1,
      matches: [
        {
          contentResourceId: "resource-1",
          documentId: "resource-1:body",
          score: 0.9,
          text: "int add(int a, int b) { return a + b; }"
        }
      ]
    });
    expect(dbMocks.pluginCodingHomeworkDocumentationSnapshot.update).toHaveBeenCalledWith({
      where: { id: "snapshot-1" },
      data: {
        metadata: expect.objectContaining({
          latestReferenceSearch: expect.objectContaining({
            matchCount: 1,
            queryFingerprint: expect.any(String)
          })
        })
      }
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

function snapshot() {
  return {
    id: "snapshot-1",
    activityId: "activity-1",
    courseId: "course-1",
    groupId: null,
    contentTreeAnchorItemId: "anchor-1",
    contentTreeFingerprint: "fingerprint",
    status: "ready",
    metadata: {
      includedResources: [
        {
          contentResourceId: "resource-1",
          itemId: "item-1",
          orderIndex: 0,
          title: "Variables"
        }
      ]
    },
    createdAt: new Date("2026-05-28T12:00:00.000Z"),
    updatedAt: new Date("2026-05-28T12:00:00.000Z")
  };
}
