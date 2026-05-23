import type { ActivityGradingResult } from "@cognelo/activity-sdk";
import type { ParsonsAttemptEvaluation } from "./attempt-types";

export function buildParsonsGradingResult(evaluation: ParsonsAttemptEvaluation): ActivityGradingResult {
  const orderPossible = 0.7;
  const indentationPossible = 0.3;
  const orderScore = evaluation.orderCorrect ? orderPossible : 0;
  const indentationScore = evaluation.indentationCorrect ? indentationPossible : 0;
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
      gradingModel: "parsons-correctness-v1",
      studentFeedback: {
        kind: "parsons",
        details: {
          messages: [
            ...(evaluation.orderCorrect ? [] : [{ type: "order", count: evaluation.misplacedBlocks }]),
            ...(evaluation.indentationCorrect ? [] : [{ type: "indentation", count: evaluation.incorrectIndents }])
          ],
          grading: [
            { type: "order", awardedRaw: orderScore, possibleRaw: orderPossible },
            { type: "indentation", awardedRaw: indentationScore, possibleRaw: indentationPossible }
          ]
        }
      }
    }
  };
}
