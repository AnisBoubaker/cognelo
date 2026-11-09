import { homeworkAnsweringAssignment } from "./stage-scheduling";
import { enqueueBackgroundJob, finalizeExpiredTimedActivityAttempt, getTimedActivityRuntime, type BackgroundJobRecord } from "@cognelo/core";
import { prisma as coreDb } from "@cognelo/db";
import { prisma } from "./db-client";
import { saveCodingHomeworkChallengeAnswers } from "./challenge-answers";
import type { HomeworkStudentScope } from "./file-preparation";

export const homeworkDeadlineHandler = "coding-homework-grader.answering-deadline";
export async function scheduleHomeworkDeadline(scope: HomeworkStudentScope, attemptId: string, deadline: Date, database: Parameters<typeof enqueueBackgroundJob>[1] = coreDb) {
  return enqueueBackgroundJob({ handlerKey: homeworkDeadlineHandler, queue: "homework-deadlines", idempotencyKey: `deadline:${attemptId}:${deadline.toISOString()}`, maxAttempts: 10,
    runAfter: deadline, payload: { ...scope, coreAttemptId: attemptId } }, database);
}
export async function finalizeHomeworkSavedAnswers(input: HomeworkStudentScope & { coreAttemptId: string }) {
  const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({ where: { coreAttemptId: input.coreAttemptId, activityId: input.activityId, groupId: input.groupId, userId: input.user.id, status: "challenge_ready" } });
  if (!submission) return false;
  const activity = await homeworkAnsweringAssignment(input);
  await saveCodingHomeworkChallengeAnswers(input, { submissionId: submission.id, answers: [] }, { finalize: true, expiredAttemptId: input.coreAttemptId,
    gradebook: { assessmentMode: String((activity.assignment.metadata as Record<string, unknown>).assessmentMode ?? "formative"), pluginVersion: "0.1.0" } });
  return true;
}
export async function processHomeworkDeadline(job: BackgroundJobRecord) {
  const scope = job.payload as unknown as HomeworkStudentScope & { coreAttemptId: string };
  const runtime = await getTimedActivityRuntime(scope.user, scope.courseId, scope.groupId, scope.activityId);
  if (!runtime.attempt || runtime.attempt.id !== scope.coreAttemptId) return { finished: true };
  const activity = await homeworkAnsweringAssignment(scope);
  const deadline = runtime.timing.expiresAt ? new Date(runtime.timing.expiresAt) : activity.assignment.availableUntil;
  if (!deadline) return { timed: false };
  if (deadline.getTime() > Date.now()) { await scheduleHomeworkDeadline(scope, scope.coreAttemptId, deadline); return { rescheduled: true }; }
  await finalizeExpiredTimedActivityAttempt(scope.user, scope.courseId, scope.groupId, scope.activityId, { includeClosingDate: true });
  return { submitted: true };
}
