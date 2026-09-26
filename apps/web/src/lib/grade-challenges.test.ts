import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gradebookDetailSource = readFileSync("apps/web/src/app/courses/[courseId]/gradebook/activities/[activityId]/page.tsx", "utf8");
const challengePanelSource = readFileSync("apps/web/src/components/course-grade-challenges-panel.tsx", "utf8");

describe("grade challenge review dialog", () => {
  it("uses the shared Review and grade dialog from both challenge and gradebook surfaces", () => {
    expect(challengePanelSource).toContain("<ReviewAndGradeDialog");
    expect(gradebookDetailSource).toContain("<ReviewAndGradeDialog");
  });

  it("keeps grade mutation out of the challenge queue", () => {
    expect(challengePanelSource).toContain("openReviewAndGrade(challenge)");
    expect(challengePanelSource).toContain("courseDetail.notifyStudentByEmail");
    expect(challengePanelSource).toContain("courseDetail.sendChallengeAnswer");
    expect(challengePanelSource).not.toContain("scoreById");
    expect(challengePanelSource).not.toContain("courseDetail.adjustGrade");
    expect(challengePanelSource).not.toContain("courseDetail.upholdGrade");
  });
});
