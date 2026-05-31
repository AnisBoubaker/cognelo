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

export function readCodingHomeworkZip(bytes: Buffer): CodingHomeworkZipReadResult {
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
  let offset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
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
    const rawPath = bytes.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const path = normalizeZipPath(rawPath);
    const isDirectory = rawPath.endsWith("/");

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
      const content = readZipEntryContent(bytes, {
        compressedSize,
        localHeaderOffset,
        method,
        path,
        uncompressedSize
      });
      if (content.diagnostic) {
        diagnostics.push(content.diagnostic);
      } else {
        entries.push({ compressedSize, content: content.bytes, isDirectory, path, uncompressedSize });
      }
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
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
    const content = input.method === 0 ? compressed : inflateRawSync(compressed);
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
    if (bytes.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  return -1;
}

function normalizeZipPath(path: string) {
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
