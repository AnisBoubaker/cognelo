import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({ readFile: vi.fn() }));
const dbMocks = vi.hoisted(() => ({
  pluginCodingHomeworkAssignment: { findUnique: vi.fn() },
  pluginCodingHomeworkAttachment: { findMany: vi.fn() }
}));

vi.mock("node:fs/promises", () => fsMocks);
vi.mock("./authoring", () => ({ codingHomeworkAttachmentPath: (storedName: string) => `/storage/${storedName}` }));
vi.mock("./db-client", () => ({ prisma: dbMocks }));

const { getCodingHomeworkActivityReferenceDocuments } = await import("./activity-documents");

describe("coding homework activity reference documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.pluginCodingHomeworkAssignment.findUnique.mockResolvedValue({ promptMarkdown: "Implement the maze solver." });
    dbMocks.pluginCodingHomeworkAttachment.findMany.mockResolvedValue([
      {
        id: "provided-1",
        kind: "provided_file",
        originalName: "starter.c",
        storedName: "starter.c",
        mimeType: "text/x-c",
        sizeBytes: BigInt(80)
      }
    ]);
    fsMocks.readFile.mockResolvedValue(Buffer.from("int helper(int value) { return value + 1; }"));
  });

  it("extracts the assignment prompt and provided C functions as activity-owned references", async () => {
    const result = await getCodingHomeworkActivityReferenceDocuments("activity-1");

    expect(result.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "activity-1:assignment-prompt", text: "Implement the maze solver." }),
        expect.objectContaining({
          title: "starter.c: helper",
          metadata: expect.objectContaining({ functionCode: expect.stringContaining("int helper"), sourceKind: "provided_file" })
        })
      ])
    );
  });
});
