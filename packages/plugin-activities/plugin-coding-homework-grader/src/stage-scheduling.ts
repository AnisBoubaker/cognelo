import { activityAssessmentStageAssignment, getGroupAssignedActivity, resolveActivitySubmissionStage } from "@cognelo/core";
import { submissionStageWindow } from "@cognelo/contracts";
import type { HomeworkStudentScope } from "./file-preparation";
/** Policy is resolved by core after live section/team/student exceptions. */
export async function homeworkFileStageSettings(scope: HomeworkStudentScope, startedAt?: Date | null) {
  const activity = await getGroupAssignedActivity(scope.user, scope.courseId, scope.groupId, scope.activityId);
  const resolved = await resolveActivitySubmissionStage(activity, activity.assignment, "files"), window = submissionStageWindow(resolved.policy, resolved.availableUntil, startedAt ?? null);
  return { submissionPolicy: { deadline: window.deadline, allowLate: Boolean(window.deadline) && resolved.policy.allowLate, lateLimitMinutes: window.deadline && resolved.policy.allowLate ? resolved.policy.lateLimitMinutes : null },
    submissionClosesAt: window.closesAt, preparationStartedAt: startedAt?.toISOString() ?? null, preparationTimeLimitMinutes: resolved.policy.timeLimitMinutes };
}
export async function homeworkAnsweringAssignment(scope: HomeworkStudentScope) {
  const activity = await getGroupAssignedActivity(scope.user, scope.courseId, scope.groupId, scope.activityId);
  return { ...activity, assignment: await activityAssessmentStageAssignment(activity, activity.assignment) };
}
