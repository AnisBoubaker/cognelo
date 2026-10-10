import { prisma } from "@cognelo/db";
import type { Page } from "@playwright/test";
import { confirmSharedDialog, createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { provisionLearningFlow, removeLearningFlow, type LearningFlowData } from "./fixtures/learning-flow";

test.describe("student grade challenges", () => {
  let data: LearningFlowData | undefined;

  test.beforeAll(async () => {
    data = await provisionLearningFlow({ gradeChallengesEnabled: true });
    if (!data) return;
    const api = await createAuthenticatedApi("student");
    try {
      const response = await api.post(
        `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}/mcq/submission`,
        { data: { answers: { "question-1": ["question-1-choice-1"] } } }
      );
      if (!response.ok()) throw new Error(`Unable to submit the challenge fixture: ${await response.text()}`);
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    await removeLearningFlow(data);
  });

  test("opens review in place, audits a grade change, resolves the challenge, and orders resolved items last", async ({ studentPage, teacherPage }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The grade-challenge fixture was not provisioned.");

    await teacherPage.goto(`/courses/${data.courseId}?tab=gradebook`);
    await teacherPage.getByRole("button", { name: "Release", exact: true }).click();
    await confirmSharedDialog(teacherPage);

    const firstExplanation = "The selected answer is correct, so please review this released grade.";
    await submitChallenge(studentPage, data, firstExplanation);

    await teacherPage.goto(`/courses/${data.courseId}?tab=challenges`);
    await expect(teacherPage.getByRole("heading", { name: "Grade challenges" })).toBeVisible();
    let challengeItems = teacherPage.locator("details.grade-challenge-item");
    await expect(challengeItems).toHaveCount(1);
    let openChallenge = challengeItems.first();
    await expect(openChallenge.locator("summary")).toContainText(`${data.activityTitle}→Sam Student`);
    await openChallenge.locator("summary").click();
    await expect(openChallenge.getByText(firstExplanation, { exact: true })).toBeVisible();

    const challengeUrl = teacherPage.url();
    await openChallenge.getByRole("button", { name: "Review and grade", exact: true }).click();
    const review = teacherPage.getByRole("dialog").filter({ hasText: "Student answer" });
    await expect(review.getByRole("heading", { name: "Student answer" })).toBeVisible();
    await expect(teacherPage).toHaveURL(challengeUrl);

    const grade = await prisma.grade.findFirstOrThrow({ where: { gradebookItem: { activityId: data.activityId } } });
    const eventCountBefore = await prisma.gradeEvent.count({ where: { gradeId: grade.id } });
    await review.getByRole("spinbutton").fill("5");
    await review.getByLabel("Summary").fill("Adjusted after reviewing the learner challenge.");
    const overrideSaved = teacherPage.waitForResponse((response) => (
      response.ok() && response.request().method() === "PATCH" && response.url().includes("/override")
    ));
    await review.getByRole("button", { name: "Save review", exact: true }).click();
    await overrideSaved;
    await expect.poll(async () => prisma.gradeEvent.count({ where: { gradeId: grade.id } })).toBeGreaterThan(eventCountBefore);
    await expect.poll(async () => (
      await prisma.grade.findUniqueOrThrow({ where: { id: grade.id } })
    ).normalizedScore).toBe(5);
    await review.getByRole("button", { name: "Close", exact: true }).click();
    await expect(review).toBeHidden();
    await expect(teacherPage).toHaveURL(challengeUrl);

    openChallenge = teacherPage.locator("details.grade-challenge-item").first();
    await openChallenge.getByLabel("Teacher response").fill("I reviewed the attempt and adjusted the grade accordingly.");
    await expect(openChallenge.getByLabel("Notify the student by email")).not.toBeChecked();
    await openChallenge.getByRole("button", { name: "Send answer", exact: true }).click();
    await expect(teacherPage.getByText("There are no open grade challenges.", { exact: true })).toBeVisible();
    await expect(teacherPage.locator("details.grade-challenge-item")).toHaveCount(0);

    const secondExplanation = "Please review the newly adjusted final grade and its recorded reasoning.";
    await submitChallenge(studentPage, data, secondExplanation);

    await teacherPage.reload();
    challengeItems = teacherPage.locator("details.grade-challenge-item");
    await expect(challengeItems).toHaveCount(1);
    await expect(challengeItems.first()).toContainText(secondExplanation);
    await teacherPage.getByLabel("Show resolved challenges").check();
    await expect(challengeItems).toHaveCount(2);
    await expect(challengeItems.first()).toContainText(secondExplanation);
    await expect(challengeItems.first()).toContainText("Open");
    await expect(challengeItems.last()).toContainText(firstExplanation);
    await expect(challengeItems.last()).toContainText("Adjusted");
  });
});

async function submitChallenge(page: Page, data: LearningFlowData, explanation: string) {
  await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`);
  const submit = page.getByRole("button", { name: "Submit challenge", exact: true });
  await expect(submit).toBeVisible();
  await submit.locator("xpath=preceding::textarea[1]").fill(explanation);
  await submit.click();
  await expect(page.getByText(explanation, { exact: true })).toBeVisible();
}
