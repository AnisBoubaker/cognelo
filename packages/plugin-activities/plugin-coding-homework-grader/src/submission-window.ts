import { homeworkFileStageSettings } from "./stage-scheduling";
import type { HomeworkStudentScope } from "./file-preparation";
import { AppError } from "@cognelo/core";
import { homeworkSubmissionTiming, homeworkSubmissionWindow, readHomeworkSubmissionPolicy } from "./submission-policy";

/** Call again after validation, immediately before freezing a new hand-in. */
export function acceptHomeworkSubmissionTiming(settings: unknown, now = Date.now()) {
  const policy = readHomeworkSubmissionPolicy(settings);
  const cutoff = settings && typeof settings === "object" ? (settings as { submissionClosesAt?: string | null }).submissionClosesAt : undefined;
  if ((cutoff !== undefined ? cutoff !== null && now >= Date.parse(cutoff) : homeworkSubmissionWindow(policy, now).closed)) throw new AppError(409, "HOMEWORK_SUBMISSION_DEADLINE_PASSED", "The deadline for submitting this homework has passed.");
  return homeworkSubmissionTiming(policy, now);
}

/** Server-only recovery context; never read from a learner request body. */
export type AutomaticHomeworkHandIn = { cutoff: string; triggeredBy: string; workspaceId?: string };
export function automaticHomeworkTiming(settings: unknown, automatic: AutomaticHomeworkHandIn, now = Date.now()) {
  const policy = readHomeworkSubmissionPolicy(settings), raw = settings && typeof settings === "object" ? settings as { submissionClosesAt?: string | null } : {};
  const window = raw.submissionClosesAt !== undefined ? { closed: raw.submissionClosesAt !== null && now >= Date.parse(raw.submissionClosesAt), closesAt: raw.submissionClosesAt } : homeworkSubmissionWindow(policy, now);
  if (!window.closed || window.closesAt !== automatic.cutoff) throw new AppError(409, "HOMEWORK_AUTOMATIC_NOT_DUE", "The automatic hand-in cutoff changed or has not been reached.");
  const timing = homeworkSubmissionTiming(policy, Date.parse(automatic.cutoff));
  // Recovery at the ordinary deadline is on time; grace-period recovery uses only the grace duration.
  return { ...timing, isLate: timing.lateByMs > 0 };
}
export function assertAutomaticHomeworkDraft(draft: { files: unknown; updatedAt: Date }, latest: { metadata: unknown; status: string; updatedAt: Date } | null, automatic: AutomaticHomeworkHandIn) {
  if (!Array.isArray(draft.files) || !draft.files.length) throw new AppError(409, "HOMEWORK_AUTOMATIC_EMPTY", "No prepared files are available to submit automatically.");
  const metadata = latest?.metadata && typeof latest.metadata === "object" ? latest.metadata as Record<string, unknown> : {};
  if (latest?.status === "cancelled" || metadata.deletion) {
    const cancellation = metadata.cancellation as { cancelledAt?: string } | undefined, deletion = metadata.deletion as { deletedAt?: string } | undefined;
    const cancelledAt = Date.parse(cancellation?.cancelledAt ?? deletion?.deletedAt ?? latest!.updatedAt.toISOString());
    if (cancelledAt >= Date.parse(automatic.cutoff)) throw new AppError(409, "HOMEWORK_AUTOMATIC_CANCELLED", "The teacher cancelled this hand-in after the cutoff. Extend the deadline before submitting automatically again.");
  }
  if (draft.updatedAt.getTime() > Date.parse(automatic.cutoff)) throw new AppError(409, "HOMEWORK_AUTOMATIC_DRAFT_TOO_NEW", "The prepared files were changed after this cutoff. Set a later deadline before automatic hand-in.");
}

export async function acceptHomeworkStageTiming(scope: HomeworkStudentScope, startedAt?: Date | null) { return acceptHomeworkSubmissionTiming(await homeworkFileStageSettings(scope, startedAt)); }
