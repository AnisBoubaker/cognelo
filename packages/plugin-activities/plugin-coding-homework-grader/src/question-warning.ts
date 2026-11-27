import { rubricScore, type HomeworkQuestionWarningPolicy, type HomeworkRubricFeedback } from "./rubric";

export function homeworkQuestionWarning(policy: HomeworkQuestionWarningPolicy, feedback: HomeworkRubricFeedback) {
  if (!policy.enabled || !feedback.questions.length) return null;
  const scores = feedback.questions.map(rubricScore);
  const low = scores.flatMap((score, index) => score !== null && score < policy.thresholdPercent ? [{ question: index + 1, score }] : []);
  if (policy.mode === "any") return low.length ? { mode: policy.mode, threshold: policy.thresholdPercent, low, mean: null } : null;
  if (scores.some(score => score === null)) return null;
  const mean = Math.round(scores.reduce<number>((total, score) => total + score!, 0) / scores.length * 10_000) / 10_000;
  return mean < policy.thresholdPercent ? { mode: policy.mode, threshold: policy.thresholdPercent, low, mean } : null;
}

export function homeworkQuestionWarningMessages(warning: NonNullable<ReturnType<typeof homeworkQuestionWarning>>) {
  const score = (value: number) => Number(value.toFixed(4));
  const detail = warning.mode === "mean" ? `${score(warning.mean!)}%` : warning.low.map(item => `${item.question}: ${score(item.score)}%`).join(", ");
  const threshold = score(warning.threshold);
  return {
    en: warning.mode === "mean" ? `Challenge answers need review: average ${detail} is below ${threshold}%.` : `Challenge answers need review: question scores (${detail}) are below ${threshold}%.`,
    fr: warning.mode === "mean" ? `Réponses à vérifier : la moyenne de ${detail} est inférieure à ${threshold} %.` : `Réponses à vérifier : les notes des questions (${detail}) sont inférieures à ${threshold} %.`,
    zh: warning.mode === "mean" ? `需要复核问答：平均分 ${detail} 低于 ${threshold}%。` : `需要复核问答：题目得分（${detail}）低于 ${threshold}%。`,
    ar: warning.mode === "mean" ? `تحتاج الإجابات إلى مراجعة: المتوسط ${detail} أقل من ${threshold}%.` : `تحتاج الإجابات إلى مراجعة: درجات الأسئلة (${detail}) أقل من ${threshold}%.`
  };
}
