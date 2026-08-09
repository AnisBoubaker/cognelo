import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDENT_CONTENT_LAYOUT,
  normalizeStudentFolderTabDepth,
  resolveStudentContentLayout
} from "./course-settings";

describe("course settings", () => {
  it("uses accordions for existing courses without a stored layout", () => {
    expect(resolveStudentContentLayout(undefined)).toBe(DEFAULT_STUDENT_CONTENT_LAYOUT);
    expect(resolveStudentContentLayout({})).toBe("accordion");
    expect(resolveStudentContentLayout({ studentContentLayout: "unknown" })).toBe("accordion");
  });

  it("recognizes the folder-tabs layout", () => {
    expect(resolveStudentContentLayout({ studentContentLayout: "folder_tabs" })).toBe("folder_tabs");
  });

  it("normalizes folder-tab content depth relative to the selected root folder", () => {
    expect(normalizeStudentFolderTabDepth(1)).toBe(0);
    expect(normalizeStudentFolderTabDepth(2)).toBe(1);
    expect(normalizeStudentFolderTabDepth(3)).toBe(2);
  });
});
