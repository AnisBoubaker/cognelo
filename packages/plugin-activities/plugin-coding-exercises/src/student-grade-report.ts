import type { CurrentUser } from "@cognelo/contracts";
import { prisma as corePrisma } from "@cognelo/db";
import { getLatestCodingExerciseTestResult } from "./executions";
import { prisma } from "./db-client";

export async function getCodingExerciseStudentGradeReport(input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  gradebookItemId: string;
  selectedAttemptId?: string | null;
}) {
  const participant = await corePrisma.courseGroupParticipant.findFirst({
    where: {
      groupId: input.groupId,
      userId: input.user.id,
      role: "student",
      group: { courseId: input.courseId }
    },
    select: { id: true }
  });
  if (!participant) return null;

  const gradebookItem = await corePrisma.gradebookItem.findFirst({
    where: {
      id: input.gradebookItemId,
      courseId: input.courseId,
      groupId: input.groupId,
      activityId: input.activityId,
      gradesReleased: true,
      grades: { some: { participantId: participant.id } }
    },
    select: { id: true }
  });
  if (!gradebookItem) return null;

  const coreAttempts = await corePrisma.activityAttempt.findMany({
    where: {
      gradebookItemId: gradebookItem.id,
      participantId: participant.id,
      lifecycle: { in: ["submitted", "graded"] }
    },
    orderBy: [{ attemptNumber: "asc" }],
    select: {
      id: true,
      attemptNumber: true,
      pluginAttemptRef: true,
      submittedAt: true
    }
  });
  const executionIds = coreAttempts.flatMap((attempt) => attempt.pluginAttemptRef ? [attempt.pluginAttemptRef] : []);
  const executions = executionIds.length
    ? await prisma.pluginCodingExerciseExecution.findMany({
        where: {
          id: { in: executionIds },
          activityId: input.activityId,
          userId: input.user.id,
          kind: "submit"
        },
        select: {
          id: true,
          sourceCode: true,
          languageKey: true,
          resultSummary: true,
          updatedAt: true
        }
      })
    : [];
  const executionById = new Map(executions.map((execution) => [execution.id, execution]));

  const attempts = await Promise.all(coreAttempts.flatMap((attempt) => {
    const execution = attempt.pluginAttemptRef ? executionById.get(attempt.pluginAttemptRef) : null;
    if (!execution) return [];
    return [getLatestCodingExerciseTestResult({
      activityId: input.activityId,
      executionId: execution.id,
      originalResultSummary: execution.resultSummary
    }).then((latest) => {
      const summary = recordValue(latest.resultSummary);
      const earnedWeight = finiteNumber(summary.earnedWeight);
      const totalWeight = finiteNumber(summary.totalWeight);
      return {
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        executionId: execution.id,
        isSelected: attempt.id === input.selectedAttemptId,
        submittedAt: (attempt.submittedAt ?? execution.updatedAt).toISOString(),
        language: execution.languageKey,
        sourceCode: execution.sourceCode,
        testScore: earnedWeight,
        testMaxScore: totalWeight,
        tests: recordArray(summary.tests).map((test, index) => {
          const passed = typeof test.passed === "boolean" ? test.passed : null;
          const possible = finiteNumber(test.weight) ?? 1;
          return {
            id: stringValue(test.id) || `test-${index + 1}`,
            name: stringValue(test.name),
            passed,
            score: passed === null ? null : passed ? possible : 0,
            maxScore: possible,
            statusLabel: stringValue(test.statusLabel) || null,
            message: stringValue(test.message) || null
          };
        })
      };
    })];
  }));

  return {
    kind: "coding-exercise",
    attempts
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
