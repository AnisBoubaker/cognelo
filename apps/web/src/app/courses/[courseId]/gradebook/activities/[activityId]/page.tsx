"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { createCodingHomeworkGraderClient, type CodingHomeworkGradebookAttemptRecord } from "@cognelo/plugin-coding-homework-grader";
import { createMcqClient, type McqSubmission } from "@cognelo/plugin-mcq";
import { createParsonsClient, type ParsonsGradebookAttemptRecord } from "@cognelo/plugin-parsons";
import { AppShell } from "@/components/app-shell";
import { TestReviewAllPanel } from "@/components/test-review-all-panel";
import { ActivityReviewAllPanel, toActivityReviewResponse, type ActivityReviewResponse } from "@/components/activity-review-all-panel";
import {
  api,
  apiRequest,
  Course,
  CourseGradebook,
  CourseGradebookRow,
  CourseTestAttemptReview,
  GradebookMutationAttempt,
  GradebookMutationGrade
} from "@/lib/api";
import { getManualGradingRenderer, renderTestReviewAllItem } from "@/lib/activity-renderers";
import { useI18n } from "@/lib/i18n";
import { latestCompletedTestAttempt, type TestReviewAllSubmission } from "@/lib/test-review-all";

type GradebookReviewAttempt = ParsonsGradebookAttemptRecord | McqSubmission | CodingHomeworkGradebookAttemptRecord | CourseTestAttemptReview;

export default function GradebookActivityResultsPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const searchParams = useSearchParams();
  const { courseId, activityId } = params;
  const groupId = searchParams.get("groupId") || undefined;
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const codingHomeworkClient = useMemo(() => createCodingHomeworkGraderClient(apiRequest), []);
  const mcqClient = useMemo(() => createMcqClient(apiRequest), []);
  const parsonsClient = useMemo(() => createParsonsClient(apiRequest), []);
  const [course, setCourse] = useState<Course | null>(null);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [savingGradeKey, setSavingGradeKey] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<{
    row: CourseGradebookRow;
    mode: "review" | "grade";
    activityConfig?: Record<string, unknown>;
    includeAttempts: boolean;
    attempts: GradebookReviewAttempt[];
    selectedIndex: number;
    loading: boolean;
    error: string;
  } | null>(null);
  const [reviewAll, setReviewAll] = useState<{
    loading: boolean;
    error: string;
    submissions: TestReviewAllSubmission[];
    activityTypeKey?: string;
    config?: Record<string, unknown>;
    responses?: ActivityReviewResponse[];
    solution?: unknown;
    tests?: Array<{ id: string; name: string }>;
    mcqContext?: Parameters<typeof renderTestReviewAllItem>[0];
  } | null>(null);

  async function refresh() {
    const [courseResult, gradebookResult] = await Promise.all([
      api.course(courseId),
      api.courseGradebook(courseId, { activityId, groupId })
    ]);
    setCourse(courseResult.course);
    setGradebook(gradebookResult.gradebook);
  }

  useEffect(() => {
    refresh().catch((err) => notifications.error(err instanceof Error ? err.message : t("courseDetail.loadError")));
  }, [activityId, courseId, groupId, notifications, t]);

  const rows = gradebook?.rows ?? [];
  const activityTitle = rows[0]?.activityTitle ?? gradebook?.items[0]?.activityTitle ?? t("common.loading");
  const groupTitle = groupId ? gradebook?.items.find((item) => item.groupId === groupId)?.groupTitle : null;
  const backHref = groupId ? `/courses/${courseId}?tab=gradebook&groupId=${encodeURIComponent(groupId)}` : `/courses/${courseId}?tab=gradebook`;
  const backLabel = t("courseDetail.backToCourseGradebook");
  const manualGradingRenderer = rows[0]?.activityTypeKey ? getManualGradingRenderer(rows[0].activityTypeKey) : null;
  const selectedAttempt = overlay?.attempts[overlay.selectedIndex] ?? null;
  const hasRowsWithSubmittedAttempts = rows.some((row) => hasSubmittedAttempt(row));
  const isTest = rows[0]?.activityTypeKey === "test" || gradebook?.items[0]?.activityTypeKey === "test";

  async function openReviewAll() {
    setReviewAll({ loading: true, error: "", submissions: [] });
    try {
      const activityTypeKey = rows[0]?.activityTypeKey ?? gradebook?.items[0]?.activityTypeKey ?? "";
      if (activityTypeKey !== "test") {
        const activityResult = await api.activity(courseId, activityId);
        let solution: unknown = null;
        let tests: Array<{ id: string; name: string }> = [];
        let aggregateResults = new Map<string, Array<{ testId: string; name: string; passed: boolean }>>();
        if (activityTypeKey === "coding-exercise") {
          const [definition, review] = await Promise.all([api.codingExerciseHiddenTests(courseId, activityId), api.codingExerciseReviewAll(courseId, activityId)]);
          solution = definition.referenceSolution?.sourceCode ?? null;
          tests = definition.tests.filter((test) => test.isEnabled).map((test) => ({ id: test.id, name: test.name }));
          aggregateResults = new Map(review.submissions.map(({ participantId, execution }) => [participantId, normalizeCodingTestResults(execution.resultSummary.tests)]));
        }
        if (activityTypeKey === "web-design-coding-exercise") {
          const [definition, review] = await Promise.all([api.webDesignExerciseTests(courseId, activityId), api.webDesignExerciseReviewAll(courseId, activityId)]);
          solution = definition.referenceBundle?.files ?? null;
          tests = definition.tests.filter((test) => test.isEnabled && test.kind === "hidden").map((test) => ({ id: test.id, name: test.name }));
          aggregateResults = new Map(review.submissions.map(({ participantId, submission }) => [participantId, submission.testResults.flatMap((result) => result.testId ? [{ testId: result.testId, name: result.name, passed: result.status === "completed" && (result.score ?? 0) >= result.weight }] : [])]));
        }
        const loaded = await Promise.all(rows.map(async (row) => {
          if (activityTypeKey === "mcq") {
            const result = await mcqClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, { participantId: row.participantId });
            return { row, state: result.attempts[0] ? { answers: result.attempts[0].answers } : null };
          }
          if (activityTypeKey === "parsons-problem") {
            const result = await parsonsClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, { participantId: row.participantId });
            return { row, state: result.attempts[0]?.latestState ?? null };
          }
          return { row, state: null };
        }));
        const responses = loaded.map(({ row, state }) => ({ ...toActivityReviewResponse(row, state), testResults: aggregateResults.get(row.participantId) }));
        let mcqContext: Parameters<typeof renderTestReviewAllItem>[0] | undefined;
        if (activityTypeKey === "mcq") {
          const makeItem = (response?: ActivityReviewResponse) => ({
            testItemId: activityId,
            title: activityTitle,
            activityTypeKey,
            activity: activityResult.activity,
            itemAttempt: {
              state: response?.state ?? {},
              normalizedScore: response?.score ?? null,
              normalizedMaxScore: response?.maxScore ?? null
            }
          });
          mcqContext = {
            item: makeItem(responses[0]),
            responses: responses.map((response) => ({ participantId: response.participantId, participantName: response.participantName, groupTitle: response.groupTitle, item: makeItem(response) })),
            t
          } as Parameters<typeof renderTestReviewAllItem>[0];
        }
        setReviewAll({ loading: false, error: "", submissions: [], activityTypeKey, config: activityResult.activity.config ?? {}, responses, solution, tests, mcqContext });
        return;
      }
      const reviewTargets = rows.flatMap((row) => {
        const attempt = latestCompletedTestAttempt(row);
        return attempt ? [{ row, attempt }] : [];
      });
      const submissions = await Promise.all(reviewTargets.map(async ({ row, attempt }) => ({
        participantId: row.participantId,
        participantName: row.participantName,
        groupTitle: row.groupTitle,
        durationSeconds: attempt.durationSeconds,
        isLate: attempt.isLate,
        review: (await api.testAttemptReview(courseId, attempt.id)).review
      })));
      setReviewAll({ loading: false, error: "", submissions });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("courseDetail.answerLoadError");
      notifications.error(message);
      setReviewAll({ loading: false, error: message, submissions: [] });
    }
  }

  async function openManualGrading(row: CourseGradebookRow, mode: "review" | "grade") {
    setOverlay({ row, mode, includeAttempts: false, attempts: [], selectedIndex: 0, loading: true, error: "" });
    await loadAttempts(row, false);
  }

  async function loadAttempts(row: CourseGradebookRow, includeAttempts: boolean) {
    setOverlay((current) => (current ? { ...current, includeAttempts, loading: true, error: "" } : current));
    try {
      if (row.activityTypeKey === "test") {
        const parentAttempts = row.attempts.filter((attempt) => attempt.lifecycle === "submitted" || attempt.lifecycle === "graded");
        const reviews = await Promise.all(parentAttempts.map((attempt) => api.testAttemptReview(courseId, attempt.id)));
        setOverlay((current) => current ? {
          ...current,
          includeAttempts,
          attempts: sortAttemptsByDisplayedTimestamp(reviews.map((result) => result.review)),
          selectedIndex: 0,
          loading: false,
          error: ""
        } : current);
        return;
      }
      const [attemptsResult, activityResult] = await Promise.all([
        row.activityTypeKey === "mcq"
          ? mcqClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
              participantId: row.participantId
            })
          : row.activityTypeKey === "coding-homework-grader"
            ? codingHomeworkClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
                participantId: row.participantId,
                includeAttempts
              })
          : parsonsClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
              participantId: row.participantId,
              includeAttempts
            }),
        api.groupActivity(courseId, row.groupId, row.activityId)
      ]);
      const attempts = sortAttemptsByDisplayedTimestamp(attemptsResult.attempts);
      setOverlay((current) =>
        current
          ? {
              ...current,
              activityConfig: activityResult.activity.config ?? {},
              includeAttempts,
              attempts,
              selectedIndex: Math.min(current.selectedIndex, Math.max(0, attempts.length - 1)),
              loading: false,
              error: ""
            }
          : current
      );
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.answerLoadError"));
      setOverlay((current) =>
        current
          ? {
              ...current,
              includeAttempts,
              loading: false,
              error: ""
            }
          : current
      );
    }
  }

  function applyUpdatedGrade(row: CourseGradebookRow, grade: GradebookMutationGrade, attempt?: GradebookMutationAttempt) {
    setGradebook((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        rows: current.rows.map((candidate) => {
          if (candidate.gradebookItemId !== row.gradebookItemId || candidate.participantId !== row.participantId) {
            return candidate;
          }

          const attempts = attempt
            ? candidate.attempts.map((candidateAttempt) =>
                candidateAttempt.id === attempt.id
                  ? {
                      ...candidateAttempt,
                      lifecycle: attempt.lifecycle,
                      submittedAt: attempt.submittedAt,
                      gradedAt: attempt.gradedAt,
                      isLate: attempt.isLate,
                      lateBySeconds: attempt.lateBySeconds,
                      durationSeconds: attempt.durationSeconds
                    }
                  : candidateAttempt
              )
            : candidate.attempts;
          const selectedAttempt = grade.selectedAttemptId
            ? attempts.find((candidateAttempt) => candidateAttempt.id === grade.selectedAttemptId)
            : null;

          return {
            ...candidate,
            score: grade.normalizedScore,
            maxScore: grade.normalizedMaxScore,
            isPass: grade.isPass,
            latePenaltyApplied: grade.latePenaltyApplied,
            latePenaltyPercent: grade.latePenaltyPercent,
            selectedAttemptNumber: selectedAttempt?.attemptNumber ?? null,
            status: grade.latePenaltyApplied || selectedAttempt?.isLate ? "late" : "graded",
            needsGradingCount: attempt?.lifecycle === "graded" ? Math.max(0, candidate.needsGradingCount - 1) : candidate.needsGradingCount,
            attempts
          };
        })
      };
    });
  }

  async function overrideGrade(row: CourseGradebookRow, input: { score: number; maxScore: number; reason: string | null; feedbackText?: string | null }) {
    setSavingGradeKey(`${row.gradebookItemId}:${row.participantId}:override`);
    try {
      const result = await api.overrideGradebookGrade(courseId, row.gradebookItemId, row.participantId, {
        score: input.score,
        maxScore: input.maxScore,
        reason: input.reason,
        feedbackText: input.feedbackText ?? input.reason
      });
      await refresh();
      applyUpdatedGrade(row, result.grade);
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.overrideGradeError"));
    } finally {
      setSavingGradeKey(null);
    }
  }

  async function regradeRow(row: CourseGradebookRow) {
    const attempt =
      row.attempts.find((candidate) => candidate.attemptNumber === row.selectedAttemptNumber) ??
      [...row.attempts].reverse().find((candidate) => candidate.lifecycle === "graded" || candidate.lifecycle === "submitted");
    if (!attempt) {
      notifications.error(t("courseDetail.regradeUnavailable"));
      return;
    }
    if (!window.confirm(t("courseDetail.regradeConfirm", { name: row.participantName }))) {
      return;
    }

    setSavingGradeKey(`${row.gradebookItemId}:${row.participantId}:regrade`);
    try {
      const result = await api.regradeActivityAttempt(courseId, attempt.id, { reason: t("courseDetail.regradeReason") });
      await refresh();
      applyUpdatedGrade(row, result.result.grade, result.result.attempt);
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.regradeError"));
    } finally {
      setSavingGradeKey(null);
    }
  }

  async function gradeTestItem(row: CourseGradebookRow, parentAttemptId: string, testItemId: string, score: number, reason: string | null) {
    try {
      await api.gradeTestItem(courseId, parentAttemptId, testItemId, { score, reason });
      await refresh();
      setOverlay(null);
      notifications.success("Test item grade saved.");
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.overrideGradeError"));
    }
  }

  async function deleteSelectedSubmission(row: CourseGradebookRow, selectedAttempt: GradebookReviewAttempt | null) {
    if (!selectedAttempt) {
      notifications.error(t("courseDetail.deleteSubmissionUnavailable"));
      return;
    }

    const coreAttempt = row.attempts.find((attempt) => attempt.pluginAttemptRef === selectedAttempt.id);
    if (!coreAttempt) {
      notifications.error(t("courseDetail.deleteSubmissionUnavailable"));
      return;
    }

    const reason = window.prompt(t("courseDetail.deleteSubmissionPrompt"));
    if (reason === null) {
      return;
    }
    const normalizedReason = reason.trim() || t("courseDetail.deleteSubmissionReasonFallback");
    if (!window.confirm(t("courseDetail.deleteSubmissionConfirm", { name: row.participantName, number: coreAttempt.attemptNumber }))) {
      return;
    }

    setSavingGradeKey(`${row.gradebookItemId}:${row.participantId}:delete`);
    try {
      await api.deleteActivitySubmission(courseId, coreAttempt.id, { reason: normalizedReason });
      await refresh();
      setOverlay((current) =>
        current
          ? {
              ...current,
              attempts: current.attempts.filter((attempt) => attempt.id !== selectedAttempt.id),
              selectedIndex: Math.max(0, current.selectedIndex - 1)
            }
          : current
      );
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.deleteSubmissionError"));
    } finally {
      setSavingGradeKey(null);
    }
  }

  async function regradeAllRows() {
    const rowsWithAttempts = groupedRows.filter(
      (row) =>
        row.activityTypeKey !== "coding-homework-grader" &&
        row.attempts.some((candidate) => candidate.lifecycle === "graded" || candidate.lifecycle === "submitted")
    );
    if (!rowsWithAttempts.length) {
      notifications.error(t("courseDetail.regradeUnavailable"));
      return;
    }
    if (!window.confirm(t("courseDetail.regradeAllConfirm", { count: rowsWithAttempts.length }))) {
      return;
    }

    setSavingGradeKey("__all:regrade");
    try {
      for (const row of rowsWithAttempts) {
        const attempt =
          row.attempts.find((candidate) => candidate.attemptNumber === row.selectedAttemptNumber) ??
          [...row.attempts].reverse().find((candidate) => candidate.lifecycle === "graded" || candidate.lifecycle === "submitted");
        if (attempt) {
          await api.regradeActivityAttempt(courseId, attempt.id, { reason: t("courseDetail.regradeReason") });
        }
      }
      await refresh();
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.regradeError"));
    } finally {
      setSavingGradeKey(null);
    }
  }

  const groupedRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const groupDelta = left.groupTitle.localeCompare(right.groupTitle);
      return groupDelta === 0 ? left.participantName.localeCompare(right.participantName) : groupDelta;
    });
  }, [rows]);

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{t("courseDetail.gradebookEyebrow")}</p>
            <h1>{activityTitle}</h1>
            <p className="muted">
              {course?.title ?? t("common.loading")}
              {groupTitle ? ` · ${groupTitle}` : ""}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button secondary" href={backHref}>
              {backLabel}
            </Link>
          </div>
        </section>

        <section className="section stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("courseDetail.detailedResults")}</p>
              <h2>{t("courseDetail.studentResultsTitle")}</h2>
            </div>
            <div className="row wrap">
              <button className="button secondary" type="button" onClick={() => void openReviewAll()}>
                {t("courseDetail.reviewAll")}
              </button>
              <button className="button secondary" disabled={savingGradeKey === "__all:regrade"} type="button" onClick={() => void regradeAllRows()}>
                {savingGradeKey === "__all:regrade" ? t("common.saving") : t("courseDetail.regradeAll")}
              </button>
              {hasRowsWithSubmittedAttempts ? (
                <Link
                  className="button secondary"
                  href={`/courses/${courseId}/gradebook/activities/${activityId}/manual${groupId ? `?groupId=${groupId}` : ""}`}
                >
                  {t("courseDetail.gradeAllManually")}
                </Link>
              ) : (
                <button className="button secondary" disabled type="button">
                  {t("courseDetail.gradeAllManually")}
                </button>
              )}
            </div>
          </div>

          {groupedRows.length ? (
            <div className="table-list table-list-gradebook-detail">
              <div className="table-row table-row-gradebook-detail table-head" aria-hidden="true">
                <span>{t("courseDetail.studentHeader")}</span>
                <span>{t("courseDetail.groupHeader")}</span>
                <span>{t("courseDetail.gradeHeader")}</span>
                <span>{t("courseDetail.submissionsHeader")}</span>
                <span>{t("courseDetail.actionsHeader")}</span>
              </div>
              {groupedRows.map((row) => (
                <GradebookStudentRow
                  key={`${row.gradebookItemId}-${row.participantId}`}
                  manualGradingAvailable={Boolean(manualGradingRenderer)}
                  row={row}
                  savingGradeKey={savingGradeKey}
                  onOpenReview={(row) => openManualGrading(row, "review")}
                  onOpenManualGrading={(row) => openManualGrading(row, "grade")}
                  onRegrade={regradeRow}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <p className="muted">{t("courseDetail.noGradebookRows")}</p>
          )}
        </section>

        {overlay ? (
          <div
            className="dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setOverlay(null);
              }
            }}
          >
            {manualGradingRenderer
              ? manualGradingRenderer({
                  row: overlay.row,
                  activityConfig: overlay.activityConfig,
                  locale,
                  attempts: overlay.attempts,
                  selectedAttempt,
                  selectedIndex: overlay.selectedIndex,
                  includeAttempts: overlay.includeAttempts,
                  loading: overlay.loading,
                  error: overlay.error,
                  readOnly: overlay.mode === "review",
                  isSavingOverride: savingGradeKey === `${overlay.row.gradebookItemId}:${overlay.row.participantId}:override`,
                  isSavingRegrade: savingGradeKey === `${overlay.row.gradebookItemId}:${overlay.row.participantId}:regrade`,
                  isSavingDelete: savingGradeKey === `${overlay.row.gradebookItemId}:${overlay.row.participantId}:delete`,
                  onClose: () => setOverlay(null),
                  onIncludeAttemptsChange: (includeAttempts) => loadAttempts(overlay.row, includeAttempts),
                  onSelectAttemptIndex: (selectedIndex) => setOverlay((current) => (current ? { ...current, selectedIndex } : current)),
                  onOverrideGrade: (input) => overrideGrade(overlay.row, input),
                  onRegradeAttempt: () => regradeRow(overlay.row),
                  onDeleteSubmission: () => deleteSelectedSubmission(overlay.row, selectedAttempt),
                  onGradeTestItem: (parentAttemptId, testItemId, score, reason) => gradeTestItem(overlay.row, parentAttemptId, testItemId, score, reason),
                  t
                })
              : null}
          </div>
        ) : null}
        {reviewAll ? (
          <div
            className="dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setReviewAll(null);
            }}
          >
            {isTest ? <TestReviewAllPanel
              activityTitle={activityTitle}
              participantCount={rows.length}
              submissions={reviewAll.submissions}
              loading={reviewAll.loading}
              error={reviewAll.error}
              onClose={() => setReviewAll(null)}
              renderItem={renderTestReviewAllItem}
              t={t}
            /> : <ActivityReviewAllPanel
              activityTypeKey={reviewAll.activityTypeKey ?? rows[0]?.activityTypeKey ?? ""}
              activityTitle={activityTitle}
              config={reviewAll.config ?? {}}
              responses={reviewAll.responses ?? []}
              solution={reviewAll.solution}
              tests={reviewAll.tests}
              mcqReport={reviewAll.mcqContext ? renderTestReviewAllItem(reviewAll.mcqContext) : null}
              loading={reviewAll.loading}
              error={reviewAll.error}
              onClose={() => setReviewAll(null)}
              t={t}
            />}
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

function GradebookStudentRow({
  manualGradingAvailable,
  row,
  savingGradeKey,
  onOpenManualGrading,
  onOpenReview,
  onRegrade,
  t
}: {
  manualGradingAvailable: boolean;
  row: CourseGradebookRow;
  savingGradeKey: string | null;
  onOpenManualGrading: (row: CourseGradebookRow) => Promise<void>;
  onOpenReview: (row: CourseGradebookRow) => Promise<void>;
  onRegrade: (row: CourseGradebookRow) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const rowHasSubmittedAttempt = hasSubmittedAttempt(row);
  const regradeAvailable = row.activityTypeKey !== "coding-homework-grader";

  return (
    <div className="table-row table-row-gradebook-detail">
      <div className="table-main table-main-stack">
        <strong>{row.participantName}</strong>
        <span className="table-meta-note muted">{row.participantEmail}</span>
      </div>
      <span className="table-meta muted">{row.groupTitle}</span>
      <strong>{rowHasSubmittedAttempt || row.score !== null ? formatGradebookScore(row.score, row.maxScore) : t("courseDetail.didNotSubmit")}</strong>
      <span className="table-meta muted">{row.submittedAttemptCount}</span>
      <div className="table-actions">
        {manualGradingAvailable ? (
          <button className="button secondary" disabled={!rowHasSubmittedAttempt} type="button" onClick={() => onOpenReview(row)}>
            {t("courseDetail.reviewGrade")}
          </button>
        ) : (
          <span className="muted">{t("courseDetail.answerUnavailable")}</span>
        )}
        <button
          className="button secondary"
          disabled={!regradeAvailable || !rowHasSubmittedAttempt || savingGradeKey === `${row.gradebookItemId}:${row.participantId}:regrade`}
          type="button"
          onClick={() => onRegrade(row)}
        >
          {t("courseDetail.regrade")}
        </button>
        <button
          className="button secondary"
          disabled={!manualGradingAvailable || !rowHasSubmittedAttempt || savingGradeKey === `${row.gradebookItemId}:${row.participantId}:override`}
          type="button"
          onClick={() => onOpenManualGrading(row)}
        >
          {t("courseDetail.overrideGrade")}
        </button>
      </div>
    </div>
  );
}

function normalizeCodingTestResults(value: unknown): Array<{ testId: string; name: string; passed: boolean }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const result = entry as Record<string, unknown>;
    return typeof result.id === "string" && typeof result.name === "string" && typeof result.passed === "boolean"
      ? [{ testId: result.id, name: result.name, passed: result.passed }]
      : [];
  });
}

function hasSubmittedAttempt(row: CourseGradebookRow) {
  return row.attempts.some((attempt) => attempt.lifecycle === "graded" || attempt.lifecycle === "submitted");
}


function formatGradebookScore(score: number | null, maxScore: number) {
  if (score === null) {
    return "-";
  }
  return `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function sortAttemptsByDisplayedTimestamp(attempts: GradebookReviewAttempt[]) {
  return [...attempts].sort((left, right) => attemptDisplayTime(right) - attemptDisplayTime(left));
}

function attemptDisplayTime(attempt: GradebookReviewAttempt) {
  const value =
    "completedAt" in attempt
      ? attempt.completedAt ?? attempt.lastInteractionAt
      : attempt.submittedAt ?? attempt.gradedAt;
  return value ? new Date(value).getTime() : 0;
}
