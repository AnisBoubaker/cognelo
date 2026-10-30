import type { StudentGradeFeedback } from "@/lib/api";

export function StudentFeedbackDetails({
  feedback,
  maxScore,
  t
}: {
  feedback: StudentGradeFeedback | null;
  maxScore: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (!feedback) {
    return null;
  }
  const parsonsDetails = getParsonsFeedbackDetails(feedback);
  const assessmentDetails = feedback.kind === "ai_assessment_feedback" || feedback.kind === "assessment_feedback"
    ? feedback.details ?? {}
    : null;
  const assessmentSummary = typeof assessmentDetails?.summary === "string" ? assessmentDetails.summary.trim() : "";
  const assessmentStrengths = readStringArray(assessmentDetails?.strengths);
  const assessmentImprovements = readStringArray(assessmentDetails?.improvements);
  const assessmentCriteria = readAiCriteria(assessmentDetails?.criteria);
  const assessmentQuestionFeedback = readAiQuestionFeedback(assessmentDetails?.questionFeedback);
  const hasAssessmentFeedback = Boolean(
    assessmentSummary
    || assessmentStrengths.length
    || assessmentImprovements.length
    || assessmentCriteria.length
    || assessmentQuestionFeedback.length
  );

  return (
    <div className="stack stack-tight">
      {feedback.feedbackText?.trim() ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          <p className="muted">{feedback.feedbackText}</p>
        </div>
      ) : null}
      {assessmentDetails && hasAssessmentFeedback ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.aiFeedbackTitle")}</strong>
          {assessmentSummary ? <p style={{ whiteSpace: "pre-wrap" }}>{assessmentSummary}</p> : null}
          {assessmentStrengths.length ? (
            <div>
              <strong>{t("groupPage.aiFeedbackStrengths")}</strong>
              {assessmentStrengths.map((item, index) => <p className="muted" key={index} style={{ whiteSpace: "pre-wrap" }}>{item}</p>)}
            </div>
          ) : null}
          {assessmentImprovements.length ? (
            <div>
              <strong>{t("groupPage.aiFeedbackImprovements")}</strong>
              {assessmentImprovements.map((item, index) => <p className="muted" key={index} style={{ whiteSpace: "pre-wrap" }}>{item}</p>)}
            </div>
          ) : null}
          {assessmentCriteria.map((criterion) => (
            <div className="inline-panel" key={criterion.id}>
              <strong>{criterion.title} · {criterion.scorePercent}%</strong>
              {criterion.feedback.trim() ? <p className="muted">{criterion.feedback}</p> : null}
            </div>
          ))}
          {assessmentQuestionFeedback.map((entry) => (
            <p className="muted" key={entry.questionId}>{entry.explanation}</p>
          ))}
        </div>
      ) : null}
      {feedback.kind === "mcq" && typeof feedback.details?.correctCount === "number" && typeof feedback.details?.questionCount === "number" ? (
        <p>{t("groupPage.correctAnswers", { count: feedback.details.correctCount, total: feedback.details.questionCount })}</p>
      ) : null}
      {parsonsDetails.messages.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          {parsonsDetails.messages.map((message) => (
            <p className="muted" key={message.type}>
              {message.type === "order"
                ? t("parsons.orderFeedback", { count: message.count })
                : t("parsons.indentFeedback", { count: message.count })}
            </p>
          ))}
        </div>
      ) : null}
      {parsonsDetails.grading.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.gradingBreakdownTitle")}</strong>
          {scaleFeedbackGrading(parsonsDetails.grading, maxScore).map((component) => (
            <p className="muted" key={component.type}>
              {t(component.type === "order" ? "groupPage.parsonsOrderScore" : "groupPage.parsonsIndentationScore", {
                score: formatGradeNumber(component.awarded),
                max: formatGradeNumber(component.possible)
              })}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim()] : [])
    : [];
}

function readAiCriteria(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const criterion = entry as Record<string, unknown>;
    return typeof criterion.title === "string" && typeof criterion.feedback === "string" && typeof criterion.scorePercent === "number"
      ? [{ id: typeof criterion.id === "string" ? criterion.id : String(index), title: criterion.title, feedback: criterion.feedback, scorePercent: criterion.scorePercent }]
      : [];
  });
}

function readAiQuestionFeedback(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const feedback = entry as Record<string, unknown>;
    return typeof feedback.explanation === "string"
      ? [{ questionId: typeof feedback.questionId === "string" ? feedback.questionId : String(index), explanation: feedback.explanation }]
      : [];
  });
}

type ParsonsFeedbackMessage = { type: "order" | "indentation"; count: number };
type ParsonsFeedbackGrading = { type: "order" | "indentation"; awardedRaw: number; possibleRaw: number };

function getParsonsFeedbackDetails(feedback: StudentGradeFeedback) {
  const details = feedback.kind === "parsons" && feedback.details && typeof feedback.details === "object" ? feedback.details : {};
  const messages = Array.isArray(details.messages)
    ? details.messages
        .map((message) => {
          const item = message && typeof message === "object" ? (message as Record<string, unknown>) : null;
          const type = item?.type;
          const count = typeof item?.count === "number" ? item.count : null;
          return (type === "order" || type === "indentation") && count !== null ? { type, count } : null;
        })
        .filter((message): message is ParsonsFeedbackMessage => message !== null)
    : [];
  const grading = Array.isArray(details.grading)
    ? details.grading
        .map((component) => {
          const item = component && typeof component === "object" ? (component as Record<string, unknown>) : null;
          const type = item?.type;
          const awardedRaw = typeof item?.awardedRaw === "number" ? item.awardedRaw : null;
          const possibleRaw = typeof item?.possibleRaw === "number" ? item.possibleRaw : null;
          return (type === "order" || type === "indentation") && awardedRaw !== null && possibleRaw !== null
            ? { type, awardedRaw, possibleRaw }
            : null;
        })
        .filter((component): component is ParsonsFeedbackGrading => component !== null)
    : [];
  return { messages, grading };
}

function scaleFeedbackGrading(grading: ParsonsFeedbackGrading[], maxScore: number) {
  const rawTotal = grading.reduce((sum, component) => sum + component.possibleRaw, 0);
  const scale = rawTotal > 0 ? maxScore / rawTotal : 1;
  return grading.map((component) => ({
    type: component.type,
    awarded: component.awardedRaw * scale,
    possible: component.possibleRaw * scale
  }));
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
