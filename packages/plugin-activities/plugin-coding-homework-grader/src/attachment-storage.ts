import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { AppError } from "@cognelo/core";

type Attachment = { storedName: string; sizeBytes: bigint; sha256: string };
const MAX_FILE_BYTES = 25 * 1024 * 1024;
export function codingHomeworkAttachmentPath(storedName: string) {
  if (path.basename(storedName) !== storedName) throw new AppError(400, "CODING_HOMEWORK_ATTACHMENT_PATH_INVALID", "The stored attachment path is invalid.");
  return path.join(process.cwd(), "../../storage/coding-homework-grader", storedName);
}

export async function* readProvidedAttachmentChunks(attachment: Attachment, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const file = await open(codingHomeworkAttachmentPath(attachment.storedName), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES || BigInt(stat.size) !== attachment.sizeBytes) throw new AppError(409, "HOMEWORK_PROVIDED_FILE_CHANGED", "A provided file is unavailable or changed. Ask your teacher to upload it again.");
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(64 * 1024);
    let position = 0;
    while (position < stat.size) {
      signal?.throwIfAborted();
      const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, stat.size - position), position);
      if (!bytesRead) throw new AppError(409, "HOMEWORK_PROVIDED_FILE_CHANGED", "A provided file could not be read completely.");
      const chunk = Buffer.from(buffer.subarray(0, bytesRead)); position += bytesRead; hash.update(chunk); yield chunk;
    }
    if (hash.digest("hex") !== attachment.sha256) throw new AppError(409, "HOMEWORK_PROVIDED_FILE_CHANGED", "A provided file failed its integrity check.");
  } finally { await file.close(); }
}
