import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn()
}));

const coreMocks = vi.hoisted(() => ({
  AppError: class AppError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  canManageCourse: vi.fn(),
  searchContentResourceEmbeddingDocuments: vi.fn()
}));

const dbMocks = vi.hoisted(() => ({
  pluginCodingHomeworkAssignment: {
    findUnique: vi.fn()
  },
  pluginCodingHomeworkDocumentationSnapshot: {
    findFirst: vi.fn()
  },
  pluginCodingHomeworkSubmission: {
    findFirst: vi.fn(),
    update: vi.fn()
  },
  pluginCodingHomeworkSubmissionFunction: {
    create: vi.fn(),
    deleteMany: vi.fn()
  }
}));

vi.mock("node:fs/promises", () => fsMocks);
vi.mock("@cognelo/core", () => coreMocks);
vi.mock("./db-client", () => ({
  Prisma: {},
  prisma: dbMocks
}));

const { analyzeCodingHomeworkSubmission } = await import("./analysis");

describe("coding homework submission analysis", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    coreMocks.canManageCourse.mockResolvedValue(false);
    fsMocks.readFile.mockResolvedValue(`
      int main(void) { return 0; }
      int unique_work(int value) { return value * value + 7; }
    `);
    dbMocks.pluginCodingHomeworkAssignment.findUnique.mockResolvedValue({
      candidateLimit: 1,
      retrievedExampleCount: 2
    });
    dbMocks.pluginCodingHomeworkDocumentationSnapshot.findFirst.mockResolvedValue({
      id: "snapshot-1",
      metadata: {
        includedResources: [{ contentResourceId: "resource-1" }]
      }
    });
    dbMocks.pluginCodingHomeworkSubmission.findFirst.mockResolvedValue({
      id: "submission-1",
      activityId: "activity-1",
      groupId: "group-1",
      userId: "student-1",
      coreAttemptId: null,
      documentationSnapshotId: "snapshot-1",
      zipAttachmentId: "zip-1",
      kind: "final",
      status: "structure_valid",
      structureValidationSummary: {},
      processingError: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      files: [
        {
          id: "file-1",
          submissionId: "submission-1",
          path: "main.c",
          languageKey: "c",
          sizeBytes: BigInt(88),
          sha256: "sha",
          storedName: "submission-1/files/main.c",
          metadata: {},
          createdAt: now
        }
      ]
    });
    coreMocks.searchContentResourceEmbeddingDocuments.mockImplementation(async (_user, _courseId, input) => ({
      diagnostics: [],
      matches: [
        {
          contentResourceId: "resource-1",
          contentTypeKey: "text",
          pluginKey: "text",
          resourceTitle: "Week 1",
          sourceId: "resource-1",
          documentId: input.queryText.includes("unique_work") ? "reference-far" : "reference-near",
          title: input.queryText.includes("unique_work") ? "Different example" : "Similar main",
          text: input.queryText.includes("unique_work") ? "int distant(void) { return 99; }" : "int main(void) { return 0; }",
          kind: "text",
          languageKey: "c",
          path: "week1.c",
          score: input.queryText.includes("unique_work") ? 0.15 : 0.9,
          distance: input.queryText.includes("unique_work") ? 0.85 : 0.1,
          metadata: { functionName: input.queryText.includes("unique_work") ? "distant" : "main" }
        }
      ]
    }));
    dbMocks.pluginCodingHomeworkSubmission.update.mockImplementation(async ({ data, where }) => ({
      id: where.id,
      activityId: "activity-1",
      groupId: "group-1",
      userId: "student-1",
      coreAttemptId: null,
      documentationSnapshotId: "snapshot-1",
      zipAttachmentId: "zip-1",
      kind: "final",
      status: "structure_valid",
      structureValidationSummary: {},
      processingError: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      ...data
    }));
    dbMocks.pluginCodingHomeworkSubmissionFunction.deleteMany.mockResolvedValue({ count: 0 });
    dbMocks.pluginCodingHomeworkSubmissionFunction.create.mockImplementation(async ({ data }) => ({
      id: `${data.functionName}-row`,
      createdAt: now,
      updatedAt: now,
      ...data
    }));
  });

  it("parses submitted source, stores function embeddings, and selects divergent candidates", async () => {
    const result = await analyzeCodingHomeworkSubmission(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      { submissionId: "submission-1" }
    );

    expect(result.analysis).toMatchObject({
      status: "ready",
      parsedFunctionCount: 2,
      selectedCandidateCount: 1,
      referenceResourceCount: 1
    });
    expect(coreMocks.searchContentResourceEmbeddingDocuments).toHaveBeenCalledTimes(2);
    expect(dbMocks.pluginCodingHomeworkSubmissionFunction.deleteMany).toHaveBeenCalledWith({ where: { submissionId: "submission-1" } });
    const createdRows = dbMocks.pluginCodingHomeworkSubmissionFunction.create.mock.calls.map((call) => call[0].data);
    expect(createdRows).toHaveLength(2);
    expect(createdRows.find((row) => row.functionName === "unique_work")).toMatchObject({
      selectedForQuestion: true,
      divergenceScore: 0.85
    });
    expect(createdRows.find((row) => row.functionName === "main")).toMatchObject({
      selectedForQuestion: false,
      divergenceScore: 0.1
    });
    expect(createdRows[0].embedding.length).toBeGreaterThan(0);
    expect(result.functions.filter((fn) => fn.selectedForQuestion).map((fn) => fn.functionName)).toEqual(["unique_work"]);
  });
});

function testUser() {
  return {
    id: "student-1",
    email: "student@example.test",
    name: null,
    firstName: null,
    lastName: null,
    roles: ["student" as const]
  };
}
