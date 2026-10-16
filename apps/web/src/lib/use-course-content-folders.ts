"use client";

import { useEffect, useState } from "react";
import { COURSE_FOLDER_STATE_TTL_MS, courseFolderStorageKey, parseCourseFolderState, type CourseFolderState } from "./course-content-folders";

type StoredFolderState = CourseFolderState & { storageKey: string | null };

export function useCourseContentFolders({ courseId, groupId = null, userId, scope, contentItems, active = true }: {
  courseId: string;
  groupId?: string | null;
  userId?: string;
  scope: "teacher" | "learner" | "preview";
  contentItems: ReadonlyArray<{ id: string; kind: string }>;
  active?: boolean;
}) {
  const storageKey = userId ? courseFolderStorageKey(userId, courseId, groupId, scope) : null;
  const [state, setState] = useState<StoredFolderState | null>(null);
  const folderIds = contentItems.filter((item) => item.kind === "folder").map((item) => item.id);
  const openFolderIds = new Set(state?.storageKey === storageKey && state.expiresAt > Date.now() ? state.openFolderIds : []);
  const collapsedFolderIds = new Set(folderIds.filter((id) => !openFolderIds.has(id)));

  useEffect(() => {
    if (!active) return;
    let saved: CourseFolderState | null = null;
    if (storageKey) {
      try {
        saved = parseCourseFolderState(window.localStorage.getItem(storageKey));
        if (!saved) window.localStorage.removeItem(storageKey);
      } catch {
        // Folder controls still work when browser storage is unavailable.
      }
    }
    // Returning before expiry starts a new four-hour window.
    setState(saved ? { ...saved, storageKey, expiresAt: Date.now() + COURSE_FOLDER_STATE_TTL_MS } : null);
  }, [active, storageKey]);

  useEffect(() => {
    if (!state || !storageKey || state.storageKey !== storageKey) return;
    try {
      // Expiry changes on a content visit or folder action, never a data refresh.
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: state.version, openFolderIds: state.openFolderIds, expiresAt: state.expiresAt
      }));
    } catch {
      // An unavailable or full storage must not prevent expanding folders.
    }
  }, [state, storageKey]);

  useEffect(() => {
    if (!state || state.storageKey !== storageKey) return;
    function expireIfDue() {
      if (!state || Date.now() < state.expiresAt) return;
      setState((current) => current === state ? null : current);
      if (storageKey) {
        try {
          // Do not remove a newer preference written by another tab.
          if (!parseCourseFolderState(window.localStorage.getItem(storageKey))) window.localStorage.removeItem(storageKey);
        } catch {
          // Expiry applies in memory even when storage is unavailable.
        }
      }
    }
    const timer = window.setTimeout(expireIfDue, Math.max(0, state.expiresAt - Date.now()));
    window.addEventListener("focus", expireIfDue);
    document.addEventListener("visibilitychange", expireIfDue);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", expireIfDue);
      document.removeEventListener("visibilitychange", expireIfDue);
    };
  }, [state, storageKey]);

  function updateFolders(update: (opened: Set<string>) => Set<string>) {
    const now = Date.now();
    setState((current) => {
      const opened = new Set(current?.storageKey === storageKey && current.expiresAt > now ? current.openFolderIds : []);
      const next = update(opened);
      return {
        storageKey, version: 1, expiresAt: now + COURSE_FOLDER_STATE_TTL_MS,
        // Prune removed folders on interaction, never against a loading/old tree.
        openFolderIds: folderIds.filter((id) => next.has(id))
      };
    });
  }

  return {
    collapsedFolderIds,
    toggleFolder: (id: string) => updateFolders((opened) => {
      if (opened.has(id)) opened.delete(id);
      else opened.add(id);
      return opened;
    }),
    openFolder: (id: string) => updateFolders((opened) => opened.add(id)),
    expandAllFolders: () => updateFolders(() => new Set(folderIds)),
    collapseAllFolders: () => updateFolders(() => new Set())
  };
}
