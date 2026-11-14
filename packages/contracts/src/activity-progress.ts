export type ActivityProgressState = "not_started" | "in_progress" | "stage_submitted" | "done";

/** Participation only: completion does not imply grading or grade release. */
export type ActivityStudentProgress = {
  participantId: string;
  groupId: string;
  state: ActivityProgressState;
  stageId?: string;
  stageNames?: Record<string, string>;
  attemptNumber?: number;
  startedAt?: string;
  submittedAt?: string;
};
