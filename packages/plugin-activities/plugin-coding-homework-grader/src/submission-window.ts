import { AppError } from "@cognelo/core";
import { homeworkSubmissionTiming, homeworkSubmissionWindow, readHomeworkSubmissionPolicy } from "./submission-policy";

/** Call again after validation, immediately before freezing a new hand-in. */
export function acceptHomeworkSubmissionTiming(settings: unknown, now = Date.now()) {
  const policy = readHomeworkSubmissionPolicy(settings);
  if (homeworkSubmissionWindow(policy, now).closed) throw new AppError(409, "HOMEWORK_SUBMISSION_DEADLINE_PASSED", "The deadline for submitting this homework has passed.");
  return homeworkSubmissionTiming(policy, now);
}
