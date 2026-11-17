import { z } from "zod";

export const homeworkCriterionSchema = z.object({
  id: z.string().min(1).max(80), title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).default(""), weightPercent: z.number().int().min(1).max(100)
}).strict();
const rubricSchema = z.object({
  criteria: z.array(homeworkCriterionSchema).max(20).default([]),
  instructions: z.string().max(8000).default("")
}).strict();
export const homeworkGradingSchema = z.object({
  enabled: z.boolean().default(false),
  codeWeightPercent: z.number().int().min(0).max(100).default(70),
  questionsWeightPercent: z.number().int().min(0).max(100).default(30),
  testWeightPercent: z.literal(0).default(0),
  code: rubricSchema.default({ criteria: [], instructions: "" }),
  questions: rubricSchema.default({ criteria: [], instructions: "" })
}).strict().superRefine((policy, context) => {
  if (policy.codeWeightPercent + policy.questionsWeightPercent !== 100) context.addIssue({ code: "custom", message: "Grading weights must total 100.", path: ["codeWeightPercent"] });
  for (const kind of ["code", "questions"] as const) {
    const criteria = policy[kind].criteria;
    if (new Set(criteria.map(item => item.id)).size !== criteria.length) context.addIssue({ code: "custom", message: "Rubric criterion IDs must be unique.", path: [kind] });
    if ((criteria.length || policy.enabled && policy[`${kind}WeightPercent`] > 0) && criteria.reduce((sum, item) => sum + item.weightPercent, 0) !== 100) {
      context.addIssue({ code: "custom", message: "Each contributing rubric must contain criteria whose weights total 100.", path: [kind, "criteria"] });
    }
  }
});
export type HomeworkGradingPolicy = z.infer<typeof homeworkGradingSchema>;
export type HomeworkCriterion = z.infer<typeof homeworkCriterionSchema>;
export type HomeworkCriterionScore = HomeworkCriterion & { scorePercent: number | null; feedback: string };
export type HomeworkRubricScore = { summary: string; criteria: HomeworkCriterionScore[] };
export type HomeworkRubricFeedback = {
  kind: "homework_rubric"; gradingEnabled: boolean;
  reviewEnabled: boolean;
  privateCodePolicyHash?: string;
  codeWeightPercent: number; questionsWeightPercent: number; testWeightPercent: 0;
  code: HomeworkRubricScore; questions: Array<HomeworkRubricScore & { id: string }>;
  privateSharedCodeRevision: string | null;
  summary: string; strengths: string[]; improvements: string[];
  codeScore: number | null; questionsScore: number | null; combinedScore: number | null;
};
export const objectRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function defaultHomeworkGrading(questionsEnabled = true): HomeworkGradingPolicy {
  return { enabled: false, codeWeightPercent: questionsEnabled ? 70 : 100, questionsWeightPercent: questionsEnabled ? 30 : 0,
    testWeightPercent: 0, code: { criteria: [], instructions: "" }, questions: { criteria: [], instructions: "" } };
}
export function homeworkGradingPolicy(settings: unknown): HomeworkGradingPolicy {
  const saved = objectRecord(settings);
  return saved.grading === undefined ? defaultHomeworkGrading(saved.questionGenerationEnabled !== false) : homeworkGradingSchema.parse(saved.grading);
}
export function rubricScore(rubric: HomeworkRubricScore): number | null {
  if (!rubric.criteria.length || rubric.criteria.some(item => typeof item.scorePercent !== "number" || !Number.isFinite(item.scorePercent))) return null;
  return round(rubric.criteria.reduce((sum, item) => sum + item.scorePercent! * item.weightPercent / 100, 0));
}
export function calculateHomeworkFeedback(feedback: HomeworkRubricFeedback): HomeworkRubricFeedback {
  const codeScore = rubricScore(feedback.code);
  const scores = feedback.questions.map(rubricScore);
  const questionsScore = scores.length && scores.every(score => score !== null) ? round(scores.reduce<number>((sum, score) => sum + score!, 0) / scores.length) : null;
  const complete = (feedback.codeWeightPercent === 0 || codeScore !== null) && (feedback.questionsWeightPercent === 0 || questionsScore !== null);
  return { ...feedback, codeScore, questionsScore, combinedScore: complete ? round((codeScore ?? 0) * feedback.codeWeightPercent / 100 + (questionsScore ?? 0) * feedback.questionsWeightPercent / 100) : null };
}
export function homeworkFeedbackDraft(policy: HomeworkGradingPolicy, questionIds: string[], sharedCode?: HomeworkRubricScore, privateSharedCodeRevision: string | null = null): HomeworkRubricFeedback {
  const blank = (kind: "code" | "questions"): HomeworkRubricScore => ({ summary: "", criteria: policy[kind].criteria.map(item => ({ ...item, scorePercent: null, feedback: "" })) });
  return calculateHomeworkFeedback({ kind: "homework_rubric", gradingEnabled: policy.enabled, reviewEnabled: policy.enabled, codeWeightPercent: policy.codeWeightPercent,
    questionsWeightPercent: policy.questionsWeightPercent, testWeightPercent: 0, code: sharedCode ?? blank("code"),
    questions: questionIds.map(id => ({ ...blank("questions"), id })), privateSharedCodeRevision, summary: "", strengths: [], improvements: [], codeScore: null, questionsScore: null, combinedScore: null });
}
const scoredCriterionSchema = z.object({ id: z.string(), scorePercent: z.number().min(0).max(100).nullable(), feedback: z.string().max(2000) });
const scoreRevisionSchema = z.object({ summary: z.string().max(3000), criteria: z.array(scoredCriterionSchema).max(20) });
const revisionSchema = z.object({ summary: z.string().max(3000), strengths: z.array(z.string().max(10000)).max(10), improvements: z.array(z.string().max(10000)).max(10),
  code: scoreRevisionSchema, questions: z.array(scoreRevisionSchema.extend({ id: z.string() })).max(20) });
/** Keep immutable criterion identities, descriptions, weights and component policy server-owned. */
export function reviseHomeworkFeedback(current: HomeworkRubricFeedback, value: unknown): HomeworkRubricFeedback {
  const revision = revisionSchema.parse(value);
  const revise = (rubric: HomeworkRubricScore, edited: z.infer<typeof scoreRevisionSchema>): HomeworkRubricScore => {
    if (edited.criteria.length !== rubric.criteria.length || new Set(edited.criteria.map(item => item.id)).size !== rubric.criteria.length || rubric.criteria.some(item => !edited.criteria.some(next => next.id === item.id))) throw new Error("The revised rubric must contain exactly the original criteria.");
    return { summary: edited.summary, criteria: rubric.criteria.map(item => ({ ...item, ...edited.criteria.find(next => next.id === item.id)! })) };
  };
  if (revision.questions.length !== current.questions.length || new Set(revision.questions.map(item => item.id)).size !== current.questions.length || current.questions.some(item => !revision.questions.some(next => next.id === item.id))) throw new Error("The revised feedback must contain exactly the submitted questions.");
  return calculateHomeworkFeedback({ ...current, summary: revision.summary, strengths: revision.strengths, improvements: revision.improvements,
    code: revise(current.code, revision.code), questions: current.questions.map(item => ({ ...revise(item, revision.questions.find(next => next.id === item.id)!), id: item.id })) });
}
export function homeworkPartialScore(feedback: HomeworkRubricFeedback) {
  return round((feedback.codeScore ?? 0) * feedback.codeWeightPercent / 100 + (feedback.questionsScore ?? 0) * feedback.questionsWeightPercent / 100);
}
export function isHomeworkFeedback(value: unknown): value is HomeworkRubricFeedback {
  const feedback = objectRecord(value);
  return feedback.kind === "homework_rubric" && Array.isArray(objectRecord(feedback.code).criteria) && Array.isArray(feedback.questions)
    && typeof feedback.codeWeightPercent === "number" && typeof feedback.questionsWeightPercent === "number";
}
function round(value: number) { return Math.round(value * 10000) / 10000; }
