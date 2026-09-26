"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { createCodingHomeworkGraderClient, type CodingHomeworkGradebookAttemptRecord } from "@cognelo/plugin-coding-homework-grader";
import { createMcqClient, type McqSubmission } from "@cognelo/plugin-mcq";
import { createParsonsClient, type ParsonsGradebookAttemptRecord } from "@cognelo/plugin-parsons";
import {
  api,
  apiRequest,
  type CourseGradebookRow,
  type CourseTestAttemptReview,
  type TeacherAiFeedbackReview
} from "@/lib/api";
import {
  getAiFeedbackReviewCalculatedGradePercent,
  getAiFeedbackReviewRenderer,
  getManualGradingRenderer
} from "@/lib/activity-renderers";
import { useI18n } from "@/lib/i18n";

type ReviewAttempt = ParsonsGradebookAttemptRecord | McqSubmission | CodingHomeworkGradebookAttemptRecord | CourseTestAttemptReview;

type ManualReviewState = {
  activityConfig?: Record<string, unknown>;
  includeAttempts: boolean;
  attempts: ReviewAttempt[];
  selectedIndex: number;
  loading: boolean;
  error: string;
};

type FeedbackReviewState = {
  review: TeacherAiFeedbackReview | null;
  draft: Record<string, unknown> | null;
  gradeDraft: string;
  gradeTouched: boolean;
  gradeFollowsCalculated: boolean;
  preserveTeacherGrade: boolean;
  initialGrade: number | null;
  loading: boolean;
  saving: boolean;
  error: string;
};

export function ReviewAndGradeDialog({ courseId, row, onClose, onSaved }: {
  courseId: string;
  row: CourseGradebookRow;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
}) {
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const codingHomeworkClient = useMemo(() => createCodingHomeworkGraderClient(apiRequest), []);
  const mcqClient = useMemo(() => createMcqClient(apiRequest), []);
  const parsonsClient = useMemo(() => createParsonsClient(apiRequest), []);
  const feedbackRenderer = getAiFeedbackReviewRenderer(row.activityTypeKey);
  const manualRenderer = getManualGradingRenderer(row.activityTypeKey);
  const [manualReview, setManualReview] = useState<ManualReviewState | null>(null);
  const [feedbackReview, setFeedbackReview] = useState<FeedbackReviewState | null>(null);
  const [savingAction, setSavingAction] = useState<"delete" | "override" | "regrade" | null>(null);
  const loadReviewRef = useRef<() => void>(() => undefined);
  loadReviewRef.current = () => {
    if (feedbackRenderer) {
      void loadFeedbackReview();
    } else if (manualRenderer) {
      void loadManualReview(false);
    }
  };

  useEffect(() => {
    loadReviewRef.current();
  }, [courseId, row.gradebookItemId, row.participantId]);

  async function loadFeedbackReview() {
    const attempt = selectedFeedbackAttempt(row);
    const preserveTeacherGrade = row.gradeSource === "manual" || row.gradeSource === "override";
    const gradeFollowsCalculated = !preserveTeacherGrade && !row.latePenaltyApplied;
    if (!attempt) {
      notifications.error(t("courseDetail.feedbackReviewUnavailable"));
      return;
    }
    setFeedbackReview({
      review: null,
      draft: null,
      gradeDraft: row.score === null ? "" : formatGradeNumber(row.score),
      gradeTouched: false,
      gradeFollowsCalculated,
      preserveTeacherGrade,
      initialGrade: row.score,
      loading: true,
      saving: false,
      error: ""
    });
    try {
      const result = await api.activityAttemptAiFeedbackReview(courseId, attempt.id);
      const calculatedGrade = gradeFollowsCalculated
        ? calculatedNormalizedGrade(row, result.review.activityTypeKey, result.review.feedback)
        : null;
      setFeedbackReview({
        review: result.review,
        draft: result.review.feedback,
        gradeDraft: row.score === null
          ? calculatedGrade === null ? "" : formatGradeNumber(calculatedGrade)
          : formatGradeNumber(row.score),
        gradeTouched: false,
        gradeFollowsCalculated,
        preserveTeacherGrade,
        initialGrade: row.score,
        loading: false,
        saving: false,
        error: ""
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("courseDetail.feedbackReviewLoadError");
      setFeedbackReview((current) => current ? { ...current, loading: false, error: message } : current);
      notifications.error(message);
    }
  }

  async function loadManualReview(includeAttempts: boolean) {
    setManualReview((current) => ({
      activityConfig: current?.activityConfig,
      includeAttempts,
      attempts: current?.attempts ?? [],
      selectedIndex: current?.selectedIndex ?? 0,
      loading: true,
      error: ""
    }));
    try {
      if (row.activityTypeKey === "test") {
        const parentAttempts = row.attempts.filter((attempt) => attempt.lifecycle === "submitted" || attempt.lifecycle === "graded");
        const reviews = await Promise.all(parentAttempts.map((attempt) => api.testAttemptReview(courseId, attempt.id)));
        setManualReview({
          includeAttempts,
          attempts: sortAttemptsByDisplayedTimestamp(reviews.map((result) => result.review)),
          selectedIndex: 0,
          loading: false,
          error: ""
        });
        return;
      }
      const [attemptsResult, activityResult] = await Promise.all([
        row.activityTypeKey === "mcq"
          ? mcqClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, { participantId: row.participantId })
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
      const attempts = sortAttemptsByDisplayedTimestamp(attemptsResult.attempts as ReviewAttempt[]);
      setManualReview((current) => ({
        activityConfig: activityResult.activity.config ?? {},
        includeAttempts,
        attempts,
        selectedIndex: Math.min(current?.selectedIndex ?? 0, Math.max(0, attempts.length - 1)),
        loading: false,
        error: ""
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("courseDetail.answerLoadError");
      setManualReview((current) => current ? { ...current, loading: false, error: message } : current);
      notifications.error(message);
    }
  }

  async function saveFeedbackReview() {
    if (!feedbackReview?.review || !feedbackReview.draft) return;
    const normalizedGradeDraft = feedbackReview.gradeDraft.trim();
    const parsedGrade = normalizedGradeDraft ? Number(normalizedGradeDraft) : null;
    if (
      feedbackReview.gradeTouched &&
      (parsedGrade === null || !Number.isFinite(parsedGrade) || parsedGrade < 0 || parsedGrade > row.maxScore)
    ) {
      notifications.error(t("courseDetail.overrideGradeInvalidRange", { max: formatGradeNumber(row.maxScore) }));
      return;
    }
    const feedbackChanged = JSON.stringify(feedbackReview.review.feedback) !== JSON.stringify(feedbackReview.draft);
    const gradeChanged = feedbackReview.gradeTouched && parsedGrade !== null;
    setFeedbackReview((current) => current ? { ...current, saving: true, error: "" } : current);
    try {
      const feedbackResult = feedbackChanged
        ? await api.reviseActivityAttemptAiFeedback(courseId, feedbackReview.review.attemptId, feedbackReview.draft)
        : null;
      const shouldPreserveTeacherGrade = feedbackReview.preserveTeacherGrade && Boolean(feedbackResult?.grade);
      const overrideResult = (gradeChanged || shouldPreserveTeacherGrade) && parsedGrade !== null
        ? await api.overrideGradebookGrade(courseId, row.gradebookItemId, row.participantId, {
            score: parsedGrade,
            maxScore: row.maxScore,
            reason: t("courseDetail.reviewAndGradeReason")
          })
        : null;
      const finalGrade = overrideResult?.grade.normalizedScore ?? feedbackResult?.grade?.normalizedScore ?? feedbackReview.initialGrade;
      const savedFeedback = feedbackResult?.feedback ?? feedbackReview.draft;
      setFeedbackReview((current) => current ? {
        ...current,
        saving: false,
        review: current.review ? { ...current.review, feedback: savedFeedback } : current.review,
        draft: savedFeedback,
        gradeDraft: finalGrade === null ? "" : formatGradeNumber(finalGrade),
        gradeTouched: false,
        gradeFollowsCalculated: overrideResult ? false : feedbackResult?.grade ? true : current.gradeFollowsCalculated,
        preserveTeacherGrade: overrideResult ? true : feedbackResult?.grade ? false : current.preserveTeacherGrade,
        initialGrade: finalGrade
      } : current);
      await onSaved?.();
      notifications.success(t("courseDetail.reviewAndGradeSaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("courseDetail.feedbackReviewSaveError");
      setFeedbackReview((current) => current ? { ...current, saving: false, error: message } : current);
      notifications.error(message);
    }
  }

  async function overrideGrade(input: { score: number; maxScore: number; reason: string | null; feedbackText?: string | null }) {
    setSavingAction("override");
    try {
      await api.overrideGradebookGrade(courseId, row.gradebookItemId, row.participantId, {
        score: input.score,
        maxScore: input.maxScore,
        reason: input.reason,
        feedbackText: input.feedbackText ?? input.reason
      });
      await onSaved?.();
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.overrideGradeError"));
    } finally {
      setSavingAction(null);
    }
  }

  async function regradeAttempt() {
    const attempt = selectedFeedbackAttempt(row);
    if (!attempt) {
      notifications.error(t("courseDetail.regradeUnavailable"));
      return;
    }
    if (!window.confirm(t("courseDetail.regradeConfirm", { name: row.participantName }))) return;
    setSavingAction("regrade");
    try {
      const result = await api.regradeActivityAttempt(courseId, attempt.id, { reason: t("courseDetail.regradeReason") });
      await onSaved?.();
      if (!result.result) notifications.success(t("courseDetail.regradeAwaitingRubric"));
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.regradeError"));
    } finally {
      setSavingAction(null);
    }
  }

  async function deleteSelectedSubmission(selectedAttempt: ReviewAttempt | null) {
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
    if (reason === null) return;
    const normalizedReason = reason.trim() || t("courseDetail.deleteSubmissionReasonFallback");
    if (!window.confirm(t("courseDetail.deleteSubmissionConfirm", { name: row.participantName, number: coreAttempt.attemptNumber }))) return;
    setSavingAction("delete");
    try {
      await api.deleteActivitySubmission(courseId, coreAttempt.id, { reason: normalizedReason });
      setManualReview((current) => current ? {
        ...current,
        attempts: current.attempts.filter((attempt) => attempt.id !== selectedAttempt.id),
        selectedIndex: Math.max(0, current.selectedIndex - 1)
      } : current);
      await onSaved?.();
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.deleteSubmissionError"));
    } finally {
      setSavingAction(null);
    }
  }

  async function gradeTestItem(parentAttemptId: string, testItemId: string, score: number, reason: string | null) {
    try {
      await api.gradeTestItem(courseId, parentAttemptId, testItemId, { score, reason });
      await onSaved?.();
      onClose();
      notifications.success("Test item grade saved.");
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.overrideGradeError"));
    }
  }

  const selectedAttempt = manualReview?.attempts[manualReview.selectedIndex] ?? null;
  const close = () => {
    if (!feedbackReview || canLeaveFeedbackReview(feedbackReview, t("courseDetail.feedbackReviewDiscardConfirm"))) onClose();
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      {feedbackRenderer ? feedbackReview ? (
          <AiFeedbackReviewPanel
          row={row}
          state={feedbackReview}
          onClose={close}
          onFeedbackChange={(draft) => setFeedbackReview((current) => {
            if (!current) return current;
            const calculatedGrade = current.review && current.gradeFollowsCalculated && !current.gradeTouched
              ? calculatedNormalizedGrade(row, current.review.activityTypeKey, draft)
              : null;
            return { ...current, draft, ...(calculatedGrade === null ? {} : { gradeDraft: formatGradeNumber(calculatedGrade) }) };
          })}
          onGradeChange={(gradeDraft) => setFeedbackReview((current) => current ? {
            ...current,
            gradeDraft,
            gradeTouched: true,
            gradeFollowsCalculated: false,
            preserveTeacherGrade: true
          } : current)}
          onSave={saveFeedbackReview}
          t={t}
        />
        ) : <LoadingReviewDialog onClose={onClose} t={t} />
      : manualRenderer ? manualReview ? manualRenderer({
        row,
        activityConfig: manualReview.activityConfig,
        locale,
        attempts: manualReview.attempts,
        selectedAttempt,
        selectedIndex: manualReview.selectedIndex,
        includeAttempts: manualReview.includeAttempts,
        loading: manualReview.loading,
        error: manualReview.error,
        readOnly: false,
        isSavingOverride: savingAction === "override",
        isSavingRegrade: savingAction === "regrade",
        isSavingDelete: savingAction === "delete",
        onClose,
        onIncludeAttemptsChange: loadManualReview,
        onSelectAttemptIndex: (selectedIndex) => setManualReview((current) => current ? { ...current, selectedIndex } : current),
        onOverrideGrade: overrideGrade,
        onRegradeAttempt: regradeAttempt,
        onDeleteSubmission: () => deleteSelectedSubmission(selectedAttempt),
        onGradeTestItem: gradeTestItem,
        t
      }) : <LoadingReviewDialog onClose={onClose} t={t} />
      : (
        <section className="dialog-panel answer-overlay stack" role="dialog" aria-modal="true">
          <div className="section-heading">
            <h2>{t("courseDetail.reviewAndGrade")}</h2>
            <button className="button secondary" type="button" onClick={onClose}>{t("common.close")}</button>
          </div>
          <p className="error-text">{t("courseDetail.feedbackReviewUnavailable")}</p>
        </section>
      )}
    </div>
  );
}

function LoadingReviewDialog({ onClose, t }: {
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <section className="dialog-panel answer-overlay stack" role="dialog" aria-modal="true">
      <div className="section-heading">
        <h2>{t("courseDetail.reviewAndGrade")}</h2>
        <button className="button secondary" type="button" onClick={onClose}>{t("common.close")}</button>
      </div>
      <p className="muted">{t("courseDetail.loadingStudentAnswers")}</p>
    </section>
  );
}

function AiFeedbackReviewPanel({ row, state, onClose, onFeedbackChange, onGradeChange, onSave, t }: {
  row: CourseGradebookRow;
  state: FeedbackReviewState;
  onClose: () => void;
  onFeedbackChange: (feedback: Record<string, unknown>) => void;
  onGradeChange: (grade: string) => void;
  onSave: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const renderer = state.review ? getAiFeedbackReviewRenderer(state.review.activityTypeKey) : null;
  const teacherRevision = state.review && typeof state.review.feedback.teacherRevision === "number" ? state.review.feedback.teacherRevision : 0;
  return (
    <section className="dialog-panel answer-overlay test-review-overlay stack" role="dialog" aria-modal="true">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{row.groupTitle}</p>
          <h2>{t("courseDetail.reviewAndGrade")}</h2>
          <p className="muted">{row.participantName}</p>
        </div>
        <button className="button secondary" type="button" onClick={onClose}>{t("common.close")}</button>
      </div>
      {state.loading ? <p className="muted">{t("courseDetail.loadingStudentAnswers")}</p> : null}
      {state.error ? <p className="error-text">{state.error}</p> : null}
      {state.review?.gradesReleased ? <p className="inline-panel muted">{t("courseDetail.feedbackReviewReleasedNote")}</p> : null}
      {teacherRevision > 0 ? <p className="muted">{t("courseDetail.feedbackReviewRevision", { number: teacherRevision })}</p> : null}
      {!state.loading && state.review && state.draft && renderer
        ? renderer({ feedback: state.draft, submission: state.review.submission, onFeedbackChange, t })
        : null}
      {!state.loading && state.review && !renderer ? <p className="error-text">{t("courseDetail.feedbackReviewUnavailable")}</p> : null}
      {!state.loading && state.review && state.draft && renderer ? (
        <div className="stack">
          <div className="inline-panel form">
            <div className="field" style={{ maxWidth: 260 }}>
              <label htmlFor={`review-grade-${row.gradebookItemId}-${row.participantId}`}>
                {t("courseDetail.finalGrade", { max: formatGradeNumber(row.maxScore) })}
              </label>
              <input
                id={`review-grade-${row.gradebookItemId}-${row.participantId}`}
                inputMode="decimal"
                max={row.maxScore}
                min={0}
                step="any"
                type="number"
                value={state.gradeDraft}
                onChange={(event) => onGradeChange(event.target.value)}
              />
              <span className="muted">{t("courseDetail.finalGradeHelp")}</span>
            </div>
          </div>
          <div className="row wrap dialog-actions">
            <button className="button primary" disabled={state.saving} type="button" onClick={() => void onSave()}>
              {state.saving ? t("common.saving") : t("courseDetail.saveReview")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function canLeaveFeedbackReview(state: FeedbackReviewState, confirmMessage: string) {
  if (!state.review || !state.draft || (JSON.stringify(state.review.feedback) === JSON.stringify(state.draft) && !state.gradeTouched)) {
    return true;
  }
  return window.confirm(confirmMessage);
}

function selectedFeedbackAttempt(row: CourseGradebookRow) {
  return row.attempts.find((candidate) => candidate.attemptNumber === row.selectedAttemptNumber)
    ?? [...row.attempts].reverse().find((candidate) => candidate.lifecycle === "graded" || candidate.lifecycle === "submitted")
    ?? null;
}

function calculatedNormalizedGrade(row: CourseGradebookRow, activityTypeKey: string, feedback: Record<string, unknown>) {
  const percent = getAiFeedbackReviewCalculatedGradePercent(activityTypeKey, feedback);
  return percent === null ? null : percent * row.maxScore / 100;
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function sortAttemptsByDisplayedTimestamp<T extends ReviewAttempt>(attempts: T[]) {
  return [...attempts].sort((left, right) => attemptDisplayTime(right) - attemptDisplayTime(left));
}

function attemptDisplayTime(attempt: ReviewAttempt) {
  const value = "completedAt" in attempt ? attempt.completedAt ?? attempt.lastInteractionAt : attempt.submittedAt ?? attempt.gradedAt;
  return value ? new Date(value).getTime() : 0;
}
