import { expect, test } from "./fixtures/auth";

test.describe("consistent gradebook review actions", () => {
  test("programming exercises combine rubric feedback and the final grade in one review", async ({ teacherPage: page }) => {
    await page.goto("/courses/seed-course-programming-101/gradebook/activities/seed-activity-c-median-feedback");

    await expect(page.getByRole("heading", { name: "C exercise: Median of three integers" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Class overview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rerun automatic grading for all" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI-assess all submissions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review and grade all" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate AI feedback for all" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Review feedback for all" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Grade All Manually" })).toHaveCount(0);
    await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(0);

    let aiConfirmationMessage = "";
    page.once("dialog", async (dialog) => {
      aiConfirmationMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Assess with AI", exact: true }).first().click();
    expect(aiConfirmationMessage).toContain("evaluate the rubric, generate feedback, and update");
    expect(aiConfirmationMessage).toContain("Automatic grading will not be rerun");

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
});
