export type ActivityLogCursor = { at: string; id: string };
export type ActivityLogType = "attempt_started" | "submitted" | "files_submitted" | "automatic_hand_in" | "submission_cancelled" | "challenges_reset" | "questions_ready" | "processing_failed"
  | "auto_graded" | "manual_graded" | "overridden" | "regraded" | "released" | "hidden" | "submission_deleted" | "submission_reopened" | "ai_feedback_recorded" | "assessment_mode_changed";
export type ActivityLogEvidence = {
  id: string; at: string; type: ActivityLogType; groupId: string; participantId: string;
  actorUserId?: string | null; attemptNumber?: number | null; reason?: string | null;
};
export type ActivityLogEntry = Omit<ActivityLogEvidence, "actorUserId"> & { student: string; group: string; actor: string | null };
export type ActivityLogPage = { entries: ActivityLogEntry[]; nextCursor: ActivityLogCursor | null };
export type ActivityStudentAction = {
  id: string; participantId: string; groupId: string; targetId: string;
  labels: Record<string, string>; messages: Record<string, string>; reasonLabels: Record<string, string>;
  icon: "cancel" | "reset";
};
export type ActivityStudentActionList = { actions: ActivityStudentAction[]; issues: string[] };
export type ActivityBatchAction = {
  id: string; icon: "cancel" | "reset"; revision: string; participantIds: string[];
  labels: Record<string, string>; messages: Record<string, string>; reasonLabels: Record<string, string>;
};
export type ActivityBatchActionList = { actions: ActivityBatchAction[] };
