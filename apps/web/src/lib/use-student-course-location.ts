"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { COURSE_FOLDER_STATE_TTL_MS } from "./course-content-folders";
import { isStudentCourseTab, parseStudentCourseLocation, studentCourseLocationKey, type StudentCourseLocation } from "./student-course-location";

/** View preferences only. Folder expansion remains owned by useCourseContentFolders. */
export function useStudentCourseLocation({ courseId, groupId, scope = "learner", requestedTab = null, requestedFolderId,
  active, ready }: {
  courseId: string; groupId: string; scope?: "learner" | "preview";
  requestedTab?: string | null; requestedFolderId: string | null; active: boolean; ready: boolean;
}) {
  const { user } = useAuth();
  const key = user ? studentCourseLocationKey(user.id, courseId, groupId, scope) : null;
  const [state, setState] = useState<(StudentCourseLocation & { key: string }) | null>(null);
  const restored = useRef(false);
  const current = state?.key === key ? state : null;
  const tab = scope === "preview" ? "content" : requestedTab !== null
    ? isStudentCourseTab(requestedTab) ? requestedTab : "content"
    : current?.tab ?? "content";
  const folderId = requestedFolderId !== null ? requestedFolderId || null : current?.folderId ?? null;

  useEffect(() => {
    if (!active || !key) return;
    let saved: StudentCourseLocation | null = null;
    try { saved = parseStudentCourseLocation(window.localStorage.getItem(key)); } catch { /* Storage is optional. */ }
    const nextTab = scope === "preview" ? "content" : requestedTab !== null
      ? isStudentCourseTab(requestedTab) ? requestedTab : "content" : saved?.tab ?? "content";
    const nextFolder = requestedFolderId !== null ? requestedFolderId || null : saved?.folderId ?? null;
    const next: StudentCourseLocation = {
      version: 1, tab: nextTab, folderId: nextFolder,
      scrollY: saved?.tab === nextTab && saved.folderId === nextFolder ? saved.scrollY : 0,
      expiresAt: Date.now() + COURSE_FOLDER_STATE_TTL_MS
    };
    restored.current = false;
    setState({ ...next, key });
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep navigation usable in memory. */ }
  }, [active, key, requestedTab, requestedFolderId, scope]);

  const rememberPosition = useCallback(() => {
    if (!active || !ready || !key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify({ version: 1, tab, folderId,
        scrollY: Math.max(0, window.scrollY), expiresAt: Date.now() + COURSE_FOLDER_STATE_TTL_MS }));
    } catch { /* A blocked/full localStorage must not block opening an activity. */ }
  }, [active, ready, key, tab, folderId]);

  useEffect(() => {
    window.addEventListener("pagehide", rememberPosition);
    return () => window.removeEventListener("pagehide", rememberPosition);
  }, [rememberPosition]);

  useEffect(() => {
    if (!active || !ready || !current || restored.current) return;
    // Wait for the shared folder hook to hydrate and the loaded tree to render.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.scrollTo({ top: current.scrollY, behavior: "instant" });
        restored.current = true;
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [active, ready, current]);

  return { tab, folderId, rememberPosition };
}
