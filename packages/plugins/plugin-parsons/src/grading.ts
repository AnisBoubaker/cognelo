import type { ActivityGradingResult } from "@cognelo/activity-sdk";
import type { ParsonsAttemptEvaluation } from "./attempt-types";

export function buildParsonsGradingResult(evaluation: ParsonsAttemptEvaluation): ActivityGradingResult {
  const orderScore = evaluation.orderCorrect ? 0.7 : 0;
  const indentationScore = evaluation.indentationCorrect ? 0.3 : 0;
  const rawScore = evaluation.isCorrect ? 1 : orderScore + indentationScore;

  return {
    rawScore,
    rawMaxScore: 1,
    isPass: evaluation.isCorrect,
    analyticsPayload: {
      orderCorrect: evaluation.orderCorrect,
      indentationCorrect: evaluation.indentationCorrect,
      misplacedBlocks: evaluation.misplacedBlocks,
      incorrectIndents: evaluation.incorrectIndents
    },
    metadata: {
      gradingModel: "parsons-correctness-v1"
    }
  };
}
