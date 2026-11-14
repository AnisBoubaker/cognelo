import { getActivityDefinition } from "@cognelo/activity-sdk";
import { resolveActivityStudentProgressHandler } from "@cognelo/activity-sdk/server";
import { getCourseActivityProgress } from "@cognelo/core";
import type { ActivityStudentProgress, CurrentUser } from "@cognelo/contracts";

export async function courseActivityProgress(user: CurrentUser, courseId: string, activityId: string, groupId?: string | null) {
  const snapshot = await getCourseActivityProgress(user, courseId, activityId, groupId);
  const handler = resolveActivityStudentProgressHandler(snapshot.activityTypeKey);
  const statuses = new Map(snapshot.progress.map(progress => [`${progress.groupId}:${progress.participantId}`, progress]));
  const stages = getActivityDefinition(snapshot.activityTypeKey)?.submissionStages ?? [];
  if (handler && snapshot.participants.length) {
    const updates = await handler({ user, courseId, activityId, participants: snapshot.participants,
      activityMetadata: snapshot.activityMetadata, assignmentMetadata: snapshot.assignmentMetadata });
    for (const update of updates) {
      const key = `${update.groupId}:${update.participantId}`, previous = statuses.get(key);
      if (!previous || !["not_started", "in_progress", "stage_submitted", "done"].includes(update.state)) continue;
      const stage = stages.find(stage => stage.id === update.stageId);
      if ((update.stageId && !stage) || (update.state === "stage_submitted" && !stage)) continue;
      // Project only neutral participation fields; plugin evidence stays private.
      const progress: ActivityStudentProgress = {
        participantId: previous.participantId, groupId: previous.groupId, state: update.state,
        ...(stage ? { stageId: stage.id, stageNames: stage.names } : {}),
        ...(update.state === "done" && previous.submittedAt ? { submittedAt: previous.submittedAt } : {}),
        ...(update.state === "in_progress" && previous.attemptNumber ? { attemptNumber: previous.attemptNumber, startedAt: previous.startedAt } : {})
      };
      statuses.set(key, progress);
    }
  }
  return { attempts: snapshot.attempts, progress: [...statuses.values()] };
}
