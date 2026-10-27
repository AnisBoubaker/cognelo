import { describe, expect, it } from "vitest";
import { COURSE_FOLDER_STATE_TTL_MS } from "./course-content-folders";
import { parseStudentCourseLocation, studentCourseLocationKey } from "./student-course-location";

describe("student course location", () => {
  const now = 1_000_000;
  const saved = { version: 1, tab: "content", folderId: "week-two", scrollY: 850, expiresAt: now + COURSE_FOLDER_STATE_TTL_MS };

  it("restores view preferences within the shared four-hour expiry", () => {
    expect(parseStudentCourseLocation(JSON.stringify(saved), now)).toEqual(saved);
    expect(parseStudentCourseLocation(JSON.stringify(saved), saved.expiresAt)).toBeNull();
  });

  it.each([null, "broken", "null", "[]", JSON.stringify({ ...saved, version: 2 }),
    JSON.stringify({ ...saved, tab: "javascript:alert(1)" }), JSON.stringify({ ...saved, folderId: {} }),
    JSON.stringify({ ...saved, scrollY: -1 }), JSON.stringify({ ...saved, scrollY: "500" }),
    JSON.stringify({ ...saved, expiresAt: now + COURSE_FOLDER_STATE_TTL_MS + 1 })])("ignores malformed location data: %s", value => {
    expect(parseStudentCourseLocation(value, now)).toBeNull();
  });

  it("separates users, courses, sections, and learner/preview state", () => {
    const keys = [studentCourseLocationKey("one", "course", "group", "learner"),
      studentCourseLocationKey("two", "course", "group", "learner"),
      studentCourseLocationKey("one", "other", "group", "learner"),
      studentCourseLocationKey("one", "course", "other", "learner"),
      studentCourseLocationKey("one", "course", "group", "preview")];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
