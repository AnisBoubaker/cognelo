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

    await page.getByRole("button", { name: "Review and grade", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Review and grade" })).toBeVisible();
    await expect(dialog.getByText("Summary", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Strengths", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Improvements", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel(/Final grade \(out of/)).toBeVisible();
  });
});
