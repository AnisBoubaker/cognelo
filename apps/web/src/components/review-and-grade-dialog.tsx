"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDialogs, useNotifications } from "@cognelo/activity-ui";
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

type ReviewAttemptReference = {
  coreAttemptId: string;
  pluginAttemptRef: string | null;
};

type ManualReviewState = {
  activityConfig?: Record<string, unknown>;
  includeAttempts: boolean;
  attempts: ReviewAttempt[];
  attemptReferences: ReviewAttemptReference[];
  attemptCount: number;
  selectedIndex: number;
  loading: boolean;
  error: string;
};

type FeedbackReviewState = {
  attemptReferences: ReviewAttemptReference[];
  selectedAttemptIndex: number;
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
  const dialogs = useDialogs();
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
  const loadedReviewIdentityRef = useRef<string | null>(null);
  loadReviewRef.current = () => {
    if (feedbackRenderer) {
      void loadFeedbackReview();
    } else if (manualRenderer) {
      void loadManualReview(false);
    }
  };

  useEffect(() => {
    const identity = `${courseId}:${row.gradebookItemId}:${row.participantId}`;
    if (loadedReviewIdentityRef.current === identity) return;
    loadedReviewIdentityRef.current = identity;
    loadReviewRef.current();
  }, [courseId, row.gradebookItemId, row.participantId]);

  async function loadFeedbackReview() {
    return loadFeedbackReviewAttempt(0);
  }

  async function loadFeedbackReviewAttempt(selectedAttemptIndex: number) {
    const attemptReferences = reviewAttemptReferences(row);
    const attempt = attemptReferences[selectedAttemptIndex];
    const preserveTeacherGrade = row.gradeSource === "manual" || row.gradeSource === "override";
    const gradeFollowsCalculated = !preserveTeacherGrade && !row.latePenaltyApplied;
    if (!attempt) {
      notifications.error(t("courseDetail.feedbackReviewUnavailable"));
      return;
    }
    setFeedbackReview({
      attemptReferences,
      selectedAttemptIndex,
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
      const result = await api.activityAttemptAiFeedbackReview(courseId, attempt.coreAttemptId);
      const calculatedGrade = gradeFollowsCalculated
        ? calculatedNormalizedGrade(row, result.review.activityTypeKey, result.review.feedback)
        : null;
      setFeedbackReview({
        attemptReferences,
        selectedAttemptIndex,
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

  async function selectFeedbackAttemptIndex(selectedAttemptIndex: number) {
    if (!feedbackReview || selectedAttemptIndex < 0 || selectedAttemptIndex >= feedbackReview.attemptReferences.length) return;
    if (hasUnsavedFeedbackReview(feedbackReview) && !await dialogs.confirm({
      message: t("courseDetail.feedbackReviewDiscardConfirm"),
      confirmVariant: "danger"
    })) return;
    await loadFeedbackReviewAttempt(selectedAttemptIndex);
  }

  async function loadManualReview(includeAttempts: boolean) {
    setManualReview((current) => ({
      activityConfig: current?.activityConfig,
      includeAttempts,
      attempts: [],
      attemptReferences: reviewAttemptReferences(row),
      attemptCount: reviewAttemptReferences(row).length,
      selectedIndex: 0,
      loading: true,
      error: ""
    }));
    try {
      const attemptReferences = reviewAttemptReferences(row);
      const activityPromise = row.activityTypeKey === "test"
        ? Promise.resolve(undefined)
        : api.groupActivity(courseId, row.groupId, row.activityId);
      const attemptsPromise = includeAttempts && row.activityTypeKey !== "test"
        ? loadPluginReviewAttempts()
        : attemptReferences[0]
          ? loadReferencedReviewAttempt(attemptReferences[0])
          : Promise.resolve([] as ReviewAttempt[]);
      const [attempts, activityResult] = await Promise.all([attemptsPromise, activityPromise]);
      const sortedAttempts = sortAttemptsByDisplayedTimestamp(attempts);
      setManualReview({
        activityConfig: activityResult?.activity.config ?? {},
        includeAttempts,
        attempts: sortedAttempts,
        attemptReferences,
        attemptCount: includeAttempts ? sortedAttempts.length : attemptReferences.length,
        selectedIndex: 0,
        loading: false,
        error: ""
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("courseDetail.answerLoadError");
      setManualReview((current) => current ? { ...current, loading: false, error: message } : current);
      notifications.error(message);
    }
  }

  async function loadPluginReviewAttempts(attemptId?: string) {
    if (row.activityTypeKey === "mcq") {
      const result = await mcqClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
        participantId: row.participantId,
        attemptId
      });
      return result.attempts as ReviewAttempt[];
    }
    if (row.activityTypeKey === "coding-homework-grader") {
      const result = await codingHomeworkClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
        participantId: row.participantId,
        attemptId,
        includeAttempts: manualReview?.includeAttempts ?? false
      });
      return result.attempts as ReviewAttempt[];
    }
    const result = await parsonsClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
      participantId: row.participantId,
      attemptId,
      includeAttempts: manualReview?.includeAttempts ?? false
    });
    return result.attempts as ReviewAttempt[];
  }

  async function loadReferencedReviewAttempt(reference: ReviewAttemptReference) {
    if (row.activityTypeKey === "test") {
      return [(await api.testAttemptReview(courseId, reference.coreAttemptId)).review] as ReviewAttempt[];
    }
    return reference.pluginAttemptRef ? loadPluginReviewAttempts(reference.pluginAttemptRef) : [];
  }

  async function selectManualAttemptIndex(selectedIndex: number) {
    const current = manualReview;
    if (!current || selectedIndex < 0 || selectedIndex >= current.attemptCount) return;
    if (selectedIndex < current.attempts.length) {
      setManualReview({ ...current, selectedIndex });
      return;
    }
    const reference = current.attemptReferences[selectedIndex];
    if (!reference) return;
    setManualReview({ ...current, loading: true, error: "" });
    try {
      const attempts = await loadReferencedReviewAttempt(reference);
      const attempt = attempts[0];
      if (!attempt) throw new Error(t("courseDetail.answerLoadError"));
      setManualReview((latest) => latest ? {
        ...latest,
        attempts: [...latest.attempts, attempt],
        selectedIndex,
        loading: false,
        error: ""
      } : latest);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("courseDetail.answerLoadError");
      setManualReview((latest) => latest ? { ...latest, loading: false, error: message } : latest);
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
        ? await api.reviseActivityAttemptAiFeedback(
            courseId,
            feedbackReview.review.attemptId,
            feedbackReview.draft,
            typeof feedbackReview.review.feedback.feedbackHash === "string"
              ? feedbackReview.review.feedback.feedbackHash
              : null
          )
        : null;
      const shouldPreserveTeacherGrade = feedbackReview.preserveTeacherGrade && Boolean(feedbackResult?.grade);
      const overrideResult = (gradeChanged || shouldPreserveTeacherGrade) && parsedGrade !== null
        ? await api.overrideGradebookGrade(courseId, row.gradebookItemId, row.participantId, {
            score: parsedGrade,
            maxScore: row.maxScore,
            reason: t("courseDetail.reviewAndGradeReason"),
            expectedGradeUpdatedAt: feedbackResult?.grade?.updatedAt ?? feedbackResult?.gradeUpdatedAt ?? row.gradeUpdatedAt
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
        feedbackText: input.feedbackText ?? input.reason,
        expectedGradeUpdatedAt: row.gradeUpdatedAt
      });
      await onSaved?.();
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.overrideGradeError"));
    } finally {
      setSavingAction(null);
    }
  }

  async function regradeAttempt() {
    const reference = feedbackReview
      ? feedbackReview.attemptReferences[feedbackReview.selectedAttemptIndex]
      : manualReview?.attemptReferences[manualReview.selectedIndex];
    if (!reference) {
      notifications.error(t("courseDetail.regradeUnavailable"));
      return;
    }
    if (!await dialogs.confirm({ message: t("courseDetail.regradeConfirm", { name: row.participantName }) })) return;
    setSavingAction("regrade");
    try {
      const result = await api.regradeActivityAttempt(courseId, reference.coreAttemptId, { reason: t("courseDetail.regradeReason") });
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
    const reason = await dialogs.prompt({
      title: t("courseDetail.deleteSubmission"),
      inputLabel: t("courseDetail.deleteSubmissionPrompt"),
      maxLength: 1000
    });
    if (reason === null) return;
    const normalizedReason = reason.trim() || t("courseDetail.deleteSubmissionReasonFallback");
    if (!await dialogs.confirm({
      title: t("courseDetail.deleteSubmission"),
      message: t("courseDetail.deleteSubmissionConfirm", { name: row.participantName, number: coreAttempt.attemptNumber }),
      confirmLabel: t("courseDetail.deleteSubmission"),
      confirmVariant: "danger"
    })) return;
    setSavingAction("delete");
    try {
      await api.deleteActivitySubmission(courseId, coreAttempt.id, { reason: normalizedReason });
      setManualReview((current) => current ? {
        ...current,
        attempts: current.attempts.filter((attempt) => attempt.id !== selectedAttempt.id),
        attemptReferences: current.attemptReferences.filter((reference) => reference.coreAttemptId !== coreAttempt.id),
        attemptCount: Math.max(0, current.attemptCount - 1),
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
  const close = async () => {
    if (!feedbackReview || !hasUnsavedFeedbackReview(feedbackReview) || await dialogs.confirm({
      message: t("courseDetail.feedbackReviewDiscardConfirm"),
      confirmVariant: "danger"
    })) onClose();
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) void close();
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
          onSelectAttemptIndex={(selectedAttemptIndex) => void selectFeedbackAttemptIndex(selectedAttemptIndex)}
          onSave={saveFeedbackReview}
          t={t}
        />
        ) : <LoadingReviewDialog onClose={onClose} t={t} />
      : manualRenderer ? manualReview ? manualRenderer({
        row,
        activityConfig: manualReview.activityConfig,
        locale,
        attempts: manualReview.attempts,
        attemptCount: manualReview.attemptCount,
        selectedAttempt,
        selectedIndex: manualReview.selectedIndex,
        includeAttempts: manualReview.includeAttempts,
        loading: manualReview.loading,
        error: manualReview.error,
        readOnly: row.assessmentMode === "formative" || manualReview.selectedIndex > 0,
        isSavingOverride: savingAction === "override",
        isSavingRegrade: savingAction === "regrade",
        isSavingDelete: savingAction === "delete",
        onClose,
        onIncludeAttemptsChange: loadManualReview,
        onSelectAttemptIndex: (selectedIndex) => void selectManualAttemptIndex(selectedIndex),
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

function AiFeedbackReviewPanel({ row, state, onClose, onFeedbackChange, onGradeChange, onSelectAttemptIndex, onSave, t }: {
  row: CourseGradebookRow;
  state: FeedbackReviewState;
  onClose: () => void;
  onFeedbackChange: (feedback: Record<string, unknown>) => void;
  onGradeChange: (grade: string) => void;
  onSelectAttemptIndex: (index: number) => void;
  onSave: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const renderer = state.review ? getAiFeedbackReviewRenderer(state.review.activityTypeKey) : null;
  const teacherRevision = state.review && typeof state.review.feedback.teacherRevision === "number" ? state.review.feedback.teacherRevision : 0;
  const readOnly = row.assessmentMode === "formative" || state.selectedAttemptIndex > 0;
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
      {state.attemptReferences.length > 1 ? (
        <div className="row">
          <button
            className="button secondary"
            disabled={state.loading || state.selectedAttemptIndex === 0}
            type="button"
            onClick={() => onSelectAttemptIndex(state.selectedAttemptIndex - 1)}
          >
            {t("courseDetail.previousSubmission")}
          </button>
          <span className="muted">{t("courseDetail.submissionPosition", {
            current: state.selectedAttemptIndex + 1,
            total: state.attemptReferences.length
          })}</span>
          <button
            className="button secondary"
            disabled={state.loading || state.selectedAttemptIndex >= state.attemptReferences.length - 1}
            type="button"
            onClick={() => onSelectAttemptIndex(state.selectedAttemptIndex + 1)}
          >
            {t("courseDetail.nextSubmission")}
          </button>
        </div>
      ) : null}
      {state.loading ? <p className="muted">{t("courseDetail.loadingStudentAnswers")}</p> : null}
      {state.error ? <p className="error-text">{state.error}</p> : null}
      {state.review?.gradesReleased ? <p className="inline-panel muted">{t("courseDetail.feedbackReviewReleasedNote")}</p> : null}
      {teacherRevision > 0 ? <p className="muted">{t("courseDetail.feedbackReviewRevision", { number: teacherRevision })}</p> : null}
      {!state.loading && state.review && state.draft && renderer
        ? renderer({ feedback: state.draft, submission: state.review.submission, onFeedbackChange, readOnly, t })
        : null}
      {!state.loading && state.review && !renderer ? <p className="error-text">{t("courseDetail.feedbackReviewUnavailable")}</p> : null}
      {!state.loading && state.review && state.draft && renderer && !readOnly ? (
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
      {!state.loading && state.review && readOnly ? <p className="inline-panel muted">{t("courseDetail.attemptReviewReadOnly")}</p> : null}
    </section>
  );
}

function hasUnsavedFeedbackReview(state: FeedbackReviewState) {
  return Boolean(
    state.review &&
    state.draft &&
    (JSON.stringify(state.review.feedback) !== JSON.stringify(state.draft) || state.gradeTouched)
  );
}

function reviewAttemptReferences(row: CourseGradebookRow): ReviewAttemptReference[] {
  return row.attempts
    .filter((attempt) => (
      attempt.assessmentMode === row.assessmentMode
      && (attempt.lifecycle === "submitted" || attempt.lifecycle === "graded")
      && (row.activityTypeKey === "test" || Boolean(attempt.pluginAttemptRef))
    ))
    .sort((left, right) => right.attemptNumber - left.attemptNumber)
    .map((attempt) => ({ coreAttemptId: attempt.id, pluginAttemptRef: attempt.pluginAttemptRef }));
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
