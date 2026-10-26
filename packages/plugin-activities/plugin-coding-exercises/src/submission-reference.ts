import { prisma as corePrisma } from "@cognelo/db";
import { AppError } from "@cognelo/core";
import { prisma } from "./db-client";

/** Read legacy Test evidence without rewriting submissions or executing student code. */
export async function resolveCodingTestSubmission(input: {
  courseId: string;
  activityId: string;
  parentAttemptId: string;
  itemAttemptId: string;
  /** Manual review can work from a recovered answer without running code. */
  allowMissingExecution?: boolean;
}) {
  const child = await corePrisma.testItemAttempt.findFirst({
    where: {
      id: input.itemAttemptId, activityId: input.activityId, parentAttemptId: input.parentAttemptId,
      lifecycle: { in: ["submitted", "graded"] },
      parentAttempt: {
        courseId: input.courseId, pluginKey: "core:test", assessmentMode: "summative",
        lifecycle: { in: ["submitted", "graded"] }
      }
    },
    select: { pluginAttemptRef: true, result: true, parentAttempt: { select: { userId: true } } }
  });
  if (!child?.parentAttempt.userId) throw missingSubmission();
  const result = record(child.result);
  const state = record(result.state);
  const savedId = typeof state.executionId === "string" ? state.executionId : null;
  const executionId = child.pluginAttemptRef || savedId;
  if (!executionId) {
    if (input.allowMissingExecution) return null;
    throw missingSubmission();
  }
  if (savedId && savedId !== executionId) throw mismatchedSubmission();
  const execution = await prisma.pluginCodingExerciseExecution.findFirst({
    where: { id: executionId, activityId: input.activityId, userId: child.parentAttempt.userId, kind: "submit" },
    select: { id: true, sourceCode: true }
  });
  if (!execution || typeof state.sourceCode !== "string" || execution.sourceCode !== state.sourceCode) {
    throw mismatchedSubmission();
  }
  return execution.id;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function missingSubmission() {
  return new AppError(409, "CODING_EXERCISE_SUBMISSION_REQUIRED", "This question has no completed coding submission. Run automatic grading for the Test to prepare its saved response before requesting AI feedback.");
}

function mismatchedSubmission() {
  return new AppError(409, "CODING_EXERCISE_EXECUTION_NOT_FOUND", "The saved response does not match its coding submission. The submission must be reviewed before grading.");
}
