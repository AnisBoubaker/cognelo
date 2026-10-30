import type { StudentGradeFeedback } from "@/lib/api";
import { useI18n } from "../lib/i18n";
import { CodingExerciseStudentGradeReport } from "@cognelo/plugin-coding-exercises";
import { StudentFeedbackDetails } from "./student-feedback-details";

type TestBreakdownItem = {
  testItemId: string;
  title: string;
  activityTypeKey: string;
  pointsEarned: number | null;
  pointsPossible: number;
  feedback: StudentGradeFeedback | null;
  deterministicFeedback: StudentGradeFeedback | null;
  gradingReport: Record<string, unknown> | null;
};

export function TestGradeBreakdown({ feedback, heading, compact = false }: {
  feedback: StudentGradeFeedback | null;
  heading: string;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const items = parseTestBreakdown(feedback);
  if (!items.length) return null;
  return (
    <div className="stack stack-tight test-grade-breakdown">
      <strong>{heading}</strong>
      {items.map((item, index) => (
        <details className={compact ? "student-grade-details" : "inline-panel student-grade-details"} key={item.testItemId}>
          <summary>
            <span>{index + 1}. {item.title || t("groupPage.gradedExercise", { number: index + 1 })}</span>
            <strong>{item.pointsEarned === null ? t("groupPage.notGradedYet") : `${formatNumber(item.pointsEarned)} / ${formatNumber(item.pointsPossible)}`}</strong>
          </summary>
          <div className="stack student-grade-details-content">
            {item.activityTypeKey === "coding-exercise" && item.pointsEarned !== null ? (
              <CodingExerciseStudentGradeReport score={item.pointsEarned} maxScore={item.pointsPossible}
                feedback={item.feedback} locale={locale} report={item.gradingReport ?? { kind: "coding-exercise", attempts: [] }} />
            ) : <StudentFeedbackDetails feedback={item.feedback} maxScore={item.pointsPossible} t={t} />}
            <StudentFeedbackDetails feedback={item.deterministicFeedback} maxScore={item.pointsPossible} t={t} />
            {!item.feedback && !item.deterministicFeedback && !item.gradingReport ? <p className="muted">{t("groupPage.noGradingDetails")}</p> : null}
          </div>
        </details>
      ))}
    </div>
  );
}

export function parseTestBreakdown(feedback: StudentGradeFeedback | null): TestBreakdownItem[] {
  if (feedback?.kind !== "test" || !Array.isArray(feedback.details?.items)) return [];
  return feedback.details.items.flatMap((value, index) => {
    const item = record(value);
    if (typeof item.pointsPossible !== "number" || !Number.isFinite(item.pointsPossible)) return [];
    const child = record(item.feedback);
    const assessment = record(child.aiFeedback);
    const deterministic = record(child.studentFeedback);
    const comment = typeof child.feedbackText === "string" ? child.feedbackText : null;
    return [{
      testItemId: typeof item.testItemId === "string" ? item.testItemId : `item-${index}`,
      title: typeof item.title === "string" ? item.title : "",
      activityTypeKey: typeof item.activityTypeKey === "string" ? item.activityTypeKey : "unknown",
      pointsEarned: typeof item.pointsEarned === "number" && Number.isFinite(item.pointsEarned) ? item.pointsEarned : null,
      pointsPossible: item.pointsPossible,
      feedback: Object.keys(assessment).length || comment
        ? { kind: "assessment_feedback", feedbackText: comment, details: assessment } : null,
      deterministicFeedback: typeof deterministic.kind === "string" ? {
        kind: deterministic.kind,
        feedbackText: typeof deterministic.feedbackText === "string" ? deterministic.feedbackText : null,
        details: record(deterministic.details)
      } : null,
      gradingReport: item.gradingReport && typeof item.gradingReport === "object" && !Array.isArray(item.gradingReport)
        ? item.gradingReport as Record<string, unknown> : null
    }];
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
