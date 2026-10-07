import { readFile } from "node:fs/promises";
import { prisma } from "@cognelo/db";
import { confirmSharedDialog, expect, test } from "./fixtures/auth";
import { provisionLearningFlow, removeLearningFlow, type LearningFlowData } from "./fixtures/learning-flow";

const courseId = "seed-course-programming-101";
const activityId = "seed-activity-c-median-feedback";
const participantEmail = "programming.a01@cognelo.local";

test.describe("partial grade safeguards", () => {
  let attemptId = "";
  let gradebookItemId = "";
  let participantId = "";
  let originalAttempt: { lifecycle: "started" | "submitted" | "graded" | "deleted"; gradedAt: Date | null } | null = null;
  let originalGrade: Awaited<ReturnType<typeof prisma.grade.findUnique>> = null;
  let originalGradesReleased = false;

  test.beforeAll(async () => {
    const attempt = await prisma.activityAttempt.findFirstOrThrow({
      where: { activityId, participant: { email: participantEmail } },
      orderBy: { attemptNumber: "desc" }
    });
    attemptId = attempt.id;
    gradebookItemId = attempt.gradebookItemId;
    participantId = attempt.participantId;
    originalAttempt = { lifecycle: attempt.lifecycle, gradedAt: attempt.gradedAt };
    originalGradesReleased = (await prisma.gradebookItem.findUniqueOrThrow({ where: { id: gradebookItemId } })).gradesReleased;
    originalGrade = await prisma.grade.findUnique({
      where: { gradebookItemId_participantId: { gradebookItemId, participantId } }
    });

    await prisma.activityAttempt.update({
      where: { id: attemptId },
      data: { lifecycle: "graded", gradedAt: new Date() }
    });
    await prisma.gradebookItem.update({ where: { id: gradebookItemId }, data: { gradesReleased: false } });
    await prisma.grade.upsert({
      where: { gradebookItemId_participantId: { gradebookItemId, participantId } },
      update: {
        rawScore: 20,
        rawMaxScore: 100,
        normalizedScore: 20,
        normalizedMaxScore: 100,
        selectedAttemptId: attemptId,
        source: "auto",
        isActive: true,
        rawResult: { kind: "coding-exercise", deterministicScore: 20 },
        normalizedResult: { kind: "coding-exercise", deterministicScore: 20 }
      },
      create: {
        gradebookItemId,
        participantId,
        userId: attempt.userId,
        selectedAttemptId: attemptId,
        rawScore: 20,
        rawMaxScore: 100,
        normalizedScore: 20,
        normalizedMaxScore: 100,
        source: "auto",
        isActive: true,
        rawResult: { kind: "coding-exercise", deterministicScore: 20 },
        normalizedResult: { kind: "coding-exercise", deterministicScore: 20 }
      }
    });
  });

  test.afterAll(async () => {
    if (originalAttempt) {
      await prisma.activityAttempt.update({ where: { id: attemptId }, data: originalAttempt });
    }
    await prisma.gradebookItem.update({ where: { id: gradebookItemId }, data: { gradesReleased: originalGradesReleased } });
    if (originalGrade) {
      await prisma.grade.update({
        where: { id: originalGrade.id },
        data: {
          rawScore: originalGrade.rawScore,
          rawMaxScore: originalGrade.rawMaxScore,
          normalizedScore: originalGrade.normalizedScore,
          normalizedMaxScore: originalGrade.normalizedMaxScore,
          isPass: originalGrade.isPass,
          latePenaltyApplied: originalGrade.latePenaltyApplied,
          latePenaltyPercent: originalGrade.latePenaltyPercent,
          gradedByUserId: originalGrade.gradedByUserId,
          gradedAt: originalGrade.gradedAt,
          source: originalGrade.source,
          isActive: originalGrade.isActive,
          selectedAttemptId: originalGrade.selectedAttemptId,
          rawResult: originalGrade.rawResult,
          normalizedResult: originalGrade.normalizedResult,
          metadata: originalGrade.metadata
        }
      });
    } else {
      await prisma.grade.deleteMany({ where: { gradebookItemId, participantId } });
    }
  });

  test("marks tests-only programming grades as partial, excludes them from export, and blocks release", async ({ teacherPage: page }) => {
    await page.goto(`/courses/${courseId}/gradebook/activities/${activityId}`);
    const studentRow = page.locator(".table-row-gradebook-detail").filter({ hasText: participantEmail });
    const partial = studentRow.locator(".grade-completion-badge-partial");
    await expect(partial).toHaveText(/Partial/);
    await expect(partial).toHaveAttribute("title", "Partial grade: 1 of 2 grading components complete.");

    await page.getByRole("button", { name: "Export grades", exact: true }).click();
    const exportDialog = page.getByRole("dialog", { name: "Export activity grades" });
    await exportDialog.getByLabel("File name").fill("partial-grade-exclusion");
    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Export grades", exact: true }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("The partial-grade CSV did not expose a local path.");
    const csv = await readFile(downloadPath, "utf8");
    expect(csv).not.toContain(participantEmail);

    await page.goto(`/courses/${courseId}?tab=gradebook`);
    const activityRow = page.locator(".table-row-gradebook-activity").filter({ hasText: "C exercise: Median of three integers" }).first();
    const release = activityRow.getByRole("button", { name: "Release", exact: true });
    await expect(release).toBeDisabled();
    await expect(activityRow).toContainText(/Complete \d+ submitted grade\(s\) before release\./);
  });
});

test.describe("grade release without a submission", () => {
  let data: LearningFlowData | undefined;

  test.beforeAll(async () => {
    data = await provisionLearningFlow();
  });

  test.afterAll(async () => {
    await removeLearningFlow(data);
  });

  test("allows release when the learner did not submit", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The no-submission fixture was not provisioned.");
    await page.goto(`/courses/${data.courseId}?tab=gradebook`);
    const activityRow = page.locator(".table-row-gradebook-activity").filter({ hasText: data.activityTitle }).first();
    const release = activityRow.getByRole("button", { name: "Release", exact: true });
    await expect(release).toBeEnabled();
    await release.click();
    await confirmSharedDialog(page);
    await expect(activityRow.getByRole("button", { name: "Hide", exact: true })).toBeVisible();
  });
});
