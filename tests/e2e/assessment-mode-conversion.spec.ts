import { prisma } from "@cognelo/db";
import type { Page } from "@playwright/test";
import { confirmSharedDialog, createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { provisionLearningFlow, removeLearningFlow, type LearningFlowData } from "./fixtures/learning-flow";

test.describe("formative and summative attempt conversion", () => {
  let data: LearningFlowData | undefined;

  test.beforeAll(async () => {
    data = await provisionLearningFlow();
    await prisma.courseContentItem.create({
      data: {
        id: `e2e-mode-content-${data.activityId}`,
        courseId: data.courseId,
        kind: "activity",
        titleSnapshot: data.activityTitle,
        position: 0,
        activityId: data.activityId,
        metadata: { e2e: true }
      }
    });
  });

  test.afterAll(async () => {
    await removeLearningFlow(data);
  });

  test("converts existing summative attempts to formative and keeps them separate after switching back", async ({ teacherPage: page }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The assessment-mode fixture was not provisioned.");

    const initialSettings = await openActivitySettings(page, data);
    await initialSettings.getByLabel("Assessment mode").selectOption("summative");
    await initialSettings.getByRole("button", { name: "Save settings" }).click();
    await expect(initialSettings).toBeHidden();

    const firstSubmission = await submitCorrectMcq(data);
    expect(firstSubmission).toBe(true);
    const initialAttempt = await prisma.activityAttempt.findFirstOrThrow({
      where: { activityId: data.activityId },
      orderBy: { createdAt: "asc" }
    });
    const initialGrade = await prisma.grade.findUniqueOrThrow({
      where: {
        gradebookItemId_participantId: {
          gradebookItemId: initialAttempt.gradebookItemId,
          participantId: initialAttempt.participantId
        }
      }
    });
    expect(initialAttempt.assessmentMode).toBe("summative");
    expect(initialGrade.isActive).toBe(true);

    const settings = await openActivitySettings(page, data);
    await settings.getByLabel("Assessment mode").selectOption("formative");
    await settings.getByRole("button", { name: "Save settings" }).click();
    const confirmation = page.getByRole("dialog", { name: "Please confirm" });
    await expect(confirmation).toContainText("Every existing summative attempt will become formative");
    await confirmSharedDialog(page);
    await expect(settings).toBeHidden();

    const convertedAttempt = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: initialAttempt.id } });
    const withdrawnGrade = await prisma.grade.findUniqueOrThrow({ where: { id: initialGrade.id } });
    const convertedItem = await prisma.gradebookItem.findUniqueOrThrow({ where: { id: initialAttempt.gradebookItemId } });
    expect(convertedAttempt.assessmentMode).toBe("formative");
    expect(withdrawnGrade.isActive).toBe(false);
    expect(convertedItem.gradesReleased).toBe(false);

    await page.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}`);
    await expect(page.getByRole("button", { name: "Inspect attempts", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Release", exact: true })).toHaveCount(0);

    const formativeSettings = await openActivitySettings(page, data);
    await formativeSettings.getByLabel("Assessment mode").selectOption("summative");
    await formativeSettings.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("dialog", { name: "Please confirm" })).toHaveCount(0);
    await expect(formativeSettings).toBeHidden();

    const preservedAttempt = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: initialAttempt.id } });
    expect(preservedAttempt.assessmentMode).toBe("formative");

    const secondSubmission = await submitCorrectMcq(data);
    expect(secondSubmission).toBe(true);
    const attempts = await prisma.activityAttempt.findMany({
      where: { activityId: data.activityId },
      orderBy: { attemptNumber: "asc" },
      select: { assessmentMode: true, attemptNumber: true }
    });
    expect(attempts).toEqual([
      { assessmentMode: "formative", attemptNumber: 1 },
      { assessmentMode: "summative", attemptNumber: 2 }
    ]);

    const activeGrade = await prisma.grade.findUniqueOrThrow({
      where: {
        gradebookItemId_participantId: {
          gradebookItemId: initialAttempt.gradebookItemId,
          participantId: initialAttempt.participantId
        }
      }
    });
    expect(activeGrade.isActive).toBe(true);
    const selectedAttempt = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: activeGrade.selectedAttemptId ?? "" } });
    expect(selectedAttempt.assessmentMode).toBe("summative");

    await page.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}`);
    const studentRow = page.locator(".table-row-gradebook-detail").filter({ hasText: "student@cognelo.local" });
    await expect(studentRow).toContainText("1");
    await expect(studentRow.getByRole("button", { name: "Review and grade", exact: true })).toBeVisible();
  });
});

async function openActivitySettings(page: Page, data: LearningFlowData) {
  await page.goto(`/courses/${data.courseId}?tab=content`);
  await page.getByRole("button", { name: `Actions for ${data.activityTitle}` }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: data.activityTitle });
  await expect(settings.getByLabel("Assessment mode")).toBeVisible();
  return settings;
}

async function submitCorrectMcq(data: LearningFlowData) {
  const api = await createAuthenticatedApi("student");
  try {
    const response = await api.post(
      `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}/mcq/submission`,
      { data: { answers: { "question-1": ["question-1-choice-1"] } } }
    );
    return response.ok();
  } finally {
    await api.dispose();
  }
}
