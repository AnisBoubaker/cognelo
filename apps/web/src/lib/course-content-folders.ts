export const COURSE_FOLDER_STATE_TTL_MS = 4 * 60 * 60 * 1000;

export type CourseFolderState = {
  version: 1;
  openFolderIds: string[];
  expiresAt: number;
};

export function courseFolderStorageKey(userId: string, courseId: string, groupId: string | null, scope: "teacher" | "learner" | "preview") {
  return `cognelo:content-folders:${JSON.stringify([userId, courseId, groupId, scope])}`;
}

export function parseCourseFolderState(value: string | null, now = Date.now()): CourseFolderState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      !parsed || parsed.version !== 1 || !Array.isArray(parsed.openFolderIds)
      || !parsed.openFolderIds.every((id: unknown) => typeof id === "string" && id.length > 0)
      || typeof parsed.expiresAt !== "number" || !Number.isFinite(parsed.expiresAt)
      || parsed.expiresAt <= now || parsed.expiresAt > now + COURSE_FOLDER_STATE_TTL_MS
    ) return null;
    return { version: 1, openFolderIds: [...new Set<string>(parsed.openFolderIds)], expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}
