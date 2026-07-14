import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn()
}));

const dbMocks = vi.hoisted(() => ({
  pluginCodingHomeworkAssignment: {
    findUnique: vi.fn()
  },
  pluginCodingHomeworkAttachment: {
    create: vi.fn(),
    findFirst: vi.fn()
  },
  pluginCodingHomeworkDocumentationSnapshot: {
    findFirst: vi.fn()
  },
  pluginCodingHomeworkSubmission: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  pluginCodingHomeworkSubmissionFile: {
    create: vi.fn()
  },
  pluginCodingHomeworkSubmissionRequirementSet: {
    findUnique: vi.fn()
  }
}));

vi.mock("node:fs/promises", () => fsMocks);
vi.mock("./db-client", () => ({
  Prisma: {},
  prisma: dbMocks
}));

const { getLatestCodingHomeworkSubmission, runCodingHomeworkSubmission } = await import("./submission");

describe("coding homework final submissions", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.writeFile.mockResolvedValue(undefined);
    dbMocks.pluginCodingHomeworkSubmissionRequirementSet.findUnique.mockResolvedValue({
      requirements: {
        allowedExtensions: [".c"],
        ignoredPaths: [],
        languageKey: "c",
        maxArchiveBytes: 1_000_000,
        maxFileCount: 10,
        requiredFiles: [{ path: "main.c" }],
        requiredFolders: [],
        requiredFunctions: [{ filePath: "main.c", name: "main" }]
      }
    });
    dbMocks.pluginCodingHomeworkDocumentationSnapshot.findFirst.mockResolvedValue(null);
    dbMocks.pluginCodingHomeworkSubmission.findMany.mockResolvedValue([]);
    dbMocks.pluginCodingHomeworkAttachment.create.mockResolvedValue({
      id: "zip-attachment-1"
    });
    dbMocks.pluginCodingHomeworkSubmission.create.mockImplementation(async ({ data }) => ({
      id: "submission-1",
      coreAttemptId: null,
      documentationSnapshotId: data.documentationSnapshotId ?? null,
      zipAttachmentId: null,
      processingError: null,
      createdAt: now,
      updatedAt: now,
      ...data
    }));
    dbMocks.pluginCodingHomeworkSubmission.update.mockImplementation(async ({ data, where }) => ({
      id: where.id,
      activityId: "activity-1",
      coreAttemptId: null,
      documentationSnapshotId: null,
      groupId: "group-1",
      kind: "final",
      processingError: null,
      structureValidationSummary: {},
      userId: "student-1",
      createdAt: now,
      updatedAt: now,
      ...data
    }));
    dbMocks.pluginCodingHomeworkSubmissionFile.create.mockImplementation(async ({ data }) => ({
      id: `file-${dbMocks.pluginCodingHomeworkSubmissionFile.create.mock.calls.length}`,
      createdAt: now,
      ...data
    }));
  });

  it("stores a valid ZIP submission and extracted file metadata", async () => {
    const result = await runCodingHomeworkSubmission(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      {
        base64: createStoredZip([{ path: "main.c", content: "int main(void) { return 0; }" }]).toString("base64"),
        fileName: "submission.zip",
        mimeType: "application/zip"
      }
    );

    expect(result.summary.isValid).toBe(true);
    expect(result.submission).toMatchObject({
      id: "submission-1",
      kind: "final",
      status: "structure_valid",
      zipAttachmentId: "zip-attachment-1"
    });
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      languageKey: "c",
      path: "main.c",
      submissionId: "submission-1"
    });
    expect(dbMocks.pluginCodingHomeworkAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "submission_zip",
        ownerId: "submission-1",
        ownerKind: "submission",
        originalName: "submission.zip"
      })
    });
    expect(dbMocks.pluginCodingHomeworkSubmissionFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        path: "main.c",
        languageKey: "c",
        submissionId: "submission-1"
      })
    });
    expect(fsMocks.writeFile).toHaveBeenCalledTimes(2);
  });

  it("records invalid structure without extracting files", async () => {
    const result = await runCodingHomeworkSubmission(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      {
        base64: createStoredZip([{ path: "notes.txt", content: "not source" }]).toString("base64"),
        fileName: "submission.zip",
        mimeType: "application/zip"
      }
    );

    expect(result.summary.isValid).toBe(false);
    expect(result.submission.status).toBe("invalid_structure");
    expect(result.files).toEqual([]);
    expect(dbMocks.pluginCodingHomeworkAttachment.create).not.toHaveBeenCalled();
    expect(dbMocks.pluginCodingHomeworkSubmissionFile.create).not.toHaveBeenCalled();
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });

  it("reuses an existing submission for matching idempotency retries", async () => {
    const zip = createStoredZip([{ path: "main.c", content: "int main(void) { return 0; }" }]);
    const fingerprint = await sha256Hex(zip);
    dbMocks.pluginCodingHomeworkSubmission.findMany.mockResolvedValue([
      {
        id: "submission-existing",
        activityId: "activity-1",
        coreAttemptId: null,
        documentationSnapshotId: null,
        groupId: "group-1",
        kind: "final",
        metadata: {
          idempotencyKey: "retry-key-1",
          uploadFingerprint: fingerprint
        },
        processingError: null,
        status: "challenge_ready",
        structureValidationSummary: {
          fileCount: 1,
          ignoredFiles: [],
          issues: [],
          isValid: true,
          matchedFunctions: [],
          missingRequired: [],
          parserDiagnostics: [],
          unexpectedItems: [],
          validFiles: ["main.c"],
          validFunctions: []
        },
        userId: "student-1",
        zipAttachmentId: "zip-1",
        createdAt: now,
        updatedAt: now,
        files: [],
        questions: [
          {
            id: "question-1",
            answerSubmittedAt: null,
            orderIndex: 0,
            questionText: "Explain your main function.",
            studentAnswer: null,
            submissionId: "submission-existing"
          }
        ]
      }
    ]);

    const result = await runCodingHomeworkSubmission(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      {
        base64: zip.toString("base64"),
        fileName: "submission.zip",
        idempotencyKey: "retry-key-1",
        mimeType: "application/zip"
      }
    );

    expect(result.idempotent).toBe(true);
    expect(result.submission.id).toBe("submission-existing");
    expect(result.questions).toHaveLength(1);
    expect(dbMocks.pluginCodingHomeworkSubmission.create).not.toHaveBeenCalled();
    expect(dbMocks.pluginCodingHomeworkAttachment.create).not.toHaveBeenCalled();
  });

  it("treats a teacher-deleted latest submission as no active student submission", async () => {
    dbMocks.pluginCodingHomeworkSubmission.findMany.mockResolvedValueOnce([
      {
        id: "submission-deleted",
        activityId: "activity-1",
        coreAttemptId: null,
        documentationSnapshotId: null,
        files: [],
        groupId: "group-1",
        kind: "final",
        metadata: {
          deletion: {
            coreAttemptId: "attempt-1",
            deletedAt: "2026-06-19T10:00:00.000Z",
            reason: "Wrong file"
          }
        },
        processingError: null,
        questions: [],
        status: "ready_for_grading",
        structureValidationSummary: {},
        userId: "student-1",
        zipAttachmentId: "zip-1",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "submission-active",
        activityId: "activity-1",
        coreAttemptId: null,
        documentationSnapshotId: null,
        files: [],
        groupId: "group-1",
        kind: "final",
        metadata: {},
        processingError: null,
        questions: [],
        status: "challenge_ready",
        structureValidationSummary: {},
        userId: "student-1",
        zipAttachmentId: "zip-2",
        createdAt: now,
        updatedAt: now
      }
    ]);

    const result = await getLatestCodingHomeworkSubmission({
      activityId: "activity-1",
      courseId: "course-1",
      groupId: "group-1",
      user: testUser()
    });

    expect(result).toBeNull();
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

function createStoredZip(files: Array<{ path: string; content: string }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const content = Buffer.from(file.content, "utf8");
    const local = Buffer.alloc(30 + name.length + content.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    content.copy(local, 30 + name.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const locals = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(locals.length, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([locals, centralDirectory, eocd]);
}

async function sha256Hex(buffer: Buffer) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(buffer).digest("hex");
}
