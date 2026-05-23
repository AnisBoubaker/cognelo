"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { createMcqClient, type McqSubmission } from "@cognelo/plugin-mcq";
import { createParsonsClient, type ParsonsGradebookAttemptRecord } from "@cognelo/plugin-parsons";
import { AppShell } from "@/components/app-shell";
import {
  api,
  apiRequest,
  Course,
  CourseGradebook,
  CourseGradebookRow,
  GradebookMutationAttempt,
  GradebookMutationGrade
} from "@/lib/api";
import { getManualGradingRenderer } from "@/lib/activity-renderers";
import { useI18n } from "@/lib/i18n";

type GradebookReviewAttempt = ParsonsGradebookAttemptRecord | McqSubmission;

export default function GradebookActivityResultsPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const searchParams = useSearchParams();
  const { courseId, activityId } = params;
  const groupId = searchParams.get("groupId") || undefined;
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const mcqClient = useMemo(() => createMcqClient(apiRequest), []);
  const parsonsClient = useMemo(() => createParsonsClient(apiRequest), []);
  const [course, setCourse] = useState<Course | null>(null);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [error, setError] = useState("");
  const [savingGradeKey, setSavingGradeKey] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<{
    row: CourseGradebookRow;
    activityConfig?: Record<string, unknown>;
    includeAttempts: boolean;
    attempts: GradebookReviewAttempt[];
    selectedIndex: number;
    loading: boolean;
    error: string;
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
    refresh().catch((err) => setError(err instanceof Error ? err.message : t("courseDetail.loadError")));
  }, [activityId, courseId, groupId, t]);

  const rows = gradebook?.rows ?? [];
  const activityTitle = rows[0]?.activityTitle ?? gradebook?.items[0]?.activityTitle ?? t("common.loading");
  const groupTitle = groupId ? gradebook?.items.find((item) => item.groupId === groupId)?.groupTitle : null;
  const backHref = groupId ? `/courses/${courseId}/groups/${groupId}?tab=gradebook` : `/courses/${courseId}?tab=gradebook`;
  const backLabel = groupId ? t("courseDetail.backToGroupGradebook") : t("courseDetail.backToCourseGradebook");
  const manualGradingRenderer = rows[0]?.activityTypeKey ? getManualGradingRenderer(rows[0].activityTypeKey) : null;
  const selectedAttempt = overlay?.attempts[overlay.selectedIndex] ?? null;
  const hasRowsWithSubmittedAttempts = rows.some((row) => hasSubmittedAttempt(row));

  async function openManualGrading(row: CourseGradebookRow) {
    setOverlay({ row, includeAttempts: false, attempts: [], selectedIndex: 0, loading: true, error: "" });
    await loadAttempts(row, false);
  }

  async function loadAttempts(row: CourseGradebookRow, includeAttempts: boolean) {
    setOverlay((current) => (current ? { ...current, includeAttempts, loading: true, error: "" } : current));
    try {
      const [attemptsResult, activityResult] = await Promise.all([
        row.activityTypeKey === "mcq"
          ? mcqClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
              participantId: row.participantId
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
      setOverlay((current) =>
        current
          ? {
              ...current,
              includeAttempts,
              loading: false,
              error: err instanceof Error ? err.message : t("courseDetail.answerLoadError")
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
    setError("");
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
      setError(err instanceof Error ? err.message : t("courseDetail.overrideGradeError"));
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
    setError("");
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
    setError("");
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
    const rowsWithAttempts = groupedRows.filter((row) =>
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
    setError("");
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

        {error ? <p className="error">{error}</p> : null}

        <section className="section stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("courseDetail.detailedResults")}</p>
              <h2>{t("courseDetail.studentResultsTitle")}</h2>
            </div>
            <div className="row wrap">
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
            <div className="table-list">
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
                  onOpenManualGrading={openManualGrading}
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
                  isSavingOverride: savingGradeKey === `${overlay.row.gradebookItemId}:${overlay.row.participantId}:override`,
                  isSavingRegrade: savingGradeKey === `${overlay.row.gradebookItemId}:${overlay.row.participantId}:regrade`,
                  isSavingDelete: savingGradeKey === `${overlay.row.gradebookItemId}:${overlay.row.participantId}:delete`,
                  onClose: () => setOverlay(null),
                  onIncludeAttemptsChange: (includeAttempts) => loadAttempts(overlay.row, includeAttempts),
                  onSelectAttemptIndex: (selectedIndex) => setOverlay((current) => (current ? { ...current, selectedIndex } : current)),
                  onOverrideGrade: (input) => overrideGrade(overlay.row, input),
                  onRegradeAttempt: () => regradeRow(overlay.row),
                  onDeleteSubmission: () => deleteSelectedSubmission(overlay.row, selectedAttempt),
                  t
                })
              : null}
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
  onRegrade,
  t
}: {
  manualGradingAvailable: boolean;
  row: CourseGradebookRow;
  savingGradeKey: string | null;
  onOpenManualGrading: (row: CourseGradebookRow) => Promise<void>;
  onRegrade: (row: CourseGradebookRow) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const rowHasSubmittedAttempt = hasSubmittedAttempt(row);

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
          <button className="button secondary" disabled={!rowHasSubmittedAttempt} type="button" onClick={() => onOpenManualGrading(row)}>
            {t("courseDetail.reviewGrade")}
          </button>
        ) : (
          <span className="muted">{t("courseDetail.answerUnavailable")}</span>
        )}
        <button
          className="button secondary"
          disabled={!rowHasSubmittedAttempt || savingGradeKey === `${row.gradebookItemId}:${row.participantId}:regrade`}
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
