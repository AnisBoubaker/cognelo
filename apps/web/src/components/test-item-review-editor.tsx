"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useDialogs, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { api, type CourseTestAttemptReview, type TestItemTeacherReview } from "@/lib/api";
import type { AiFeedbackReviewRendererContext } from "@/lib/activity-renderers";
import { AppIcon } from "./app-icon";
import { ReviewGradeField } from "./review-grade-field";

export function TestItemReviewEditor({ courseId, parentAttemptId, item, readOnly, renderAnswer, renderer,
  calculateGradePercent, onSaved, onDirtyChange, t }: {
  courseId: string; parentAttemptId: string; item: CourseTestAttemptReview["items"][number]; readOnly: boolean;
  renderAnswer: ReactNode; renderer: ((context: AiFeedbackReviewRendererContext) => ReactNode) | null;
  calculateGradePercent: (type: string, feedback: Record<string, unknown>) => number | null;
  onSaved: () => Promise<void>; onDirtyChange: (dirty: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const dialogs = useDialogs(), notifications = useNotifications();
  const [review, setReview] = useState<TestItemTeacherReview | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [score, setScore] = useState("");
  const [gradeTouched, setGradeTouched] = useState(false);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const inspectionOnly = readOnly || review?.readOnly === true;
  const feedbackChanged = Boolean(review && JSON.stringify(draft) !== JSON.stringify(review.feedback));
  const dirty = !inspectionOnly && Boolean(review && (feedbackChanged || feedbackText !== review.feedbackText || gradeTouched));
  const accept = useCallback((next: TestItemTeacherReview) => {
    setReview(next); setDraft(next.feedback); setFeedbackText(next.feedbackText);
    setScore(next.score === null ? "" : formatScore(next.score)); setGradeTouched(false);
  }, []);
  const loadSequence = useRef(0);
  const load = useCallback(async (active: () => boolean = () => true) => {
    const sequence = ++loadSequence.current;
    setLoading(true); setError("");
    try {
      const result = await api.testItemTeacherReview(courseId, parentAttemptId, item.testItemId);
      if (active() && sequence === loadSequence.current) accept(result.review);
    } catch (reason) {
      if (active() && sequence === loadSequence.current) setError(reason instanceof Error ? reason.message : t("courseDetail.feedbackReviewLoadError"));
    } finally { if (active() && sequence === loadSequence.current) setLoading(false); }
  }, [accept, courseId, parentAttemptId, item.testItemId, t]);
  useEffect(() => { let active = true; void load(() => active); return () => { active = false; }; }, [load]);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);

  async function save() {
    if (!review || inspectionOnly || saving) return;
    const grade = score.trim() ? Number(score) : null;
    if (gradeTouched && (grade === null || !Number.isFinite(grade) || grade < 0 || grade > review.maxScore)) {
      const message = t("courseDetail.overrideGradeInvalidRange", { max: review.maxScore });
      setError(message); throw new Error(message);
    }
    setSaving(true); setError("");
    try {
      const result = await api.saveTestItemTeacherReview(courseId, parentAttemptId, item.testItemId, {
        expectedUpdatedAt: review.updatedAt, expectedFeedbackHash: review.feedbackHash,
        ...(feedbackChanged ? { feedback: draft } : {}),
        ...(feedbackText !== review.feedbackText ? { feedbackText } : {}),
        ...(gradeTouched && grade !== null ? { score: grade } : {}), reason: t("courseDetail.reviewAndGradeReason")
      });
      accept(result.review);
      await onSaved();
      notifications.success(t("courseDetail.reviewAndGradeSaved"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("courseDetail.feedbackReviewSaveError"));
      throw reason;
    } finally { setSaving(false); }
  }
  useUnsavedChangesGuard({ isDirty: dirty, onSave: save, onDiscard: () => { if (review) accept(review); } });
  function updateFeedback(value: Record<string, unknown>) {
    setDraft(value);
    if (review && !review.manuallyGraded && !gradeTouched) {
      const percent = calculateGradePercent(item.activityTypeKey, value);
      if (percent !== null) setScore(formatScore(percent * review.maxScore / 100));
    }
  }
  return <section className="stack">
    {loading ? <p className="muted">{t("courseDetail.loadingStudentAnswers")}</p> : null}
    {error ? <div className="stack stack-tight">
      <p className="error-text" role="alert">{error}</p>
      <button className="button secondary" type="button" disabled={saving} onClick={async () => {
        if (!dirty || await dialogs.confirm({ message: t("courseDetail.feedbackReviewDiscardConfirm"), confirmVariant: "danger" })) await load();
      }}><AppIcon name="refresh" />{t("courseDetail.reloadReview")}</button>
    </div> : null}
    {!loading && review ? <>
      {review.gradesReleased ? <p className="inline-panel muted">{t("courseDetail.feedbackReviewReleasedNote")}</p> : null}
      {renderer && draft && review.submission
        ? renderer({ feedback: draft, submission: review.submission, onFeedbackChange: updateFeedback, readOnly: inspectionOnly || saving, t })
        : <>{renderAnswer}<label className="field"><span>{t("courseDetail.testReviewComments")}</span>
          <textarea rows={4} maxLength={10000} value={feedbackText} readOnly={inspectionOnly || saving} onChange={event => setFeedbackText(event.target.value)} />
        </label></>}
      {inspectionOnly ? <p className="muted">{t("courseDetail.testReviewReadOnly")}</p> : <>
        <ReviewGradeField id={`test-review-grade-${item.testItemId}`} maxScore={review.maxScore} value={score} disabled={saving}
          onChange={value => { setScore(value); setGradeTouched(true); }} t={t} />
        <div className="dialog-actions"><button className="button primary" type="button" disabled={saving || !dirty}
          onClick={() => { void save().catch(() => undefined); }}><AppIcon name="save" />{saving ? t("common.saving") : t("courseDetail.saveReview")}</button></div>
      </>}
    </> : null}
  </section>;
}

function formatScore(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(2); }
