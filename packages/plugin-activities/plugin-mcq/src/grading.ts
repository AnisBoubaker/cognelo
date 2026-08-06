import { gradeMcqAnswers, parseMcqSource, type McqAnswerState, type ParsedMcq } from "./mcq";

type McqPluginGradingResult = {
  rawScore: number;
  rawMaxScore: number;
  isPass?: boolean | null;
  feedback?: Record<string, unknown>;
  analyticsPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export function buildMcqGradingResult(parsed: ParsedMcq, answers: McqAnswerState): McqPluginGradingResult {
  const result = gradeMcqAnswers(parsed, answers);
  return {
    rawScore: result.rawScore,
    rawMaxScore: result.rawMaxScore,
    isPass: result.isPass,
    analyticsPayload: {
      questionCount: result.rawMaxScore,
      correctCount: result.questions.filter((question) => question.isCorrect).length,
      score: result.rawScore,
      questions: result.questions
    },
    metadata: {
      gradingModel: "mcq-partial-credit-v1",
      studentFeedback: {
        kind: "mcq",
        feedbackText: null,
        details: {
          questionCount: result.rawMaxScore,
          correctCount: result.questions.filter((question) => question.isCorrect).length,
          score: result.rawScore
        }
      }
    }
  };
}

export function buildMcqGradingResultFromConfig(config: Record<string, unknown> | undefined, answers: McqAnswerState) {
  const source = typeof config?.source === "string" ? config.source : "";
  return buildMcqGradingResult(parseMcqSource(source, "none"), answers);
}
