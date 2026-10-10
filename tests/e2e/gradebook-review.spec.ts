import { prisma } from "@cognelo/db";
import { expect, test } from "./fixtures/auth";
import { provisionLearningFlow, removeLearningFlow } from "./fixtures/learning-flow";

test.describe("consistent gradebook review actions", () => {
  test("programming exercises combine rubric feedback and the final grade in one review", async ({ teacherPage: page }) => {
    await page.goto("/courses/seed-course-programming-101/gradebook/activities/seed-activity-c-median-feedback");

    await expect(page.getByRole("heading", { name: "C exercise: Median of three integers" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit activity" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Class overview" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Student results" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Rerun automatic grading for all" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI-assess all submissions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review and grade all" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate AI feedback for all" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Review feedback for all" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Grade All Manually" })).toHaveCount(0);
    await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(0);

    await page.getByRole("tab", { name: "Class overview", exact: true }).click();
    const classOverview = page.getByRole("tabpanel");
    await expect(classOverview.getByRole("heading", { name: "Rubric results" })).toBeVisible();
    await expect(classOverview.getByText("Algorithm correctness", { exact: true })).toBeVisible();
    await expect(classOverview.getByText("The program computes the median for every ordering, including repeated and negative values.", { exact: true })).toBeVisible();
    await expect(classOverview.getByText("Weight: 50%", { exact: true })).toBeVisible();
    const rubricCriteria = classOverview.locator(".rubric-overview-criterion");
    await expect(rubricCriteria).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      await expect(rubricCriteria.nth(index).getByText(/^(Average: .*% · \d+ graded|No graded rubric results)$/)).toBeVisible();
    }
    await page.getByRole("tab", { name: "Student results", exact: true }).click();

    await page.getByRole("button", { name: "Assess with AI", exact: true }).first().click();
    const aiConfirmation = page.getByRole("dialog", { name: "Please confirm" });
    const aiConfirmationMessage = await aiConfirmation.locator(".muted").innerText();
    expect(aiConfirmationMessage).toContain("evaluate the rubric, generate feedback, and update");
    expect(aiConfirmationMessage).toContain("Automatic grading will not be rerun");
    await aiConfirmation.getByRole("button", { name: "Cancel", exact: true }).click();

    const autoGradedStudentRow = page.locator(".table-row-gradebook-detail").filter({ hasText: "programming.a01@cognelo.local" });
    await autoGradedStudentRow.getByRole("button", { name: "Review and grade", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Review and grade" })).toBeVisible();
    await expect(dialog.getByText("Summary", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Strengths", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Improvements", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Weight: 50%", { exact: true })).toBeVisible();
    const automaticGrade = dialog.getByLabel("Automatic tests grade (out of 60)");
    const rubricGrade = dialog.getByLabel("Rubric grade (out of 40)");
    const totalGrade = dialog.getByLabel("Total (out of 100)");
    await expect(automaticGrade).toBeVisible();
    await expect(rubricGrade).toBeVisible();
    await expect(totalGrade).toBeVisible();
    const gradePositions = await Promise.all([automaticGrade, rubricGrade, totalGrade].map(async (field) => (await field.boundingBox())?.y));
    expect(new Set(gradePositions).size).toBe(1);
    const finalGrade = dialog.getByLabel(/Final grade \(out of/);
    await expect(finalGrade).toBeVisible();

    const totalBefore = await totalGrade.inputValue();
    const firstCriterion = dialog.getByLabel("Score (%)").first();
    const nextCriterionScore = Number(await firstCriterion.inputValue()) === 100 ? "0" : "100";
    await firstCriterion.fill(nextCriterionScore);
    await expect.poll(() => totalGrade.inputValue()).not.toBe(totalBefore);
    await expect.poll(async () => Number(await finalGrade.inputValue())).toBe(Number(await totalGrade.inputValue()));
  });

  test("course content opens the activity report workspace and keeps editing available", async ({ teacherPage: page }) => {
    await page.goto("/courses/seed-course-programming-101?tab=content");

    const activityLink = page.getByRole("link", { name: "C exercise: Median of three integers", exact: true }).first();
    await expect(activityLink).toHaveAttribute(
      "href",
      "/courses/seed-course-programming-101/gradebook/activities/seed-activity-c-median-feedback?origin=content&report=overview"
    );
    await activityLink.click();

    await expect(page).toHaveURL(/\/gradebook\/activities\/seed-activity-c-median-feedback\?origin=content&report=overview$/);
    await expect(page.getByRole("tab", { name: "Class overview" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Student results" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit activity" })).toHaveAttribute(
      "href",
      "/courses/seed-course-programming-101/activities/seed-activity-c-median-feedback"
    );
    await expect(page.getByRole("link", { name: "Back to course content" })).toBeVisible();
  });

  test("shows a newly started student attempt and its start time without reloading the report", async ({ teacherPage: page }) => {
    test.setTimeout(45_000);
    const data = await provisionLearningFlow();
    try {
      let initialFeedResponseCount = 0;
      page.on("response", (response) => {
        if (
          response.request().method() === "GET"
          && response.url().includes("view=in-progress-attempts")
          && response.url().includes(`activityId=${data.activityId}`)
        ) {
          initialFeedResponseCount += 1;
        }
      });
      await page.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}?groupId=${data.groupId}`);
      await expect.poll(() => initialFeedResponseCount).toBeGreaterThanOrEqual(2);
      const participant = await prisma.courseGroupParticipant.findFirstOrThrow({
        where: { groupId: data.groupId, role: "student" }
      });
      const assignment = await prisma.courseGroupActivity.findUniqueOrThrow({
        where: { groupId_activityId: { groupId: data.groupId, activityId: data.activityId } }
      });
      const gradebookItem = await prisma.gradebookItem.findUniqueOrThrow({
        where: { groupActivityId: assignment.id }
      });
      const studentRow = page.locator(".table-row-gradebook-detail").filter({ hasText: participant.email });
      const inProgressBadge = studentRow.locator(".gradebook-attempt-in-progress-badge");
      await expect(inProgressBadge).toHaveCount(0);

      await prisma.activityAttempt.create({
        data: {
          courseId: data.courseId,
          groupId: data.groupId,
          groupActivityId: assignment.id,
          activityId: data.activityId,
          gradebookItemId: gradebookItem.id,
          participantId: participant.id,
          userId: participant.userId,
          attemptNumber: 1,
          lifecycle: "started",
          pluginKey: "mcq",
          pluginVersion: "e2e",
          assessmentMode: "summative"
        }
      });

      await expect(inProgressBadge).toContainText("Attempt 1 in progress", { timeout: 20_000 });
      await expect(studentRow.getByText(/^Started .+/)).toBeVisible();
    } finally {
      await page.goto("/courses");
      await removeLearningFlow(data);
    }
  });
});
