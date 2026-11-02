"use client";

import { courseFolderStorageKey } from "./course-content-folders";
import { useContentFolders } from "./use-content-folders";

export function useCourseContentFolders({ courseId, groupId = null, userId, scope, contentItems, active = true }: {
  courseId: string;
  groupId?: string | null;
  userId?: string;
  scope: "teacher" | "learner" | "preview";
  contentItems: ReadonlyArray<{ id: string; kind: string }>;
  active?: boolean;
}) {
  return useContentFolders({
    storageKey: userId ? courseFolderStorageKey(userId, courseId, groupId, scope) : null,
    contentItems, active
  });
}
