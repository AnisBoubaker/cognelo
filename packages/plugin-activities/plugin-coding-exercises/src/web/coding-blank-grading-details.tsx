import { codingBlankGradingSchema } from "../code-blanks";
import { formatCodingExercisesMessage, normalizeCodingExercisesLocale } from "./messages";

export function CodingBlankGradingDetails({ grading, reviewRequired, teacher = false, locale }: {
  grading: unknown; reviewRequired: boolean; teacher?: boolean; locale?: string;
}) {
  const parsed = codingBlankGradingSchema.safeParse(grading);
  const t = (key: Parameters<typeof formatCodingExercisesMessage>[1], values?: Record<string, string | number>) =>
    formatCodingExercisesMessage(normalizeCodingExercisesLocale(locale), key, values);
  if (!parsed.success && !reviewRequired) return null;
  return <section className="inline-panel stack coding-blank-grading-details">
    {reviewRequired && !teacher ? <div className="error">
      <strong>{t("blankReviewedGradeTitle")}</strong>
      <p>{t("blankReviewedGradeMessage")}</p>
    </div> : null}
    {parsed.success ? <>
      <h4>{t("blankChecksTitle")}</h4>
      <p>{t("blankChecksScore", { correct: parsed.data.correct, total: parsed.data.total })}</p>
      {parsed.data.outcomes.map(outcome => <div className="row" key={outcome.id} style={{ justifyContent: "space-between" }}>
        <span>{outcome.fileName ? `${outcome.fileName} · ` : ""}{t("codeBlankNumber", { number: outcome.number })}</span>
        <span>{t(!outcome.answered ? "blankUnanswered" : outcome.correct ? "blankCorrect" : "blankIncorrect")}</span>
      </div>)}
    </> : null}
  </section>;
}
