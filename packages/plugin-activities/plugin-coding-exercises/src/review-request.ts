import type { GradingReviewRequest } from "@cognelo/contracts";

export function codingBlankReviewRequest(evidenceRef: string): GradingReviewRequest {
  return { reasonCode: "coding-exercise.blank-interaction", evidenceRef,
    message: "The complete program failed although every isolated blank passed in the teacher's solution." };
}
