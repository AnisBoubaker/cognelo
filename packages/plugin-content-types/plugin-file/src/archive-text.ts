import { inflateRawSync } from "node:zlib";
import { AppError } from "@cognelo/core";

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_BYTES = 512 * 1024;
const MAX_TOTAL_TEXT_BYTES = 4 * 1024 * 1024;
const textExtension = /\.(c|cc|cpp|cxx|h|hpp|hxx|css|csv|html?|java|js|jsx|json|md|markdown|py|rs|go|rb|sh|sql|ts|tsx|txt|xml|yaml|yml)$/i;
export const isArchiveTextPath = (name: string) => textExtension.test(name) && !name.split("/").some(part => part.startsWith(".") || ["__MACOSX", "node_modules", "vendor", "dist", "build"].includes(part));
const invalid = (message: string): never => { throw new AppError(422, "MATERIAL_ZIP_INVALID", message); };

/** Reads bounded source/text entries in memory. Never extracts to disk or executes archive content. */
export function readArchiveText(bytes: Buffer, signal?: AbortSignal) {
  if (bytes.length > MAX_ARCHIVE_BYTES) invalid("The ZIP exceeds the 25 MB material limit.");
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65_557); at--) {
    if (bytes.readUInt32LE(at) === 0x06054b50 && at + 22 + bytes.readUInt16LE(at + 20) === bytes.length) { end = at; break; }
  }
  if (end < 0) invalid("This material is not a readable ZIP archive.");
  const count = bytes.readUInt16LE(end + 10), directory = bytes.readUInt32LE(end + 16), directoryEnd = directory + bytes.readUInt32LE(end + 12);
  if (count > 1000 || directoryEnd !== end || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count) invalid("The ZIP has too many entries or an unsupported multi-volume/ZIP64 layout.");
  const pending: Array<{ path: string; offset: number; compressed: number; expanded: number; method: number; checksum: number; flags: number }> = [];
  const paths = new Set<string>();
  let cursor = directory, total = 0;
  for (let index = 0; index < count; index++) {
    signal?.throwIfAborted();
    if (cursor + 46 > directoryEnd || bytes.readUInt32LE(cursor) !== 0x02014b50) invalid("The ZIP directory is truncated or invalid.");
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const compressed = bytes.readUInt32LE(cursor + 20), expanded = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > directoryEnd || bytes.readUInt16LE(cursor + 34)) invalid("The ZIP directory is truncated or spans multiple disks.");
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8").replace(/\\/g, "/");
    if (!name || name.length > 500 || /^[\/]|^[A-Za-z]:/.test(name) || /[\x00-\x1f\x7f\ufffd]/.test(name) || name.split("/").some(part => part === ".." || part === ".")) invalid("The ZIP contains an unsafe file path.");
    const mode = bytes.readUInt32LE(cursor + 38) >>> 16;
    if ((mode & 0o170000) === 0o120000) invalid("Symbolic links are not supported in material ZIPs.");
    if (flags & 1) invalid("Encrypted ZIP files are not supported. Upload an unencrypted archive.");
    if (!name.endsWith("/") && isArchiveTextPath(name)) {
      if (paths.has(name.toLowerCase())) invalid("The ZIP contains duplicate source/text paths.");
      paths.add(name.toLowerCase()); total += expanded;
      if (paths.size > 200 || expanded > MAX_TEXT_BYTES || total > MAX_TOTAL_TEXT_BYTES) invalid("The ZIP exceeds the extraction limit: 200 text files, 512 KB per file and 4 MB of text in total.");
      if (method !== 0 && method !== 8) invalid("A source/text file uses an unsupported ZIP compression method.");
      pending.push({ path: name, offset: bytes.readUInt32LE(cursor + 42), compressed, expanded, method, checksum: bytes.readUInt32LE(cursor + 16), flags });
    }
    cursor = next;
  }
  if (cursor !== directoryEnd) invalid("The ZIP directory size does not match its entries.");
  const documents: Array<{ path: string; text: string }> = [];
  for (const entry of pending) {
    signal?.throwIfAborted();
    const at = entry.offset;
    if (at + 30 > directory || bytes.readUInt32LE(at) !== 0x04034b50) invalid("A ZIP source/text header is invalid.");
    const nameLength = bytes.readUInt16LE(at + 26), dataStart = at + 30 + nameLength + bytes.readUInt16LE(at + 28);
    const name = bytes.subarray(at + 30, at + 30 + nameLength).toString("utf8").replace(/\\/g, "/");
    if (dataStart + entry.compressed > directory || name !== entry.path || bytes.readUInt16LE(at + 8) !== entry.method || bytes.readUInt16LE(at + 6) !== entry.flags) invalid("A ZIP source/text header does not match its directory.");
    let content: Buffer;
    try {
      const compressed = bytes.subarray(dataStart, dataStart + entry.compressed);
      content = entry.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.expanded) });
    } catch { invalid("A ZIP source/text file could not be decompressed within its declared size."); }
    if (content!.length !== entry.expanded || crc32(content!) !== entry.checksum) invalid("A ZIP source/text file failed its size or checksum check.");
    let text: string;
    try {
      const encoding = content![0] === 0xff && content![1] === 0xfe ? "utf-16le" : content![0] === 0xfe && content![1] === 0xff ? "utf-16be" : "utf-8";
      text = new TextDecoder(encoding, { fatal: true }).decode(content!);
    } catch { invalid("A source/text file in this ZIP is not readable UTF-8 or BOM-marked UTF-16. Convert it to UTF-8 and upload it again."); }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text!)) invalid("A source/text file in this ZIP contains binary data.");
    if (text!.trim()) documents.push({ path: entry.path, text: text!.trim() });
  }
  return documents;
}

function crc32(bytes: Buffer) {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit++) checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}
