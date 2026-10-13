import type { CurrentUser } from "@cognelo/contracts";
import { getActivityAttemptAvailability } from "./gradebook";

/** Fail closed for assigned summative learner payloads. Teacher authoring has no group context. */
export async function canShowStudentActivityGrade(context: {
  user: CurrentUser; courseId?: string; groupId?: string;
  activity: { id: string; assignment?: { metadata?: Record<string, unknown> } };
}) {
  if (context.activity.assignment?.metadata?.assessmentMode !== "summative") return true;
  if (!context.courseId || !context.groupId) return false;
  const availability = await getActivityAttemptAvailability(context.user, {
    courseId: context.courseId, groupId: context.groupId, activityId: context.activity.id
  });
  return availability.gradesReleased === true;
}
