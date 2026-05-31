import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn()
}));

const dbMocks = vi.hoisted(() => ({
  pluginCodingHomeworkAttachment: {
    create: vi.fn()
  },
  pluginCodingHomeworkSubmission: {
    create: vi.fn(),
    update: vi.fn()
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

const { runCodingHomeworkPreflight } = await import("./preflight");

describe("coding homework preflight uploads", () => {
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
    dbMocks.pluginCodingHomeworkSubmission.create.mockResolvedValue({
      id: "preflight-1",
      activityId: "activity-1",
      groupId: "group-1",
      userId: "student-1",
      kind: "preflight",
      status: "structure_valid",
      createdAt: new Date("2026-05-28T12:00:00.000Z"),
      updatedAt: new Date("2026-05-28T12:00:00.000Z")
    });
    dbMocks.pluginCodingHomeworkAttachment.create.mockResolvedValue({
      id: "attachment-1"
    });
    dbMocks.pluginCodingHomeworkSubmission.update.mockResolvedValue({});
  });

  it("validates a ZIP and stores a temporary preflight record", async () => {
    const result = await runCodingHomeworkPreflight(
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
    expect(result.preflight).toMatchObject({
      id: "preflight-1",
      kind: "preflight",
      status: "structure_valid",
      zipAttachmentId: "attachment-1"
    });
    expect(dbMocks.pluginCodingHomeworkSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityId: "activity-1",
        groupId: "group-1",
        kind: "preflight",
        status: "structure_valid",
        metadata: expect.objectContaining({ temporary: true }),
        structureValidationSummary: expect.objectContaining({ isValid: true })
      })
    });
    expect(dbMocks.pluginCodingHomeworkAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerKind: "submission",
        ownerId: "preflight-1",
        kind: "submission_zip",
        originalName: "submission.zip",
        metadata: { temporary: true }
      })
    });
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
