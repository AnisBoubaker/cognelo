import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors";

function invalidFile(): never {
  throw new AppError(400, "INVALID_STORED_FILE", "The stored file reference is invalid.");
}

/** Legacy uploads use a server-generated UUID followed by a sanitized filename. */
export async function openStoredMaterial(root: string, scope: string[], storedName: unknown) {
  if (typeof storedName !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[A-Za-z0-9._-]+$/i.test(storedName)) invalidFile();
  if (scope.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) invalidFile();
  const base = await realpath(root);
  const directory = await realpath(path.resolve(base, ...scope));
  if (directory !== path.resolve(base, ...scope)) invalidFile();
  const relative = path.relative(base, directory);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) invalidFile();
  // Open once without following a final symlink; stream/stat the same descriptor.
  const file = await open(path.join(directory, storedName), constants.O_RDONLY | constants.O_NOFOLLOW);
  if (!(await file.stat()).isFile()) {
    await file.close();
    invalidFile();
  }
  return file;
}

/** The upload handlers alone may replace physical storage identity. */
export function assertMaterialStorageUnchanged(next: Record<string, unknown> | undefined, previous: unknown, serverUpload = false) {
  if (serverUpload || !next) return;
  const stored = previous && typeof previous === "object" ? previous as Record<string, unknown> : {};
  if (next.storedName !== stored.storedName) {
    throw new AppError(400, "STORED_FILE_IMMUTABLE", "Stored files can only be changed through file upload.");
  }
}
