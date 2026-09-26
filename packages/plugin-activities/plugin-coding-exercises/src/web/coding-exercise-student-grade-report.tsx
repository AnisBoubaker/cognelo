import { CodeRenderer } from "@cognelo/activity-ui";
import { formatCodingExercisesMessage, normalizeCodingExercisesLocale } from "./messages";

type StudentGradeFeedback = {
  kind: string;
  feedbackText?: string | null;
  details?: Record<string, unknown>;
} | null;

type StudentGradeReportTest = {
  id: string;
  name: string;
  passed: boolean | null;
  score: number | null;
  maxScore: number;
  statusLabel: string | null;
  message: string | null;
};

type StudentGradeReportAttempt = {
  attemptId: string;
  attemptNumber: number;
  executionId: string;
  isSelected: boolean;
  submittedAt: string;
  language: string;
  sourceCode: string;
  testScore: number | null;
  testMaxScore: number | null;
  tests: StudentGradeReportTest[];
};

export type CodingExerciseStudentGradeReportData = {
  kind: "coding-exercise";
  attempts: StudentGradeReportAttempt[];
};

export type CodingExerciseStudentGradeReportProps = {
  score: number;
  maxScore: number;
  feedback: StudentGradeFeedback;
  report: Record<string, unknown>;
  locale?: string;
};

export function CodingExerciseStudentGradeReport({ score, maxScore, feedback, report, locale }: CodingExerciseStudentGradeReportProps) {
  const pluginLocale = normalizeCodingExercisesLocale(locale);
  const t = (key: Parameters<typeof formatCodingExercisesMessage>[1], values?: Record<string, string | number>) =>
    formatCodingExercisesMessage(pluginLocale, key, values);
  const parsedReport = parseCodingExerciseStudentGradeReport(report);
  if (!parsedReport) return null;

  const details = feedback?.details ?? {};
  const criteria = recordArray(details.criteria);
  const selectedAttempt = parsedReport.attempts.find((attempt) => attempt.isSelected)
    ?? parsedReport.attempts.at(-1)
    ?? null;
  const recap = getGradeRecap({ score, maxScore, details, criteria, selectedAttempt });
  const feedbackText = feedback?.feedbackText?.trim() ?? "";
  const summary = stringValue(details.summary).trim();
  const strengths = stringArray(details.strengths);
  const improvements = stringArray(details.improvements);
  const hasTeacherComments = Boolean(feedbackText || summary || strengths.length || improvements.length);

  return (
    <section className="stack coding-exercise-grade-report">
      <h3>{t("gradingReportTitle")}</h3>

      <section className="stack stack-tight">
        <h4>{t("gradeRecapTitle")}</h4>
        <div className="coding-exercise-grade-recap">
          {recap.automatic ? (
            <GradeRecapItem label={t("automaticTestsGrade")} score={recap.automatic.score} maxScore={recap.automatic.maxScore} />
          ) : null}
          {recap.rubric ? (
            <GradeRecapItem label={t("rubricGrade")} score={recap.rubric.score} maxScore={recap.rubric.maxScore} />
          ) : null}
          <GradeRecapItem label={t("totalGrade")} score={score} maxScore={maxScore} />
        </div>
      </section>

      {hasTeacherComments ? (
        <section className="inline-panel stack stack-tight">
          <h4>{t("teacherCommentsTitle")}</h4>
          {feedbackText ? <CommentBlock label={t("teacherComment")} text={feedbackText} /> : null}
          {summary ? <CommentBlock label={t("feedbackSummary")} text={summary} /> : null}
          {strengths.length ? <CommentList label={t("aiFeedbackStrengths")} values={strengths} /> : null}
          {improvements.length ? <CommentList label={t("aiFeedbackImprovements")} values={improvements} /> : null}
        </section>
      ) : null}

      {criteria.length && recap.rubric ? (
        <section className="stack stack-tight">
          <h4>{t("rubricDetailsTitle")}</h4>
          {criteria.map((criterion, index) => {
            const scorePercent = finiteNumber(criterion.scorePercent);
            const weightPercent = finiteNumber(criterion.weightPercent);
            const possible = recap.rubric && weightPercent !== null
              ? recap.rubric.maxScore * weightPercent / 100
              : null;
            const awarded = possible !== null && scorePercent !== null ? possible * scorePercent / 100 : null;
            return (
              <div className="inline-panel stack stack-tight" key={stringValue(criterion.id) || index}>
                <div className="row wrap" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
                  <strong>{stringValue(criterion.title) || t("rubricCriterion", { number: index + 1 })}</strong>
                  <span className="muted">
                    {awarded !== null && possible !== null
                      ? t("rubricCriterionPoints", { score: formatGradeNumber(awarded), max: formatGradeNumber(possible) })
                      : scorePercent !== null
                        ? t("rubricCriterionPercent", { score: formatGradeNumber(scorePercent) })
                        : null}
                  </span>
                </div>
                {stringValue(criterion.feedback).trim() ? (
                  <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{stringValue(criterion.feedback).trim()}</p>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      {parsedReport.attempts.length ? (
        <section className="stack stack-tight">
          <h4>{t("gradedAttemptsTitle")}</h4>
          {parsedReport.attempts.map((attempt) => (
            <details className="coding-exercise-attempt-accordion" key={attempt.attemptId} open={parsedReport.attempts.length === 1}>
              <summary>
                <span>{t("attemptNumber", { number: attempt.attemptNumber })}</span>
                <time dateTime={attempt.submittedAt}>{new Date(attempt.submittedAt).toLocaleString(pluginLocale)}</time>
                {attempt.isSelected ? <span className="metadata-badge">{t("selectedForFinalGrade")}</span> : <span />}
              </summary>
              <div className="stack coding-exercise-attempt-content">
                <div className="stack stack-tight">
                  <strong>{t("submittedSolution")}</strong>
                  <CodeRenderer code={attempt.sourceCode} language={attempt.language || "text"} showLineNumbers />
                </div>
                <section className="stack stack-tight">
                  <div className="row wrap" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
                    <strong>{t("testResultsTitle")}</strong>
                    {attempt.testScore !== null && attempt.testMaxScore !== null ? (
                      <span className="muted">{t("testTotalScore", {
                        score: formatGradeNumber(attempt.testScore),
                        max: formatGradeNumber(attempt.testMaxScore)
                      })}</span>
                    ) : null}
                  </div>
                  {attempt.tests.length ? attempt.tests.map((test, index) => {
                    const outcome = test.passed === null
                      ? test.statusLabel ?? ""
                      : t(test.passed ? "passed" : "failed");
                    return (
                      <div className="inline-panel stack stack-tight" key={test.id || index}>
                        <div className="row wrap" style={{ alignItems: "center", justifyContent: "space-between" }}>
                          <span>{test.name || t("testNumber", { number: index + 1 })}</span>
                          <span className="row wrap" style={{ alignItems: "center" }}>
                            <span className="muted">{test.score === null
                              ? t("testScoreUnavailable")
                              : t("testScore", { score: formatGradeNumber(test.score), max: formatGradeNumber(test.maxScore) })}</span>
                            {test.passed === null ? (
                              outcome ? <span className="muted">{outcome}</span> : null
                            ) : (
                              <span
                                aria-label={outcome}
                                role="img"
                                style={{ color: test.passed ? "#157347" : "#b42318", fontSize: 20, fontWeight: 700, lineHeight: 1 }}
                                title={outcome}
                              >
                                {test.passed ? "✓" : "✕"}
                              </span>
                            )}
                          </span>
                        </div>
                        {test.message ? <p className="muted" style={{ margin: 0, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{test.message}</p> : null}
                      </div>
                    );
                  }) : <p className="muted">{t("noTestDetails")}</p>}
                </section>
              </div>
            </details>
          ))}
        </section>
      ) : null}
    </section>
  );
}

function GradeRecapItem({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  return (
    <div className="inline-panel stack stack-tight">
      <span className="muted">{label}</span>
      <strong>{formatGradeNumber(score)} / {formatGradeNumber(maxScore)}</strong>
    </div>
  );
}

function CommentBlock({ label, text }: { label: string; text: string }) {
  return <div><strong>{label}</strong><p style={{ whiteSpace: "pre-wrap" }}>{text}</p></div>;
}

function CommentList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <strong>{label}</strong>
      <ul>{values.map((value, index) => <li key={index} style={{ whiteSpace: "pre-wrap" }}>{value}</li>)}</ul>
    </div>
  );
}

function getGradeRecap(input: {
  score: number;
  maxScore: number;
  details: Record<string, unknown>;
  criteria: Record<string, unknown>[];
  selectedAttempt: StudentGradeReportAttempt | null;
}) {
  const gradingEnabled = input.details.gradingEnabled === true;
  const deterministicScore = finiteNumber(input.details.deterministicScore)
    ?? percentFromRatio(input.selectedAttempt?.testScore, input.selectedAttempt?.testMaxScore);
  const testWeightPercent = gradingEnabled ? finiteNumber(input.details.testWeightPercent) : deterministicScore === null ? null : 100;
  const rubricWeightPercent = gradingEnabled ? finiteNumber(input.details.aiWeightPercent) : null;
  const criterionWeight = input.criteria.reduce((total, criterion) => total + (finiteNumber(criterion.weightPercent) ?? 0), 0);
  const rubricScore = finiteNumber(input.details.aiScore) ?? (criterionWeight > 0
    ? input.criteria.reduce(
        (total, criterion) => total + (finiteNumber(criterion.scorePercent) ?? 0) * (finiteNumber(criterion.weightPercent) ?? 0),
        0
      ) / criterionWeight
    : null);
  const automaticMax = testWeightPercent !== null && testWeightPercent > 0 ? input.maxScore * testWeightPercent / 100 : null;
  const rubricMax = rubricWeightPercent !== null && rubricWeightPercent > 0 ? input.maxScore * rubricWeightPercent / 100 : null;
  return {
    automatic: automaticMax !== null && deterministicScore !== null
      ? { score: automaticMax * deterministicScore / 100, maxScore: automaticMax }
      : null,
    rubric: rubricMax !== null && rubricScore !== null
      ? { score: rubricMax * rubricScore / 100, maxScore: rubricMax }
      : null
  };
}

export function parseCodingExerciseStudentGradeReport(value: unknown): CodingExerciseStudentGradeReportData | null {
  const root = recordValue(value);
  if (root.kind !== "coding-exercise" || !Array.isArray(root.attempts)) return null;
  return {
    kind: "coding-exercise",
    attempts: root.attempts.flatMap((value) => {
      const attempt = recordValue(value);
      const attemptId = stringValue(attempt.attemptId);
      const attemptNumber = finiteNumber(attempt.attemptNumber);
      const submittedAt = stringValue(attempt.submittedAt);
      if (!attemptId || attemptNumber === null || !submittedAt) return [];
      return [{
        attemptId,
        attemptNumber,
        executionId: stringValue(attempt.executionId),
        isSelected: attempt.isSelected === true,
        submittedAt,
        language: stringValue(attempt.language),
        sourceCode: stringValue(attempt.sourceCode),
        testScore: finiteNumber(attempt.testScore),
        testMaxScore: finiteNumber(attempt.testMaxScore),
        tests: recordArray(attempt.tests).map((value, index) => ({
          id: stringValue(value.id) || `test-${index + 1}`,
          name: stringValue(value.name),
          passed: typeof value.passed === "boolean" ? value.passed : null,
          score: finiteNumber(value.score),
          maxScore: finiteNumber(value.maxScore) ?? 1,
          statusLabel: stringValue(value.statusLabel) || null,
          message: stringValue(value.message) || null
        }))
      }];
    })
  };
}

function percentFromRatio(score: number | null | undefined, maxScore: number | null | undefined) {
  return score !== null && score !== undefined && maxScore !== null && maxScore !== undefined && maxScore > 0
    ? score / maxScore * 100
    : null;
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}
