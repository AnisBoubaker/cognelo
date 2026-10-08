import { prisma } from "@cognelo/db";
import { WEB_BASE_URL, expect, loginWithCredentialsThroughUi, test } from "./fixtures/auth";

const courseId = "seed-course-programming-101";
const groupId = "seed-group-programming-101-section-a";
const activityId = "seed-activity-c-median-feedback";
const studentEmail = "programming.a01@cognelo.local";

test.describe("student programming grading report", () => {
  let gradebookItemId = "";
  let participantId = "";
  let originallyReleased = false;
  let originalGrade: Awaited<ReturnType<typeof prisma.grade.findUnique>> = null;

  test.beforeAll(async () => {
    const attempt = await prisma.activityAttempt.findFirstOrThrow({
      where: { activityId, groupId, participant: { email: studentEmail } },
      orderBy: { attemptNumber: "desc" }
    });
    const item = await prisma.gradebookItem.findUniqueOrThrow({ where: { id: attempt.gradebookItemId } });
    gradebookItemId = attempt.gradebookItemId;
    participantId = attempt.participantId;
    originallyReleased = item.gradesReleased;
    originalGrade = await prisma.grade.findUnique({
      where: { gradebookItemId_participantId: { gradebookItemId, participantId } }
    });

    const result = {
      kind: "coding-exercise",
      studentFeedback: {
        kind: "assessment_feedback",
        feedbackText: "Teacher note for the learner.",
        details: {
          summary: "Solid approach with one edge case to revisit.",
          strengths: ["The solution is readable and follows the requested output format."],
          improvements: ["Review the ordering logic for every input permutation."],
          deterministicScore: 60,
          aiScore: 85,
          gradingEnabled: true,
          testWeightPercent: 60,
          aiWeightPercent: 40,
          criteria: [{
            id: "algorithm-correctness",
            title: "Algorithm correctness",
            weightPercent: 100,
            scorePercent: 85,
            feedback: "The main approach is correct; verify the remaining edge case."
          }]
        }
      }
    };

    await prisma.grade.upsert({
      where: { gradebookItemId_participantId: { gradebookItemId, participantId } },
      update: {
        userId: attempt.userId,
        selectedAttemptId: attempt.id,
        rawScore: 70,
        rawMaxScore: 100,
        normalizedScore: 70,
        normalizedMaxScore: 100,
        isPass: true,
        source: "manual",
        isActive: true,
        rawResult: result,
        normalizedResult: result
      },
      create: {
        gradebookItemId,
        participantId,
        userId: attempt.userId,
        selectedAttemptId: attempt.id,
        rawScore: 70,
        rawMaxScore: 100,
        normalizedScore: 70,
        normalizedMaxScore: 100,
        isPass: true,
        source: "manual",
        isActive: true,
        rawResult: result,
        normalizedResult: result
      }
    });
    await prisma.gradebookItem.update({ where: { id: item.id }, data: { gradesReleased: true } });
  });

  test.afterAll(async () => {
    if (gradebookItemId) {
      await prisma.gradebookItem.update({
        where: { id: gradebookItemId },
        data: { gradesReleased: originallyReleased }
      });
    }
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
    } else if (gradebookItemId && participantId) {
      await prisma.grade.deleteMany({ where: { gradebookItemId, participantId } });
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
