import { deflateRawSync } from "node:zlib";
import { expect, it } from "vitest";
import { readCodingHomeworkZip } from "./zip";

function archive(name: string, content: Buffer, advertised = content.length) {
  const nameBytes = Buffer.from(name), compressed = deflateRawSync(content);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt16LE(nameBytes.length, 26);
  const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(8, 10); directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(advertised, 24); directory.writeUInt16LE(nameBytes.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + nameBytes.length, 12); end.writeUInt32LE(30 + nameBytes.length + compressed.length, 16);
  return Buffer.concat([local, nameBytes, compressed, directory, nameBytes, end]);
}
it("rejects advertised oversized entries and deceptive compressed streams", () => {
  expect(readCodingHomeworkZip(archive("file.c", Buffer.from("safe"), 100_000_000)).diagnostics[0].code).toBe("ZIP_EXPANSION_LIMIT");
  expect(readCodingHomeworkZip(archive("file.c", Buffer.alloc(100_000, 65), 1)).entries).toEqual([]);
  expect(readCodingHomeworkZip(archive("file.c", Buffer.alloc(100_000, 65))).diagnostics[0].code).toBe("ZIP_EXPANSION_LIMIT");
});
it("rejects absolute/traversing names and accepts a bounded ordinary source", () => {
  for (const name of ["/root/file", "../file", "C:\\file", "nested/../file", "nul\0file"]) expect(readCodingHomeworkZip(archive(name, Buffer.from("safe"))).entries).toEqual([]);
  expect(readCodingHomeworkZip(archive("src/main.c", Buffer.from("int main(void) { return 0; }"))).entries[0].path).toBe("src/main.c");
});
