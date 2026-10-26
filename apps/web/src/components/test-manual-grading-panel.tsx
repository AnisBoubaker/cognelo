"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { MarkdownRenderer, useDialogs, useNotifications } from "@cognelo/activity-ui";
import type { CourseGradebookRow, CourseTestAttemptReview } from "@/lib/api";
import type { AiFeedbackReviewRendererContext } from "@/lib/activity-renderers";
import { AppIcon } from "./app-icon";
import { TestItemReviewEditor } from "./test-item-review-editor";

type Item = CourseTestAttemptReview["items"][number];
export function TestManualGradingPanel({ courseId, row, attemptCount, selectedAttempt, selectedIndex, loading, readOnly,
  isSavingOverride, isSavingRegrade, onClose, onSelectAttemptIndex, onOverrideGrade, onRegradeAttempt, onReviewed,
  onDirtyChange, renderItemReview, feedbackRendererFor, calculateGradePercent, t }: {
  courseId: string; row: CourseGradebookRow; attempts: CourseTestAttemptReview[]; attemptCount: number;
  selectedAttempt: CourseTestAttemptReview | null; selectedIndex: number; loading: boolean; readOnly: boolean;
  isSavingOverride: boolean; isSavingRegrade: boolean; onClose: () => void; onSelectAttemptIndex: (index: number) => void;
  onOverrideGrade: (input: { score: number; maxScore: number; reason: string | null; feedbackText?: string | null }) => Promise<void>;
  onRegradeAttempt: () => Promise<void>; onReviewed: () => Promise<void>; onDirtyChange?: (dirty: boolean) => void;
  renderItemReview: (item: Item) => ReactNode;
  feedbackRendererFor: (type: string) => ((context: AiFeedbackReviewRendererContext) => ReactNode) | null;
  calculateGradePercent: (type: string, feedback: Record<string, unknown>) => number | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const notifications = useNotifications(), dialogs = useDialogs();
  const items = selectedAttempt?.items ?? [];
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [childDirty, setChildDirty] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [overrideScore, setOverrideScore] = useState("");
  const [reason, setReason] = useState("");
  const itemIndex = Math.max(0, items.findIndex(item => item.testItemId === selectedItemId));
  const item = items[itemIndex];
  useEffect(() => { setSelectedItemId(null); setChildDirty(false); }, [selectedAttempt?.id]);
  useEffect(() => { setOverrideScore(row.score === null ? "" : String(row.score)); setReason(""); }, [row.participantId, row.score]);
  const dirty = !readOnly && (childDirty || reason !== "" || overrideScore !== (row.score === null ? "" : String(row.score)));
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  async function selectItem(id: string) {
    if (id === item?.testItemId) return;
    if (childDirty && !await dialogs.confirm({ message: t("courseDetail.feedbackReviewDiscardConfirm"), confirmVariant: "danger" })) return;
    setChildDirty(false); setSelectedItemId(id);
  }
  async function regrade() {
    if (dirty && !await dialogs.confirm({ message: t("courseDetail.feedbackReviewDiscardConfirm"), confirmVariant: "danger" })) return;
    await onRegradeAttempt();
    setRefreshVersion(value => value + 1);
  }
  async function submitParentOverride(event: FormEvent) {
    event.preventDefault();
    const score = overrideScore.trim() ? Number(overrideScore) : NaN;
    if (!Number.isFinite(score) || score < 0 || score > row.maxScore) {
      notifications.error(t("courseDetail.overrideGradeRangeError", { max: row.maxScore })); return;
    }
    await onOverrideGrade({ score, maxScore: row.maxScore, reason: reason.trim() || null, feedbackText: reason.trim() || null });
  }
  return (
    <section className="dialog-panel answer-overlay test-review-overlay stack" role="dialog" aria-modal="true" aria-label={t("courseDetail.reviewAndGrade")}>
      <div className="section-heading">
        <div><p className="eyebrow">{row.participantName}</p><h2>{t("courseDetail.reviewAndGrade")}</h2><p className="muted">{row.activityTitle}</p></div>
        <button className="button secondary" type="button" onClick={onClose}><AppIcon name="close" />{t("common.close")}</button>
      </div>
      {loading ? <p className="muted">{t("common.loading")}</p> : null}
      {!loading && attemptCount > 1 ? <div className="row">
        <button className="button secondary" disabled={selectedIndex === 0} type="button" onClick={() => onSelectAttemptIndex(selectedIndex - 1)}><AppIcon name="back" />{t("courseDetail.previousSubmission")}</button>
        <span className="muted">{t("courseDetail.submissionPosition", { current: selectedIndex + 1, total: attemptCount })}</span>
        <button className="button secondary" disabled={selectedIndex >= attemptCount - 1} type="button" onClick={() => onSelectAttemptIndex(selectedIndex + 1)}><AppIcon name="next" />{t("courseDetail.nextSubmission")}</button>
      </div> : null}
      {!loading && selectedAttempt && item ? <>
        <nav className="section-actions" aria-label={t("courseDetail.testActivitiesLabel")}>
          {items.map((entry, index) => <button key={entry.testItemId} type="button" className="button test-activity-step"
            aria-current={itemIndex === index ? "step" : undefined} title={entry.title}
            aria-label={`${t("courseDetail.testActivityNumber", { number: index + 1 })}: ${entry.title}`}
            disabled={isSavingOverride || isSavingRegrade} onClick={() => { void selectItem(entry.testItemId); }}>{index + 1}</button>)}
        </nav>
        <article className="inline-panel stack">
          <div className="section-heading"><div>
            <p className="eyebrow">{t("courseDetail.testActivityPosition", { current: itemIndex + 1, total: items.length })}</p><h3>{item.title}</h3>
          </div><strong>{item.itemAttempt.normalizedScore ?? "—"} / {item.pointsPossible}</strong></div>
          <MarkdownRenderer markdown={item.activity.description ?? ""} />
          <TestItemReviewEditor key={`${selectedAttempt.id}:${item.testItemId}:${refreshVersion}`} courseId={courseId}
            parentAttemptId={selectedAttempt.id} item={item} readOnly={readOnly}
            renderAnswer={renderItemReview(item)} renderer={feedbackRendererFor(item.activityTypeKey)}
            calculateGradePercent={calculateGradePercent} onSaved={onReviewed} onDirtyChange={setChildDirty} t={t} />
        </article>
      </> : null}
      {!loading && !selectedAttempt ? <p className="muted">{t("courseDetail.noAnswers")}</p> : null}

      {!readOnly ? <form className="form inline-panel" onSubmit={submitParentOverride}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("courseDetail.testReviewTotal")}</p>
            <h3>{row.score === null ? "-" : `${row.score} / ${row.maxScore}`}</h3>
          </div>
          <button className="button secondary" disabled={isSavingRegrade} type="button" onClick={() => { void regrade(); }}>
            <AppIcon name="refresh" />
            {isSavingRegrade ? t("common.saving") : t("courseDetail.regrade")}
          </button>
        </div>
        <div className="field">
          <label htmlFor="test-parent-score">{t("courseDetail.testReviewTotal")}</label>
          <input id="test-parent-score" min={0} max={row.maxScore} step="any" type="number" value={overrideScore} onChange={(event) => setOverrideScore(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="test-manual-reason">{t("courseDetail.overrideReasonPrompt")}</label>
          <textarea id="test-manual-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}><AppIcon name="close" /> {t("common.cancel")}</button>
          <button disabled={isSavingOverride} type="submit"><AppIcon name="save" /> {isSavingOverride ? t("common.saving") : t("courseDetail.testReviewSaveTotal")}</button>
        </div>
      </form> : null}
    </section>
  );
}
