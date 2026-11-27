import { describe, expect, it } from "vitest";
import { defaultHomeworkGrading, homeworkFeedbackDraft, homeworkGradingSchema } from "./rubric";
import { homeworkQuestionWarning } from "./question-warning";

const criterion = { id: "understanding", title: "Understanding", description: "", weightPercent: 100 };
function feedback(scores: Array<number | null>) {
  const policy = defaultHomeworkGrading(); policy.questions.criteria = [criterion];
  const draft = homeworkFeedbackDraft(policy, scores.map((_, index) => String(index)));
  scores.forEach((score, index) => { draft.questions[index].criteria[0].scorePercent = score; });
  return draft;
}
const policy = { enabled: true, thresholdPercent: 60, mode: "mean" as const };
describe("challenge-answer warning rules", () => {
  it("distinguishes an equal-weight average from any single low answer", () => {
    expect(homeworkQuestionWarning(policy, feedback([40, 100]))).toBeNull();
    expect(homeworkQuestionWarning({ ...policy, mode: "any" }, feedback([40, 100]))).toMatchObject({ low: [{ question: 1, score: 40 }] });
    expect(homeworkQuestionWarning(policy, feedback([0, 100]))).toMatchObject({ mean: 50 });
  });
  it("uses strictly below, accepts zero, and handles 100 without flagging full credit", () => {
    expect(homeworkQuestionWarning(policy, feedback([40, 80]))).toBeNull();
    expect(homeworkQuestionWarning({ ...policy, mode: "any" }, feedback([60, 80]))).toBeNull();
    expect(homeworkQuestionWarning({ ...policy, thresholdPercent: 0 }, feedback([0, 0]))).toBeNull();
    expect(homeworkQuestionWarning({ ...policy, thresholdPercent: 100 }, feedback([100]))).toBeNull();
  });
  it("never treats pending scores or no questions as a zero; blank answers explicitly scored zero count", () => {
    expect(homeworkQuestionWarning(policy, feedback([null, 40]))).toBeNull();
    expect(homeworkQuestionWarning({ ...policy, mode: "any" }, feedback([null, 40]))).toMatchObject({ low: [{ question: 2, score: 40 }] });
    expect(homeworkQuestionWarning(policy, feedback([]))).toBeNull();
    expect(homeworkQuestionWarning({ ...policy, enabled: false }, feedback([0]))).toBeNull();
  });
  it("preserves legacy defaults and validates warning mode, threshold and a usable answer rubric", () => {
    const legacy = defaultHomeworkGrading();
    const { questionWarning: _warning, ...oldPolicy } = legacy;
    expect(homeworkGradingSchema.parse(oldPolicy).questionWarning.enabled).toBe(false);
    for (const invalid of [{ ...policy, thresholdPercent: -1 }, { ...policy, thresholdPercent: 101 }, { ...policy, mode: "unknown" }]) {
      expect(homeworkGradingSchema.safeParse({ ...legacy, questionWarning: invalid }).success).toBe(false);
    }
    expect(homeworkGradingSchema.safeParse({ ...legacy, enabled: true, codeWeightPercent: 100, questionsWeightPercent: 0, code: { criteria: [criterion], instructions: "" }, questionWarning: policy }).success).toBe(false);
  });
});
