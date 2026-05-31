import { describe, expect, it } from "vitest";
import { readCodingHomeworkZip } from "./zip";

describe("coding homework ZIP reader", () => {
  it("reads safe stored ZIP entries", () => {
    const zip = createStoredZip([
      { path: "src/main.c", content: "int main(void) { return 0; }" },
      { path: "README.md", content: "notes" }
    ]);

    const result = readCodingHomeworkZip(zip);

    expect(result.diagnostics).toEqual([]);
    expect(result.entries.map((entry) => [entry.path, entry.content?.toString("utf8")])).toEqual([
      ["src/main.c", "int main(void) { return 0; }"],
      ["README.md", "notes"]
    ]);
  });

  it("rejects unsafe paths without throwing", () => {
    const zip = createStoredZip([{ path: "../secret.c", content: "int main(void) { return 0; }" }]);

    expect(readCodingHomeworkZip(zip).diagnostics).toEqual([
      {
        code: "ZIP_FORBIDDEN_PATH",
        message: "The archive contains an unsafe or empty path.",
        path: "../secret.c",
        severity: "error"
      }
    ]);
  });

  it("rejects symbolic links", () => {
    const zip = createStoredZip([{ path: "src/link.c", content: "src/main.c", externalAttributes: 0o120000 * 0x10000 }]);

    expect(readCodingHomeworkZip(zip).diagnostics).toEqual([
      {
        code: "ZIP_SYMLINK_ENTRY",
        message: "Symbolic links are not supported in homework archives.",
        path: "src/link.c",
        severity: "error"
      }
    ]);
  });
});

function createStoredZip(files: Array<{ path: string; content: string; externalAttributes?: number }>) {
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
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(file.externalAttributes ?? 0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const locals = Buffer.concat(localParts);
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
