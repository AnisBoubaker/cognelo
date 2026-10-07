import { prisma } from "@cognelo/db";
import { WEB_BASE_URL, expect, loginWithCredentialsThroughUi, test } from "./fixtures/auth";

const courseId = "seed-course-programming-101";
const groupId = "seed-group-programming-101-section-a";
const activityId = "seed-activity-c-median-feedback";
const studentEmail = "programming.a01@cognelo.local";

test.describe("student programming grading report", () => {
  let gradebookItemId = "";
  let originallyReleased = false;

  test.beforeAll(async () => {
    const item = await prisma.gradebookItem.findFirstOrThrow({ where: { activityId, groupId } });
    gradebookItemId = item.id;
    originallyReleased = item.gradesReleased;
    await prisma.gradebookItem.update({ where: { id: item.id }, data: { gradesReleased: true } });
  });

  test.afterAll(async () => {
    if (gradebookItemId) {
      await prisma.gradebookItem.update({
        where: { id: gradebookItemId },
        data: { gradesReleased: originallyReleased }
      });
    }
  });

  test("shows the recap, teacher comments, rubric, attempts, source, and per-test outcomes in a real learner browser", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: WEB_BASE_URL, locale: "en-CA" });
    const page = await context.newPage();
    try {
      await loginWithCredentialsThroughUi(page, { email: studentEmail, password: "Password123!" });
      await page.goto(`/courses/${courseId}/groups/${groupId}?tab=grades`);
      const row = page.locator(".table-row-student-grades").filter({ hasText: "C exercise: Median of three integers" });
      await expect(row.getByRole("heading", { name: "Grading report" })).toBeVisible();
      await expect(row.getByRole("heading", { name: "Grade recap" })).toBeVisible();
      await expect(row.getByText("Automatic tests", { exact: true })).toBeVisible();
      await expect(row.getByText("Rubric", { exact: true })).toBeVisible();
      await expect(row.getByText("Total", { exact: true })).toBeVisible();
      await expect(row.getByRole("heading", { name: "Teacher comments" })).toBeVisible();
      await expect(row.getByRole("heading", { name: "Rubric details" })).toBeVisible();
      await expect(row.getByRole("heading", { name: "Graded attempts" })).toBeVisible();
      await expect(row.getByText("Submitted solution", { exact: true })).toBeVisible();
      await expect(row.getByText("#include <stdio.h>", { exact: false })).toBeVisible();
      await expect(row.getByText("Test details", { exact: true })).toBeVisible();
      const outcomeIcon = row.getByRole("img", { name: "Passed" }).or(row.getByRole("img", { name: "Failed" })).first();
      await expect(outcomeIcon).toBeVisible();
      const testPanel = outcomeIcon.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' inline-panel ')][1]");
      await expect(testPanel.getByText(/^\d+(?:\.\d+)? \/ \d+(?:\.\d+)?$/)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
