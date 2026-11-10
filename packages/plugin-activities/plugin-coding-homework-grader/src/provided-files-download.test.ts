import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { createHash } from "node:crypto";
import { unzipSync, zipSync, strToU8 } from "fflate";
const mocks = vi.hoisted(() => ({ files: vi.fn(), open: vi.fn(), close: vi.fn(), read: vi.fn() }));
vi.mock("./db-client", () => ({ prisma: { pluginCodingHomeworkAttachment: { findMany: mocks.files } } }));
vi.mock("./authoring", () => ({ codingHomeworkAttachmentPath: (name: string) => name }));
vi.mock("node:fs/promises", () => ({ open: mocks.open }));
import { downloadHomeworkProvidedFiles, providedArchiveNames } from "./provided-files-download";
const owner = { ownerKind: "course_activity" as const, ownerId: "activity" };
function attachment(name: string, content: Buffer, mimeType = "text/plain") {
  return { originalName: name, storedName: name, sizeBytes: BigInt(content.length), sha256: createHash("sha256").update(content).digest("hex"), mimeType };
}
function readableFiles(entries: Array<{ originalName: string; storedName: string; sizeBytes: bigint; sha256: string; mimeType: string | null; metadata?: unknown }>, contents: Buffer[]) {
  mocks.files.mockResolvedValue(entries);
  mocks.open.mockImplementation(async (filePath: string) => {
    const bytes = contents[entries.findIndex(entry => entry.storedName === path.basename(filePath))];
    return { stat: async () => ({ isFile: () => true, size: bytes.length }), close: mocks.close,
      read: async (target: Buffer, offset: number, length: number, position: number) => { mocks.read(length); const count = bytes.copy(target, offset, position, position + length); return { bytesRead: count }; }
    };
  });
}
describe("provided file downloads", () => {
  beforeEach(() => vi.resetAllMocks());
  it("builds one ZIP from only owner-scoped provided files and reads in bounded chunks", async () => {
    const contents = [Buffer.from("int x;"), Buffer.from("b".repeat(150_000))];
    readableFiles([attachment("main.c", contents[0]), attachment("notes.txt", contents[1])], contents);
    const response = await downloadHomeworkProvidedFiles(owner);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(files)).toEqual(["main.c", "notes.txt"]);
    expect(Buffer.from(files["main.c"])).toEqual(contents[0]); expect(Buffer.from(files["notes.txt"])).toEqual(contents[1]);
    expect(mocks.files).toHaveBeenCalledWith(expect.objectContaining({ where: { ...owner, kind: "provided_file" } }));
    expect(mocks.read.mock.calls.every(([size]) => size <= 64 * 1024)).toBe(true);
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });
  it("returns an already-provided single ZIP without nesting it", async () => {
    const original = Buffer.from(zipSync({ "src/main.c": strToU8("int x;") }));
    readableFiles([attachment("starter.zip", original, "application/zip")], [original]);
    const response = await downloadHomeworkProvidedFiles(owner);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(original);
    expect(response.headers.get("content-disposition")).toContain("starter.zip");
  });
  it("packages legacy provided files whose MIME type is unset", async () => {
    const bytes = Buffer.from("legacy teaching content");
    readableFiles([{ ...attachment("notes.txt", bytes), mimeType: null }], [bytes]);
    const response = await downloadHomeworkProvidedFiles(owner);
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Buffer.from(archive["notes.txt"])).toEqual(bytes);
  });
  it("uses safe unique filenames without dropping duplicate attachments", () => {
    expect(providedArchiveNames(["../main.c", "main.c", "MAIN.c", "..", "C:\\folder\\data.txt", "C:drive.c"].map(originalName => ({ originalName })))).toEqual(["main.c", "main (2).c", "MAIN (3).c", "provided-file", "data.txt", "C_drive.c"]);
  });
  it("preserves validated editor paths, empty folders and binary bytes", async () => {
    const bytes = Buffer.from([0, 5, 22, 7]);
    readableFiles([{ ...attachment("data.bin", bytes), metadata: { providedPath: "assets/data.bin", providedFolders: ["empty"] } }], [bytes]);
    const response = await downloadHomeworkProvidedFiles(owner);
    const members = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(members)).toEqual(["empty/", "assets/data.bin"]);
    expect(Buffer.from(members["assets/data.bin"])).toEqual(bytes);
    expect(() => providedArchiveNames([{ originalName: "bad.c", metadata: { providedPath: "../secret.c" } }])).toThrow("invalid stored path");
  });
  it("rejects missing or oversized collections before reading files", async () => {
    mocks.files.mockResolvedValue([]);
    await expect(downloadHomeworkProvidedFiles(owner)).rejects.toMatchObject({ status: 404 });
    mocks.files.mockResolvedValue([{ ...attachment("large.c", Buffer.from("x")), sizeBytes: BigInt(26 * 1024 * 1024) }]);
    await expect(downloadHomeworkProvidedFiles(owner)).rejects.toMatchObject({ status: 413 });
    const small = attachment("file.c", Buffer.from("x"));
    mocks.files.mockResolvedValue(Array(1001).fill(small));
    await expect(downloadHomeworkProvidedFiles(owner)).rejects.toMatchObject({ status: 413 });
    mocks.files.mockResolvedValue(Array(11).fill({ ...small, sizeBytes: BigInt(25 * 1024 * 1024) }));
    await expect(downloadHomeworkProvidedFiles(owner)).rejects.toMatchObject({ status: 413 });
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("fails closed on altered bytes and closes the open file", async () => {
    readableFiles([{ ...attachment("main.c", Buffer.from("int x;")), sha256: "0".repeat(64) }], [Buffer.from("int x;")]);
    const response = await downloadHomeworkProvidedFiles(owner);
    await expect(response.arrayBuffer()).rejects.toThrow(/integrity check/);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
});
