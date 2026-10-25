import { inflateRawSync } from "node:zlib";

export type CodingHomeworkZipEntry = {
  compressedSize: number;
  content: Buffer | null;
  isDirectory: boolean;
  path: string;
  uncompressedSize: number;
};

export type CodingHomeworkZipReadResult = {
  diagnostics: Array<{
    code: string;
    message: string;
    path?: string;
    severity: "error" | "warning";
  }>;
  entries: CodingHomeworkZipEntry[];
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH_BYTES = 65_557;

export function readCodingHomeworkZip(bytes: Buffer, limits: { maxArchiveBytes?: number; maxFileCount?: number; ignoredPaths?: string[] } = {}): CodingHomeworkZipReadResult {
  const fail = (code: string, message: string): CodingHomeworkZipReadResult => ({ entries: [], diagnostics: [{ code, message, severity: "error" }] });
  if (bytes.length > Math.min(limits.maxArchiveBytes ?? 25 * 1024 * 1024, 25 * 1024 * 1024)) return fail("ZIP_ARCHIVE_LIMIT", "The archive exceeds the upload limit.");
  const pending: Array<{ compressedSize: number; localHeaderOffset: number; method: number; path: string; uncompressedSize: number }> = [];
  const paths = new Set<string>();
  let expandedBytes = 0, activeFileCount = 0;
  const diagnostics: CodingHomeworkZipReadResult["diagnostics"] = [];
  const entries: CodingHomeworkZipEntry[] = [];
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) {
    return {
      entries,
      diagnostics: [
        {
          code: "ZIP_EOCD_NOT_FOUND",
          message: "The uploaded file is not a readable ZIP archive.",
          severity: "error"
        }
      ]
    };
  }

  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = bytes.readUInt32LE(eocdOffset + 16);
  const directorySize = bytes.readUInt32LE(eocdOffset + 12);
  const directoryEnd = centralDirectoryOffset + directorySize;
  if (bytes.readUInt16LE(eocdOffset + 4) || bytes.readUInt16LE(eocdOffset + 6) || bytes.readUInt16LE(eocdOffset + 8) !== entryCount || directoryEnd > eocdOffset) return fail("ZIP_DIRECTORY_INVALID", "Multi-volume, ZIP64, or invalid directory layouts are not supported.");
  if (entryCount > 1000) return fail("ZIP_FILE_COUNT_LIMIT", "The archive contains too many entries.");
  let offset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (offset + 46 > directoryEnd || bytes.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      diagnostics.push({
        code: "ZIP_CENTRAL_DIRECTORY_INVALID",
        message: "The ZIP central directory is incomplete or invalid.",
        severity: "error"
      });
      break;
    }

    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const externalAttributes = bytes.readUInt32LE(offset + 38);
    const localHeaderOffset = bytes.readUInt32LE(offset + 42);
    if (offset + 46 + fileNameLength + extraLength + commentLength > directoryEnd) return fail("ZIP_DIRECTORY_INVALID", "The archive directory is truncated.");
    expandedBytes += uncompressedSize;
    if (uncompressedSize > 8 * 1024 * 1024 || expandedBytes > 64 * 1024 * 1024 || (uncompressedSize > 32768 && uncompressedSize > Math.max(1, compressedSize) * 200)) return fail("ZIP_EXPANSION_LIMIT", "The archive exceeds expanded-size or compression limits.");
    const rawPath = bytes.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const path = normalizeZipPath(rawPath);
    const isDirectory = rawPath.endsWith("/");
    const ignored = path && (limits.ignoredPaths ?? []).some((value) => {
      const ignoredPath = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      return path === ignoredPath || path.startsWith(`${ignoredPath}/`);
    });
    if (!isDirectory && !ignored && ++activeFileCount > Math.min(limits.maxFileCount ?? 1000, 1000)) return fail("ZIP_FILE_COUNT_LIMIT", "The archive contains too many files.");

    if (path && paths.has(path.toLowerCase())) return fail("ZIP_DUPLICATE_PATH", "The archive contains duplicate file paths.");
    if (path) paths.add(path.toLowerCase());
    if (!path) {
      diagnostics.push({
        code: "ZIP_FORBIDDEN_PATH",
        message: "The archive contains an unsafe or empty path.",
        path: rawPath,
        severity: "error"
      });
    } else if (isSymbolicLinkExternalAttribute(externalAttributes)) {
      diagnostics.push({
        code: "ZIP_SYMLINK_ENTRY",
        message: "Symbolic links are not supported in homework archives.",
        path,
        severity: "error"
      });
    } else if (flags & 1) {
      diagnostics.push({
        code: "ZIP_ENCRYPTED_ENTRY",
        message: "Encrypted ZIP entries are not supported.",
        path,
        severity: "error"
      });
    } else if (isDirectory) {
      entries.push({ compressedSize, content: null, isDirectory, path, uncompressedSize });
    } else if (method !== 0 && method !== 8) {
      diagnostics.push({
        code: "ZIP_UNSUPPORTED_COMPRESSION",
        message: "This ZIP entry uses an unsupported compression method.",
        path,
        severity: "error"
      });
    } else {
      pending.push({ compressedSize, localHeaderOffset, method, path, uncompressedSize });
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  if (diagnostics.some((issue) => issue.severity === "error")) return { diagnostics, entries: [] };
  // Validate all directory sizes before allocating any expanded content. zlib's
  // output ceiling also stops streams whose directory metadata lies about size.
  for (const entry of pending) {
    const content = readZipEntryContent(bytes.subarray(0, centralDirectoryOffset), entry);
    if (content.diagnostic) return { diagnostics: [content.diagnostic], entries: [] };
    entries.push({ ...entry, content: content.bytes, isDirectory: false });
  }
  return { diagnostics, entries };
}

function readZipEntryContent(
  bytes: Buffer,
  input: {
    compressedSize: number;
    localHeaderOffset: number;
    method: number;
    path: string;
    uncompressedSize: number;
  }
) {
  if (input.localHeaderOffset + 30 > bytes.length || bytes.readUInt32LE(input.localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    return {
      bytes: null,
      diagnostic: {
        code: "ZIP_LOCAL_HEADER_INVALID",
        message: "The ZIP local file header is incomplete or invalid.",
        path: input.path,
        severity: "error" as const
      }
    };
  }

  const fileNameLength = bytes.readUInt16LE(input.localHeaderOffset + 26);
  const extraLength = bytes.readUInt16LE(input.localHeaderOffset + 28);
  const localName = bytes.subarray(input.localHeaderOffset + 30, input.localHeaderOffset + 30 + fileNameLength).toString("utf8");
  if (normalizeZipPath(localName) !== input.path || bytes.readUInt16LE(input.localHeaderOffset + 8) !== input.method || (bytes.readUInt16LE(input.localHeaderOffset + 6) & 1)) {
    return { bytes: null, diagnostic: { code: "ZIP_LOCAL_HEADER_MISMATCH", message: "The local ZIP header does not match the directory.", path: input.path, severity: "error" as const } };
  }
  const dataStart = input.localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + input.compressedSize;
  if (dataEnd > bytes.length) {
    return {
      bytes: null,
      diagnostic: {
        code: "ZIP_ENTRY_TRUNCATED",
        message: "A ZIP entry is truncated.",
        path: input.path,
        severity: "error" as const
      }
    };
  }

  const compressed = bytes.slice(dataStart, dataEnd);
  try {
    const content = input.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, input.uncompressedSize) });
    if (content.length !== input.uncompressedSize) {
      return {
        bytes: null,
        diagnostic: {
          code: "ZIP_ENTRY_SIZE_MISMATCH",
          message: "A ZIP entry size did not match its directory metadata.",
          path: input.path,
          severity: "error" as const
        }
      };
    }
    return { bytes: content, diagnostic: null };
  } catch {
    return {
      bytes: null,
      diagnostic: {
        code: "ZIP_ENTRY_DECOMPRESSION_FAILED",
        message: "A ZIP entry could not be decompressed.",
        path: input.path,
        severity: "error" as const
      }
    };
  }
}

function findEndOfCentralDirectory(bytes: Buffer) {
  const start = Math.max(0, bytes.length - MAX_EOCD_SEARCH_BYTES);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (bytes.readUInt32LE(offset) === EOCD_SIGNATURE && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {
      return offset;
    }
  }
  return -1;
}

function normalizeZipPath(path: string) {
  if (path.length > 500 || /^[\\/]|^[A-Za-z]:/.test(path) || /[\x00-\x1f\x7f]/.test(path)) return null;
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").split("/").filter(Boolean);
  if (!normalized.length || normalized.some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  return normalized.join("/");
}

function isSymbolicLinkExternalAttribute(externalAttributes: number) {
  const unixMode = externalAttributes >>> 16;
  return (unixMode & 0o170000) === 0o120000;
}
