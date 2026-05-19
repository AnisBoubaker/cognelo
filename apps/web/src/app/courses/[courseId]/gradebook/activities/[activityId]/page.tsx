"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  api,
  Course,
  CourseGradebook,
  CourseGradebookRow,
  GradebookMutationAttempt,
  GradebookMutationGrade,
  ParsonsGradebookAttempt
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function GradebookActivityResultsPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const searchParams = useSearchParams();
  const { courseId, activityId } = params;
  const groupId = searchParams.get("groupId") || undefined;
  const { t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [error, setError] = useState("");
  const [savingGradeKey, setSavingGradeKey] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<{
    row: CourseGradebookRow;
    includeAttempts: boolean;
    attempts: ParsonsGradebookAttempt[];
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
  const canShowAnswers = rows[0]?.activityTypeKey === "parsons-problem";
  const selectedAttempt = overlay?.attempts[overlay.selectedIndex] ?? null;

  async function openAnswer(row: CourseGradebookRow) {
    setOverlay({ row, includeAttempts: false, attempts: [], selectedIndex: 0, loading: true, error: "" });
    await loadAttempts(row, false);
  }

  async function loadAttempts(row: CourseGradebookRow, includeAttempts: boolean) {
    setOverlay((current) => (current ? { ...current, includeAttempts, loading: true, error: "" } : current));
    try {
      const result = await api.groupParsonsGradebookAttempts(courseId, row.groupId, row.activityId, {
        participantId: row.participantId,
        includeAttempts
      });
      const attempts = sortAttemptsByDisplayedTimestamp(result.attempts);
      setOverlay((current) =>
        current
          ? {
              ...current,
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

  async function overrideGrade(row: CourseGradebookRow) {
    const value = window.prompt(t("courseDetail.overrideGradePrompt", { max: formatGradeNumber(row.maxScore) }), row.score === null ? "" : String(row.score));
    if (value === null) {
      return;
    }
    const score = Number(value);
    if (!Number.isFinite(score)) {
      setError(t("courseDetail.overrideGradeInvalid"));
      return;
    }
    const reason = window.prompt(t("courseDetail.overrideReasonPrompt")) ?? "";
    setSavingGradeKey(`${row.gradebookItemId}:${row.participantId}:override`);
    setError("");
    try {
      const result = await api.overrideGradebookGrade(courseId, row.gradebookItemId, row.participantId, {
        score,
        maxScore: row.maxScore,
        reason: reason || null
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
      setError(t("courseDetail.regradeUnavailable"));
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
      setError(err instanceof Error ? err.message : t("courseDetail.regradeError"));
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
                <div className="table-row table-row-gradebook-detail" key={`${row.gradebookItemId}-${row.participantId}`}>
                  <div className="table-main table-main-stack">
                    <strong>{row.participantName}</strong>
                    <span className="table-meta-note muted">{row.participantEmail}</span>
                  </div>
                  <span className="table-meta muted">{row.groupTitle}</span>
                  <strong>{formatGradebookScore(row.score, row.maxScore)}</strong>
                  <span className="table-meta muted">{row.submittedAttemptCount}</span>
                  <div className="table-actions">
                    {canShowAnswers ? (
                      <button className="button secondary" type="button" onClick={() => openAnswer(row)}>
                        {t("courseDetail.seeAnswer")}
                      </button>
                    ) : (
                      <span className="muted">{t("courseDetail.answerUnavailable")}</span>
                    )}
                    <button
                      className="button secondary"
                      disabled={savingGradeKey === `${row.gradebookItemId}:${row.participantId}:regrade`}
                      type="button"
                      onClick={() => regradeRow(row)}
                    >
                      {t("courseDetail.regrade")}
                    </button>
                    <button
                      className="button secondary"
                      disabled={savingGradeKey === `${row.gradebookItemId}:${row.participantId}:override`}
                      type="button"
                      onClick={() => overrideGrade(row)}
                    >
                      {t("courseDetail.overrideGrade")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t("courseDetail.noGradebookRows")}</p>
          )}
        </section>

        {overlay ? (
          <div className="dialog-backdrop" role="presentation" onMouseDown={() => setOverlay(null)}>
            <section className="dialog-panel answer-overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{overlay.row.participantName}</p>
                  <h2>{t("courseDetail.studentAnswerTitle")}</h2>
                </div>
                <button className="button secondary" type="button" onClick={() => setOverlay(null)}>
                  {t("common.close")}
                </button>
              </div>

              <label className="checkbox-row">
                <input
                  checked={overlay.includeAttempts}
                  type="checkbox"
                  onChange={(event) => loadAttempts(overlay.row, event.target.checked)}
                />
                {t("courseDetail.includeAttempts")}
              </label>

              {overlay.error ? <p className="error">{overlay.error}</p> : null}
              {overlay.loading ? <p className="muted">{t("common.loading")}</p> : null}

              {!overlay.loading && selectedAttempt ? (
                <div className="stack">
                  <div className="row">
                    <button
                      className="button secondary"
                      disabled={overlay.selectedIndex === 0}
                      type="button"
                      onClick={() => setOverlay((current) => (current ? { ...current, selectedIndex: current.selectedIndex - 1 } : current))}
                    >
                      {t("courseDetail.previousSubmission")}
                    </button>
                    <span className="muted">
                      {t("courseDetail.submissionPosition", {
                        current: overlay.selectedIndex + 1,
                        total: overlay.attempts.length
                      })}
                    </span>
                    <button
                      className="button secondary"
                      disabled={overlay.selectedIndex >= overlay.attempts.length - 1}
                      type="button"
                      onClick={() => setOverlay((current) => (current ? { ...current, selectedIndex: current.selectedIndex + 1 } : current))}
                    >
                      {t("courseDetail.nextSubmission")}
                    </button>
                  </div>

                  <div className="answer-meta">
                    <strong>{attemptLabel(selectedAttempt, t)}</strong>
                    <span className="muted">{formatDateTime(selectedAttempt.completedAt ?? selectedAttempt.lastInteractionAt)}</span>
                  </div>

                  <div className="parsons-answer-lines">
                    {[...selectedAttempt.latestState.blocks]
                      .sort((left, right) => left.physicalLineIndex - right.physicalLineIndex)
                      .map((block) => (
                        <pre key={block.id} style={{ marginLeft: `${block.currentIndent * 18}px` }}>
                          {block.displayText}
                        </pre>
                      ))}
                  </div>

                  {overlay.includeAttempts && selectedAttempt.events.length ? (
                    <div className="stack">
                      <h3>{t("courseDetail.attemptEventsTitle")}</h3>
                      <div className="table-list">
                        {selectedAttempt.events.map((event) => (
                          <div className="table-row table-row-simple" key={event.id}>
                            <strong>{event.type}</strong>
                            <span className="table-meta muted">{formatDateTime(event.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!overlay.loading && !selectedAttempt ? <p className="muted">{t("courseDetail.noAnswers")}</p> : null}
            </section>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).format(new Date(value));
}

function attemptLabel(attempt: ParsonsGradebookAttempt, t: ReturnType<typeof useI18n>["t"]) {
  const key = attempt.status === "completed" ? "courseDetail.submissionAnswerLabel" : "courseDetail.attemptAnswerLabel";
  return t(key, { id: attempt.id.slice(-6) });
}

function sortAttemptsByDisplayedTimestamp(attempts: ParsonsGradebookAttempt[]) {
  return [...attempts].sort((left, right) => attemptDisplayTime(right) - attemptDisplayTime(left));
}

function attemptDisplayTime(attempt: ParsonsGradebookAttempt) {
  return new Date(attempt.completedAt ?? attempt.lastInteractionAt).getTime();
}
