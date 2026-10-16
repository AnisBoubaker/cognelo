import { describe, expect, it } from "vitest";
import { COURSE_FOLDER_STATE_TTL_MS, courseFolderStorageKey, parseCourseFolderState } from "./course-content-folders";

describe("course folder preferences", () => {
  const now = Date.UTC(2026, 9, 16, 12);
  const state = { version: 1, openFolderIds: ["root", "nested"], expiresAt: now + COURSE_FOLDER_STATE_TTL_MS };

  it("retains nested folders until the exact four-hour expiry boundary", () => {
    const saved = JSON.stringify(state);
    expect(COURSE_FOLDER_STATE_TTL_MS).toBe(14_400_000);
    expect(parseCourseFolderState(saved, state.expiresAt - 1)).toEqual(state);
    expect(parseCourseFolderState(saved, state.expiresAt)).toBeNull();
    expect(parseCourseFolderState(saved, state.expiresAt + 1)).toBeNull();
  });

  it.each([
    null, "invalid JSON", "null", "[]", JSON.stringify(["legacy-root"]),
    JSON.stringify({ ...state, version: 2 }),
    JSON.stringify({ ...state, expiresAt: "tomorrow" }),
    JSON.stringify({ ...state, expiresAt: now + COURSE_FOLDER_STATE_TTL_MS + 1 }),
    JSON.stringify({ ...state, openFolderIds: [null] }),
    JSON.stringify({ ...state, openFolderIds: [""] })
  ])("ignores malformed, unsupported or untimed preferences: %s", (value) => {
    expect(parseCourseFolderState(value, now)).toBeNull();
  });

  it("accepts all-collapsed preferences and deduplicates open folder IDs", () => {
    expect(parseCourseFolderState(JSON.stringify({ ...state, openFolderIds: [] }), now)?.openFolderIds).toEqual([]);
    expect(parseCourseFolderState(JSON.stringify({ ...state, openFolderIds: ["root", "root"] }), now)?.openFolderIds).toEqual(["root"]);
  });

  it("isolates users, courses, sections, and teaching/learner/preview views", () => {
    const keys = [
      courseFolderStorageKey("teacher", "course", null, "teacher"),
      courseFolderStorageKey("other-teacher", "course", null, "teacher"),
      courseFolderStorageKey("teacher", "other-course", null, "teacher"),
      courseFolderStorageKey("teacher", "course", "section-a", "teacher"),
      courseFolderStorageKey("teacher", "course", "section-b", "teacher"),
      courseFolderStorageKey("teacher", "course", "section-a", "learner"),
      courseFolderStorageKey("teacher", "course", "section-a", "preview")
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
