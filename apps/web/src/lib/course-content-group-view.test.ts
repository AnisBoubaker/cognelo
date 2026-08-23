import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMessage } from "./i18n";

const coursePageSource = readFileSync("apps/web/src/app/courses/[courseId]/page.tsx", "utf8");

describe("course content group perspective", () => {
  it("keeps group perspective visibility-only", () => {
    expect(coursePageSource).toContain("if (event.button !== 0 || contentGroup)");
    expect(coursePageSource).toContain("{contentGroup ? (");
    expect(coursePageSource).toContain("<span className=\"content-tree-student-spacer\" aria-hidden=\"true\" />");
    expect(coursePageSource).not.toContain("contentGroup && !item.groupId");
    expect(coursePageSource).not.toContain("(!contentGroup || Boolean(item.groupId))");
    expect(getMessage("en", "courseDetail.groupContentText")).toContain("show or hide");
    expect(getMessage("en", "courseDetail.groupContentText")).not.toContain("moved or removed");
  });

  it("toggles the visibility represented by the projected row", () => {
    expect(coursePageSource).toContain(
      "await api.updateGroupContentItem(courseId, contentGroup.id, item.id, { isVisible: !item.isVisible })"
    );
    expect(coursePageSource).toContain(
      'item.isVisible ? t(contentGroup ? "courseDetail.hideInGroup"'
    );
  });
});
