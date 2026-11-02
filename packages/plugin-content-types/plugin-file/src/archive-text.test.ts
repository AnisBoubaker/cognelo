import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createStoredZip } from "../../../../tests/e2e/fixtures/zip";
import { readArchiveText } from "./archive-text";
import { extractPreparedFileBytes } from "./server";
const resource = { id: "material", courseId: "course", title: "Starter files", contentTypeKey: "file", pluginKey: "file-content", metadata: { originalName: "starter.zip", mimeType: "application/zip" } };
const centralOffset = (bytes: Buffer) => bytes.readUInt32LE(bytes.length - 6);

function deflatedZip(path: string, contents: string) {
  const archive = createStoredZip([{ path, contents }]);
  const directory = centralOffset(archive), nameSize = Buffer.byteLength(path);
  const compressed = deflateRawSync(Buffer.from(contents));
  const local = Buffer.from(archive.subarray(0, 30 + nameSize)); local.writeUInt16LE(8, 8); local.writeUInt32LE(compressed.length, 18);
  const central = Buffer.from(archive.subarray(directory, archive.length - 22)); central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20);
  const end = Buffer.from(archive.subarray(-22)); end.writeUInt32LE(local.length + compressed.length, 16);
  return Buffer.concat([local, compressed, central, end]);
}

describe("prepared ZIP teaching materials", () => {
  it("extracts nested source/text with provenance while ignoring executables and metadata", async () => {
    const archive = createStoredZip([
      { path: "starter/src/main.c", contents: "int add(int x) { return x + 1; }" },
      { path: "starter/inputs/map.txt", contents: "001\n010" },
      { path: "starter/program.exe", contents: Buffer.from([0, 1, 2]) },
      { path: "__MACOSX/._main.c", contents: Buffer.from([0, 1, 2]) },
      { path: "starter/build/generated.c", contents: "ignore generated" },
      { path: "starter/nested.zip", contents: "ignore nested" }
    ]);
    const result = await extractPreparedFileBytes(resource, archive);
    expect(result.documents).toMatchObject([
      { path: "starter/src/main.c", sourceId: "material", kind: "code", languageKey: "c", text: "int add(int x) { return x + 1; }" },
      { path: "starter/inputs/map.txt", sourceId: "material", text: "001\n010" }
    ]);
    expect(new Set(result.documents.map(document => document.id)).size).toBe(2);
  });
  it("supports deflate and BOM-marked UTF-16 source", () => {
    expect(readArchiveText(deflatedZip("main.c", "int main(void) { return 0; }"))[0].text).toContain("return 0");
    const content = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("int x = 1;", "utf16le")]);
    expect(readArchiveText(createStoredZip([{ path: "wide.c", contents: content }]))[0].text).toBe("int x = 1;");
  });
  it.each(["../escape.c", "/absolute.c", "C:/absolute.c"])("rejects unsafe paths: %s", path => {
    expect(() => readArchiveText(createStoredZip([{ path, contents: "int x;" }]))).toThrow(/unsafe file path/);
  });
  it("rejects symbolic links, encryption, duplicates and altered checksums", () => {
    for (const field of ["symlink", "encrypted", "checksum"] as const) {
      const bytes = createStoredZip([{ path: "main.c", contents: "int x;" }]); const at = centralOffset(bytes);
      if (field === "symlink") bytes.writeUInt32LE(0o120777 * 0x10000, at + 38);
      if (field === "encrypted") bytes.writeUInt16LE(1, at + 8);
      if (field === "checksum") bytes.writeUInt32LE(0, at + 16);
      expect(() => readArchiveText(bytes)).toThrow();
    }
    expect(() => readArchiveText(createStoredZip([{ path: "main.c", contents: "a" }, { path: "MAIN.c", contents: "b" }]))).toThrow(/duplicate/);
  });
  it("bounds expansion even when directory sizes lie", () => {
    const bytes = deflatedZip("large.txt", "x".repeat(600_000));
    expect(() => readArchiveText(bytes)).toThrow(/extraction limit/);
    bytes.writeUInt32LE(1, centralOffset(bytes) + 24);
    expect(() => readArchiveText(bytes)).toThrow(/decompressed/);
    expect(() => readArchiveText(createStoredZip(Array.from({ length: 201 }, (_, index) => ({ path: `file-${index}.c`, contents: "int x;" }))))).toThrow(/extraction limit/);
  });
  it("rejects invalid text, truncated archives and cancellation before returning partial content", () => {
    expect(() => readArchiveText(createStoredZip([{ path: "main.c", contents: Buffer.from([0xff, 0]) }]))).toThrow(/not readable/);
    expect(() => readArchiveText(createStoredZip([{ path: "main.c", contents: "a\u0000b" }]))).toThrow(/binary data/);
    expect(() => readArchiveText(Buffer.from("PK"))).toThrow(/not a readable ZIP/);
    expect(() => readArchiveText(createStoredZip([{ path: "main.c", contents: "int x;" }]), AbortSignal.abort())).toThrow();
  });
  it("explains binary-only archives and unsupported files instead of an empty-text error", async () => {
    await expect(extractPreparedFileBytes(resource, createStoredZip([{ path: "program.exe", contents: "binary" }]))).rejects.toMatchObject({ code: "MATERIAL_ZIP_NO_TEXT" });
    await expect(extractPreparedFileBytes({ ...resource, metadata: { originalName: "photo.png", mimeType: "image/png" } }, Buffer.from("image"))).rejects.toMatchObject({ code: "MATERIAL_FILE_UNSUPPORTED" });
  });
});
