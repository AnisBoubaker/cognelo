import { COURSE_FOLDER_STATE_TTL_MS } from "./course-content-folders";

export type StudentCourseTab = "content" | "grades" | "my-teams";
export type StudentCourseLocation = {
  version: 1;
  tab: StudentCourseTab;
  folderId: string | null;
  scrollY: number;
  expiresAt: number;
};

export function studentCourseLocationKey(userId: string, courseId: string, groupId: string, scope: "learner" | "preview") {
  return `cognelo:course-location:${JSON.stringify([userId, courseId, groupId, scope])}`;
}

export function isStudentCourseTab(value: unknown): value is StudentCourseTab {
  return value === "content" || value === "grades" || value === "my-teams";
}

export function parseStudentCourseLocation(value: string | null, now = Date.now()): StudentCourseLocation | null {
  if (!value) return null;
  try {
    const data = JSON.parse(value);
    if (!data || data.version !== 1 || !isStudentCourseTab(data.tab)
      || !(data.folderId === null || (typeof data.folderId === "string" && data.folderId.length > 0 && data.folderId.length <= 300))
      || typeof data.scrollY !== "number" || !Number.isFinite(data.scrollY) || data.scrollY < 0
      || typeof data.expiresAt !== "number" || !Number.isFinite(data.expiresAt)
      || data.expiresAt <= now || data.expiresAt > now + COURSE_FOLDER_STATE_TTL_MS) return null;
    return { version: 1, tab: data.tab, folderId: data.folderId, scrollY: data.scrollY, expiresAt: data.expiresAt };
  } catch { return null; }
}
