import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStoredZip } from "../../../../tests/e2e/fixtures/zip";
const state = vi.hoisted(() => ({ directory: "", rows: [] as Array<{ id: string; ownerKind: string; ownerId: string; kind: string; originalName: string; storedName: string; mimeType: string | null; sizeBytes: bigint; sha256: string; metadata: Record<string, unknown> }>, files: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), lock: vi.fn() }));
vi.mock("./authoring", async () => { const { z } = await import("zod"); return { codingHomeworkFileUploadInputSchema: z.object({ base64: z.string(), fileName: z.string().min(1).max(240), mimeType: z.string().optional() }) }; });
vi.mock("./workflow-settings", () => ({ lockHomeworkSettings: state.lock }));
vi.mock("./teacher-solution", () => ({ lockHomeworkTeacherSolution: state.lock }));
vi.mock("./attachment-storage", () => ({ codingHomeworkAttachmentPath: (name: string) => path.join(state.directory, name), readProvidedAttachmentChunks: async function* (file: { storedName: string }) { yield await readFile(path.join(state.directory, file.storedName)); } }));
vi.mock("./db-client", () => {
  const table = { findMany: state.files, create: state.create, deleteMany: state.remove, update: state.update };
  return { prisma: { pluginCodingHomeworkAttachment: table, $transaction: async (run: (db: unknown) => Promise<unknown>) => {
    const before = state.rows.slice();
    try { return await run({ pluginCodingHomeworkAttachment: table }); } catch (error) { state.rows = before; throw error; }
  } } };
});
import { deleteHomeworkProvidedFiles, getHomeworkProvidedFile, getHomeworkProvidedFiles, uploadHomeworkProvidedFiles } from "./provided-files-workspace";
const owner = { ownerKind: "course_activity" as const, ownerId: "activity" };
const upload = (fileName: string, text: string) => ({ fileName, base64: Buffer.from(text).toString("base64") });
async function existing(originalName: string, bytes: Buffer, metadata: Record<string, unknown> = {}) {
  const storedName = randomUUID(); await writeFile(path.join(state.directory, storedName), bytes);
  state.rows.push({ ...owner, kind: "provided_file", id: randomUUID(), originalName, storedName, sizeBytes: BigInt(bytes.length), sha256: createHash("sha256").update(bytes).digest("hex"), mimeType: null, metadata });
}
describe("provided-file authoring workspace", () => {
  beforeAll(async () => { state.directory = await mkdtemp(path.join(os.tmpdir(), "cognelo-provided-files-")); });
  afterAll(async () => { await rm(state.directory, { recursive: true, force: true }); });
  beforeEach(() => {
    vi.resetAllMocks(); state.rows = [];
    state.files.mockImplementation(async ({ where }) => state.rows.filter(row => row.ownerKind === where.ownerKind && row.ownerId === where.ownerId && row.kind === where.kind));
    state.create.mockImplementation(async ({ data }) => { const row = { ...data, id: randomUUID() }; state.rows.push(row); return row; });
    state.remove.mockImplementation(async ({ where }) => { state.rows = state.rows.filter(row => row.ownerKind !== where.ownerKind || row.ownerId !== where.ownerId || row.kind !== where.kind || where.id?.notIn?.includes(row.id)); });
    state.update.mockImplementation(async ({ where, data }) => { const index = state.rows.findIndex(row => row.id === where.id); state.rows[index] = { ...state.rows[index], ...data }; return state.rows[index]; });
  });
  it("adds multiple files atomically and replaces the same path without losing other files", async () => {
    let workspace = await getHomeworkProvidedFiles(owner);
    workspace = await uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, files: [upload("main.c", "int main(void) { return 0; }"), upload("data.txt", "original")] });
    const revision = workspace.revision;
    workspace = await uploadHomeworkProvidedFiles(owner, { expectedRevision: revision, files: [upload("data.txt", "replacement")] });
    expect(workspace.files.map(file => file.path)).toEqual(["data.txt", "main.c"]);
    expect(await getHomeworkProvidedFile(owner, { path: "data.txt", revision: workspace.revision })).toMatchObject({ text: "replacement" });
    expect(await getHomeworkProvidedFile(owner, { path: "main.c", revision: workspace.revision })).toMatchObject({ text: "int main(void) { return 0; }" });
    await expect(deleteHomeworkProvidedFiles(owner, { all: true, expectedRevision: revision })).rejects.toMatchObject({ code: "HOMEWORK_PROVIDED_FILES_CHANGED" });
    expect(await getHomeworkProvidedFiles(owner)).toEqual(workspace);
  });
  it("reads legacy ZIP members without changing attachments, then preserves folders and bytes on edit", async () => {
    const bytes = createStoredZip([{ path: "starter/src/main.c", contents: "int provided(void) { return 7; }" }, { path: "starter/empty/", contents: "" }, { path: "__MACOSX/._main.c", contents: Buffer.from([0, 1]) }]);
    await existing("original.zip", bytes);
    const workspace = await getHomeworkProvidedFiles(owner);
    expect(workspace.files.map(file => file.path)).toEqual(["starter/src/main.c"]);
    expect(state.create).not.toHaveBeenCalled(); expect(state.remove).not.toHaveBeenCalled();
    expect(await getHomeworkProvidedFile(owner, { path: "starter/src/main.c", revision: workspace.revision })).toMatchObject({ text: "int provided(void) { return 7; }" });
    const next = await uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, files: [upload("notes.txt", "Keep the starter code.")] });
    expect(next.files.map(file => file.path)).toEqual(["notes.txt", "starter/src/main.c"]);
    expect(state.rows.flatMap(row => row.metadata.providedFolders ?? [])).toContain("starter/empty");
    expect(await getHomeworkProvidedFile(owner, { path: "starter/src/main.c", revision: next.revision })).toMatchObject({ text: "int provided(void) { return 7; }" });
  });
  it("replaces the collection with ZIP contents and permits removing one member or all files", async () => {
    await existing("old.c", Buffer.from("int old;"));
    let workspace = await getHomeworkProvidedFiles(owner);
    const zip = createStoredZip([{ path: "src/new.c", contents: "int fresh;" }, { path: "src/new.h", contents: "extern int fresh;" }]);
    workspace = await uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, replaceAll: true, files: [{ fileName: "provided.zip", base64: zip.toString("base64") }] });
    expect(workspace.files.map(file => file.path)).toEqual(["src/new.c", "src/new.h"]);
    workspace = await deleteHomeworkProvidedFiles(owner, { path: "src/new.c", expectedRevision: workspace.revision });
    expect(workspace.files.map(file => file.path)).toEqual(["src/new.h"]);
    expect((await deleteHomeworkProvidedFiles(owner, { all: true, expectedRevision: workspace.revision })).files).toEqual([]);
  });
  it("rejects unsafe archives, duplicate inputs and file/folder conflicts without replacing the collection", async () => {
    await existing("original.c", Buffer.from("int original;"));
    const workspace = await getHomeworkProvidedFiles(owner);
    const zip = createStoredZip([{ path: "../secret.c", contents: "bad" }]);
    await expect(uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, replaceAll: true, files: [{ fileName: "unsafe.zip", base64: zip.toString("base64") }] })).rejects.toMatchObject({ status: 400 });
    await expect(uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, files: [upload("same.c", "first"), upload("SAME.c", "second")] })).rejects.toMatchObject({ status: 400 });
    const conflict = createStoredZip([{ path: "src", contents: "file" }, { path: "src/main.c", contents: "int x;" }]);
    await expect(uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, replaceAll: true, files: [{ fileName: "conflict.zip", base64: conflict.toString("base64") }] })).rejects.toMatchObject({ status: 400 });
    expect(await getHomeworkProvidedFiles(owner)).toEqual(workspace);
  });
  it("keeps binary bytes intact, handles UTF-16 previews and rejects stale file reads", async () => {
    const binary = Buffer.from([0, 1, 2, 3]); await existing("data.bin", binary);
    await existing("header.h", Buffer.concat([Buffer.from([255, 254]), Buffer.from("int fonction(void);", "utf16le")]));
    const workspace = await getHomeworkProvidedFiles(owner);
    expect(await getHomeworkProvidedFile(owner, { path: "data.bin", revision: workspace.revision })).toMatchObject({ previewUnavailable: true });
    expect(await getHomeworkProvidedFile(owner, { path: "header.h", revision: workspace.revision })).toMatchObject({ text: "int fonction(void);" });
    await expect(getHomeworkProvidedFile(owner, { path: "header.h", revision: "0".repeat(64) })).rejects.toMatchObject({ status: 409 });
    await expect(getHomeworkProvidedFile({ ...owner, ownerId: "other" }, { path: "data.bin", revision: workspace.revision })).rejects.toMatchObject({ status: 409 });
  });
  it("accepts empty starter files and preserves unrelated attachment identities", async () => {
    await existing("provided.h", Buffer.from("int provided(void);"));
    const original = state.rows[0];
    const workspace = await getHomeworkProvidedFiles(owner);
    const next = await uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, files: [upload("empty.c", "")] });
    expect(next.files.find(file => file.path === "empty.c")).toMatchObject({ sizeBytes: 0 });
    expect(state.rows.find(row => row.id === original.id)).toMatchObject({ storedName: original.storedName, sha256: original.sha256 });
    expect(await getHomeworkProvidedFile(owner, { path: "empty.c", revision: next.revision })).toMatchObject({ text: "", previewUnavailable: false });
  });
  it("rolls back a failed or cancelled replacement", async () => {
    await existing("original.c", Buffer.from("int original;"));
    const workspace = await getHomeworkProvidedFiles(owner);
    state.create.mockRejectedValueOnce(new Error("database failure"));
    await expect(uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, files: [upload("new.c", "int x;")] })).rejects.toThrow("database failure");
    expect(await getHomeworkProvidedFiles(owner)).toEqual(workspace);
    const pending = new AbortController(); pending.abort();
    await expect(uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, files: [upload("new.c", "int x;")] }, pending.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(await getHomeworkProvidedFiles(owner)).toEqual(workspace);
    const before = (await readdir(state.directory)).sort();
    const duringWrite = new AbortController();
    state.create.mockImplementationOnce(async ({ data }) => { const row = { ...data, id: randomUUID() }; state.rows.push(row); duringWrite.abort(); return row; });
    await expect(uploadHomeworkProvidedFiles(owner, { expectedRevision: workspace.revision, files: [upload("new.c", "int x;")] }, duringWrite.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(await getHomeworkProvidedFiles(owner)).toEqual(workspace);
    expect((await readdir(state.directory)).sort()).toEqual(before);
  });
});
