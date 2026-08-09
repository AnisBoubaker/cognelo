import type { StudentContentLayout } from "@cognelo/contracts";

export const DEFAULT_STUDENT_CONTENT_LAYOUT: StudentContentLayout = "accordion";

export function resolveStudentContentLayout(metadata: unknown): StudentContentLayout {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return DEFAULT_STUDENT_CONTENT_LAYOUT;
  }
  return (metadata as Record<string, unknown>).studentContentLayout === "folder_tabs"
    ? "folder_tabs"
    : DEFAULT_STUDENT_CONTENT_LAYOUT;
}

export function normalizeStudentFolderTabDepth(treeDepth: number) {
  return Math.max(0, treeDepth - 1);
}
