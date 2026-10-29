"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useDialogs } from "@cognelo/activity-ui";
import { api, type CourseTestAttemptReview } from "@/lib/api";
import type { AiFeedbackReviewRendererContext } from "@/lib/activity-renderers";
import { createTestItemReviewDraft, isTestItemReviewDirty, updateTestItemReviewFeedback, type TestItemReviewDraft } from "@/lib/test-review-draft";
import { AppIcon } from "./app-icon";
import { ReviewGradeField } from "./review-grade-field";

export function TestItemReviewEditor({ courseId, parentAttemptId, item, readOnly, saving, draft, onChange, renderAnswer, renderer,
  calculateGradePercent, t }: {
  courseId: string; parentAttemptId: string; item: CourseTestAttemptReview["items"][number]; readOnly: boolean; saving: boolean;
  draft?: TestItemReviewDraft; onChange: (id: string, draft: TestItemReviewDraft) => void;
  renderAnswer: ReactNode; renderer: ((context: AiFeedbackReviewRendererContext) => ReactNode) | null;
  calculateGradePercent: (type: string, feedback: Record<string, unknown>) => number | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const dialogs = useDialogs();
  const [loading, setLoading] = useState(!draft), [error, setError] = useState("");
  const sequence = useRef(0);
  const load = useCallback(async (active: () => boolean = () => true) => {
    const current = ++sequence.current;
    setLoading(true); setError("");
    try {
      const result = await api.testItemTeacherReview(courseId, parentAttemptId, item.testItemId);
      if (active() && current === sequence.current) onChange(item.testItemId, createTestItemReviewDraft(result.review));
    } catch (reason) {
      if (active() && current === sequence.current) setError(reason instanceof Error ? reason.message : t("courseDetail.feedbackReviewLoadError"));
    } finally { if (active() && current === sequence.current) setLoading(false); }
  }, [courseId, parentAttemptId, item.testItemId, onChange, t]);
  const hasDraft = Boolean(draft);
  useEffect(() => {
    if (hasDraft) { setLoading(false); return; }
    let active = true; void load(() => active); return () => { active = false; };
  }, [hasDraft, load]);

  const review = draft?.review;
  const inspectionOnly = readOnly || review?.readOnly === true;
  return <section className="stack">
    {loading ? <p className="muted">{t("courseDetail.loadingStudentAnswers")}</p> : null}
    {error ? <div className="stack stack-tight">
      <p className="error-text" role="alert">{error}</p>
      <button className="button secondary" type="button" disabled={saving} onClick={async () => {
        if (!draft || !isTestItemReviewDirty(draft) || await dialogs.confirm({ message: t("courseDetail.feedbackReviewDiscardConfirm"), confirmVariant: "danger" })) await load();
      }}><AppIcon name="refresh" />{t("courseDetail.reloadReview")}</button>
    </div> : null}
    {!loading && review && draft ? <>
      {review.gradesReleased ? <p className="inline-panel muted">{t("courseDetail.feedbackReviewReleasedNote")}</p> : null}
      {renderer && draft.feedback && review.submission
        ? renderer({ feedback: draft.feedback, submission: review.submission,
          onFeedbackChange: feedback => onChange(item.testItemId, updateTestItemReviewFeedback(draft, feedback, calculateGradePercent)),
          readOnly: inspectionOnly || saving, t })
        : <>{renderAnswer}<label className="field"><span>{t("courseDetail.testReviewComments")}</span>
          <textarea rows={4} maxLength={10000} value={draft.feedbackText} readOnly={inspectionOnly || saving}
            onChange={event => onChange(item.testItemId, { ...draft, feedbackText: event.target.value })} />
        </label></>}
      {inspectionOnly ? <p className="muted">{t("courseDetail.testReviewReadOnly")}</p> :
        <ReviewGradeField id={`test-review-grade-${item.testItemId}`} maxScore={review.maxScore} value={draft.score} disabled={saving}
          onChange={score => onChange(item.testItemId, { ...draft, score, gradeTouched: true, useRubricScore: false })} t={t} />}
    </> : null}
  </section>;
}
