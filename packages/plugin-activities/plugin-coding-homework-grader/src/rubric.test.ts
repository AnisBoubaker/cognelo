import { describe, expect, it } from "vitest";
import { HOMEWORK_CRITERION_FEEDBACK_MAX_LENGTH, defaultHomeworkGrading, homeworkFeedbackDraft, homeworkGradingSchema, calculateHomeworkFeedback, reviseHomeworkFeedback, rubricScore, type HomeworkGradingPolicy } from "./rubric";
const criterion = { id: "quality", title: "Quality", description: "Assess the whole project", weightPercent: 100 };
const policy: HomeworkGradingPolicy = { ...defaultHomeworkGrading(), enabled: true, code: { criteria: [criterion], instructions: "Credit demonstrated work." }, questions: { criteria: [{ ...criterion, id: "understanding" }], instructions: "Assess the answer to the actual question." } };
describe("homework rubric composition", () => {
  it("keeps existing homework manual and question-free defaults at 100 code points", () => {
    expect(defaultHomeworkGrading().enabled).toBe(false);
    expect(defaultHomeworkGrading(false)).toMatchObject({ codeWeightPercent: 100, questionsWeightPercent: 0, testWeightPercent: 0 });
  });
  it("rejects nonzero test points, duplicate criteria and invalid component/criterion totals", () => {
    expect(homeworkGradingSchema.safeParse(policy).success).toBe(true);
    for (const invalid of [{ ...policy, testWeightPercent: 1 }, { ...policy, codeWeightPercent: 60 }, { ...policy, code: { ...policy.code, criteria: [criterion, criterion] } }, { ...policy, questions: { ...policy.questions, criteria: [] } }]) expect(homeworkGradingSchema.safeParse(invalid).success).toBe(false);
  });
  it("keeps missing grades pending and distinguishes an explicit zero", () => {
    const draft = homeworkFeedbackDraft(policy, ["one", "two"]);
    expect(draft).toMatchObject({ codeScore: null, questionsScore: null, combinedScore: null });
    draft.code.criteria[0].scorePercent = 80;
    draft.questions[0].criteria[0].scorePercent = 0;
    expect(calculateHomeworkFeedback(draft)).toMatchObject({ codeScore: 80, questionsScore: null, combinedScore: null });
    draft.questions[1].criteria[0].scorePercent = 100;
    expect(calculateHomeworkFeedback(draft)).toMatchObject({ codeScore: 80, questionsScore: 50, combinedScore: 71 });
  });
  it("scores the whole code rubric once, averages questions equally, and honors zero-weight components", () => {
    const draft = homeworkFeedbackDraft({ ...policy, codeWeightPercent: 100, questionsWeightPercent: 0 }, []);
    draft.code.criteria[0].scorePercent = 75;
    expect(calculateHomeworkFeedback(draft)).toMatchObject({ codeScore: 75, questionsScore: null, combinedScore: 75 });
    expect(rubricScore({ summary: "", criteria: [{ ...criterion, weightPercent: 40, scorePercent: 50, feedback: "" }, { ...criterion, id: "other", weightPercent: 60, scorePercent: 100, feedback: "" }] })).toBe(80);
  });
  it("retains server criterion weights and identities while accepting teacher scores and blank comments", () => {
    const draft = homeworkFeedbackDraft(policy, ["one"]);
    const edited = structuredClone(draft);
    edited.code.criteria[0] = { ...edited.code.criteria[0], title: "Forged", weightPercent: 1, scorePercent: 90 };
    edited.questions[0].criteria[0].scorePercent = 60;
    expect(reviseHomeworkFeedback(draft, edited)).toMatchObject({ code: { criteria: [{ title: "Quality", weightPercent: 100, scorePercent: 90 }] }, combinedScore: 81 });
  });
  it("rejects missing, duplicate, foreign and reordered question identities without mixing students", () => {
    const draft = homeworkFeedbackDraft(policy, ["one", "two"]);
    expect(() => reviseHomeworkFeedback(draft, { ...draft, questions: [draft.questions[0], draft.questions[0]] })).toThrow();
    expect(() => reviseHomeworkFeedback(draft, { ...draft, questions: [] })).toThrow();
    expect(() => reviseHomeworkFeedback(draft, { ...draft, code: { ...draft.code, criteria: [{ ...draft.code.criteria[0], id: "foreign" }] } })).toThrow();
    expect(reviseHomeworkFeedback(draft, { ...draft, questions: [...draft.questions].reverse() }).questions.map(item => item.id)).toEqual(["one", "two"]);
  });
  it("retains long code and answer evidence through teacher edits and rejects comments over the supported limit", () => {
    const draft = homeworkFeedbackDraft(policy, ["one"]);
    const edited = structuredClone(draft);
    const evidence = "é".repeat(HOMEWORK_CRITERION_FEEDBACK_MAX_LENGTH);
    edited.code.criteria[0].feedback = evidence;
    edited.questions[0].criteria[0].feedback = evidence;
    const revised = reviseHomeworkFeedback(draft, edited);
    expect(revised.code.criteria[0].feedback).toBe(evidence);
    expect(revised.questions[0].criteria[0].feedback).toBe(evidence);
    expect(revised.combinedScore).toBeNull();
    edited.code.criteria[0].feedback += "!";
    expect(() => reviseHomeworkFeedback(draft, edited)).toThrow();
    edited.code.criteria[0].feedback = "";
    edited.questions[0].criteria[0].feedback += "!";
    expect(() => reviseHomeworkFeedback(draft, edited)).toThrow();
  });
});
