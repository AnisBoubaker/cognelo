import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStoredZip } from "../../../../tests/e2e/fixtures/zip";
const mocks = vi.hoisted(() => ({ files: vi.fn(), read: vi.fn() }));
vi.mock("./db-client", () => ({ prisma: { pluginCodingHomeworkAttachment: { findMany: mocks.files } } }));
vi.mock("./attachment-storage", () => ({ readProvidedAttachmentChunks: mocks.read }));
import { readCodingHomeworkZip } from "./zip";
import { baselineFromSources, cSourceFingerprint, excludesProvidedFunction, readProvidedCodeBaseline, selectLearnerFunctions, snapshotProvidedCode, unchangedProvidedFunctionNames } from "./provided-code";
const version = "a".repeat(64);
const source = (content: string, path = "starter.c") => ({ content, path, languageKey: "c" });

describe("provided-code exclusion", () => {
  beforeEach(() => vi.resetAllMocks());
  it("ignores formatting/comments but preserves every implementation token and literal", () => {
    const original = 'int provided_loader(int n) { /* note */ printf("http://example.test/*x*/"); return n + 7; }';
    expect(cSourceFingerprint(original)).toBe(cSourceFingerprint('int provided_loader ( int n ) {\n// different comment\nprintf("http://example.test/*x*/"); return n+7;\n}'));
    for (const changed of [original.replace("+ 7", "+ 8"), original.replace("+ 7", "- 7"), original.replace("/*x*/", "/*y*/"), original.replace("int n", "long n")]) expect(cSourceFingerprint(changed)).not.toBe(cSourceFingerprint(original));
    expect(cSourceFingerprint("return 'a';")).not.toBe(cSourceFingerprint("return 'b';"));
    expect(cSourceFingerprint("x++;")).not.toBe(cSourceFingerprint("x + + y;"));
  });
  it("excludes unchanged functions independently of their file path before applying candidate limits", async () => {
    const baseline = await baselineFromSources([source("int provided_loader(void) { return 7; }\nint provided_helper(void) { return 2; }")], version);
    const parsed = [
      { functionName: "provided_loader", functionCode: "int provided_loader (void) { return 7; }", sourcePath: "moved/loader.c" },
      { functionName: "provided_helper", functionCode: "int provided_helper(void) { return 2; }" },
      { functionName: "solve", functionCode: "int solve(void) { return 42; }" }
    ];
    const result = selectLearnerFunctions(parsed, baseline);
    expect(result.eligible.slice(0, 1).map(fn => fn.functionName)).toEqual(["solve"]);
    expect(result.excluded.map(fn => fn.functionName)).toEqual(["provided_loader", "provided_helper"]);
    expect(selectLearnerFunctions([{ functionName: "provided_loader", functionCode: "int provided_loader(void) { return 8; }" }], baseline).eligible).toHaveLength(1);
    expect(unchangedProvidedFunctionNames(baseline, [{ functionName: "provided_loader" }])).toEqual(["provided_helper"]);
  });
  it("reads only provided attachments, supports ZIP folders, skips binary/metadata, and reuses the same baseline", async () => {
    const zip = createStoredZip([
      { path: "starter/src/loader.c", contents: "int provided_loader(void) { return 7; }" },
      { path: "__MACOSX/._loader.c", contents: Buffer.from([0xff, 0]) },
      { path: "starter/program.exe", contents: "not C source" }
    ]);
    const rows = [{ id: "archive", originalName: "starter.zip", storedName: "archive", sha256: "1".repeat(64), sizeBytes: BigInt(zip.length), mimeType: "application/zip" }];
    mocks.files.mockResolvedValue(rows);
    mocks.read.mockImplementation(async function* () { yield zip; });
    const first = await snapshotProvidedCode("course-activity");
    expect(first.functions.map(fn => fn.name)).toEqual(["provided_loader"]);
    expect(mocks.files).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerKind: "course_activity", ownerId: "course-activity", kind: "provided_file" } }));
    expect(await snapshotProvidedCode("course-activity")).toEqual(first); expect(mocks.read).toHaveBeenCalledTimes(1);
    const updated = createStoredZip([{ path: "starter/src/loader.c", contents: "int provided_loader(void) { return 9; }" }]);
    mocks.files.mockResolvedValue([{ ...rows[0], sha256: "2".repeat(64), sizeBytes: BigInt(updated.length) }]);
    mocks.read.mockImplementation(async function* () { yield updated; });
    expect((await snapshotProvidedCode("course-activity")).functions[0].hash).not.toBe(first.functions[0].hash);
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });
  it("does not inflate unrelated ZIP binaries while ordinary upload validation stays strict", async () => {
    const zip = createStoredZip([{ path: "program.exe", contents: "binary" }, { path: "src/provided.c", contents: "int supplied(void) { return 1; }" }]);
    const directory = zip.readUInt32LE(zip.length - 6);
    zip.writeUInt32LE(9 * 1024 * 1024, directory + 24);
    expect(readCodingHomeworkZip(zip).diagnostics[0].code).toBe("ZIP_EXPANSION_LIMIT");
    mocks.files.mockResolvedValue([{ id: "large-binary", originalName: "bundle.zip", storedName: "bundle", sha256: "4".repeat(64), sizeBytes: BigInt(zip.length), mimeType: "application/zip" }]);
    mocks.read.mockImplementation(async function* () { yield zip; });
    expect((await snapshotProvidedCode("binary-archive-activity")).functions.map(fn => fn.name)).toEqual(["supplied"]);
  });
  it("retains literal values when C source is supplied as UTF-16", async () => {
    const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("int supplied(void) { return 7; }", "utf16le")]);
    mocks.files.mockResolvedValue([{ id: "utf16", originalName: "supplied.c", storedName: "utf16", sha256: "3".repeat(64), sizeBytes: BigInt(bytes.length), mimeType: null }]);
    mocks.read.mockImplementation(async function* () { yield bytes; });
    const baseline = await snapshotProvidedCode("wide-source-activity");
    expect(selectLearnerFunctions([{ functionName: "supplied", functionCode: "int supplied(void) { return 7; }" }], baseline).eligible).toHaveLength(0);
  });
  it("rejects explicit references to excluded functions without treating ordinary words as function names", () => {
    expect(excludesProvidedFunction("Explain provided_loader and its result.", ["provided_loader"])).toBe(true);
    expect(excludesProvidedFunction("Pourquoi la fonction main retourne zéro ?", ["main"])).toBe(true);
    expect(excludesProvidedFunction("Explain `main` in this code.", ["main"])).toBe(true);
    expect(excludesProvidedFunction("What does main() do?", ["main"])).toBe(true);
    expect(excludesProvidedFunction("Explain the main control flow of solve.", ["main"])).toBe(false);
    expect(excludesProvidedFunction("Dans `solve`, pourquoi vérifier le résultat de provided_loader ?", ["provided_loader"], "solve")).toBe(false);
    expect(excludesProvidedFunction("In solve, why check the result of provided_loader?", ["provided_loader"], "solve")).toBe(false);
    expect(excludesProvidedFunction("Explain provided_loader as used by `solve`.", ["provided_loader"], "solve")).toBe(true);
  });
  it("never silently replaces an invalid frozen baseline with current files", () => {
    expect(readProvidedCodeBaseline(undefined)).toBeNull();
    expect(() => readProvidedCodeBaseline({ version: 99 })).toThrow(/saved provided-code/);
  });
});
