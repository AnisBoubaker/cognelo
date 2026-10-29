"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { DialogHeader, MarkdownRenderer, useDialogs, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { api, type CourseGradebookRow, type CourseTestAttemptReview } from "@/lib/api";
import type { AiFeedbackReviewRendererContext } from "@/lib/activity-renderers";
import { calculatedTestReviewTotal, createTestItemReviewDraft, formatTestReviewScore, isTestItemReviewDirty, parseTestReviewScore,
  testItemReviewPatch, testReviewItemScore, testReviewRubricScoresChanged, type TestItemReviewDraft } from "@/lib/test-review-draft";
import { AppIcon } from "./app-icon";
import { TestItemReviewEditor } from "./test-item-review-editor";

type Item = CourseTestAttemptReview["items"][number];
const emptyItems: Item[] = [];
function initialDraft(review: CourseTestAttemptReview | null) {
  return { items: {} as Record<string, TestItemReviewDraft>, overrideTotal: review?.grade?.source === "override",
    totalTouched: false, totalScore: review?.grade ? formatTestReviewScore(review.grade.score) : "", reason: review?.feedbackText ?? "" };
}

export function TestManualGradingPanel({ embedded = false, courseId, row, attemptCount, selectedAttempt, selectedIndex, loading, readOnly,
  isSavingRegrade, onClose, onSelectAttemptIndex, onRegradeAttempt, onReviewed, onDirtyChange, onSavingChange,
  renderItemReview, feedbackRendererFor, calculateGradePercent, t }: {
  embedded?: boolean; courseId: string; row: CourseGradebookRow; attempts: CourseTestAttemptReview[]; attemptCount: number;
  selectedAttempt: CourseTestAttemptReview | null; selectedIndex: number; loading: boolean; readOnly: boolean;
  isSavingRegrade: boolean; onClose: () => void; onSelectAttemptIndex: (index: number) => void;
  onRegradeAttempt: () => Promise<void>; onReviewed: () => Promise<void>; onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  renderItemReview: (item: Item) => ReactNode;
  feedbackRendererFor: (type: string) => ((context: AiFeedbackReviewRendererContext) => ReactNode) | null;
  calculateGradePercent: (type: string, feedback: Record<string, unknown>) => number | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const notifications = useNotifications(), dialogs = useDialogs();
  const [review, setReview] = useState(selectedAttempt);
  const [draft, setDraft] = useState(() => initialDraft(selectedAttempt));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const items = review?.items ?? emptyItems;
  const itemIndex = Math.max(0, items.findIndex(item => item.testItemId === selectedItemId));
  const item = items[itemIndex];
  const inspectionOnly = readOnly || review?.readOnly === true;
  const changedItems = Object.entries(draft.items).filter(([, itemDraft]) => isTestItemReviewDirty(itemDraft));
  const originalOverride = review?.grade?.source === "override";
  const totalChanged = draft.overrideTotal !== originalOverride
    || (draft.overrideTotal && draft.totalTouched && parseTestReviewScore(draft.totalScore, row.maxScore) !== review?.grade?.score);
  const commentChanged = draft.reason !== (review?.feedbackText ?? "");
  const dirty = !inspectionOnly && (changedItems.length > 0 || totalChanged || commentChanged);
  const calculatedTotal = calculatedTestReviewTotal(items, draft.items, row.maxScore);
  const displayedTotal = draft.overrideTotal ? parseTestReviewScore(draft.totalScore, row.maxScore) : calculatedTotal;
  const busy = saving || isSavingRegrade;
  const displayedItemScore = item ? testReviewItemScore(item, draft.items[item.testItemId]) : null;
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(saving); return () => onSavingChange?.(false); }, [saving, onSavingChange]);

  const changeItem = useCallback((id: string, next: TestItemReviewDraft) => {
    setDraft(previous => {
      const entry = items.find(candidate => candidate.testItemId === id);
      const old = previous.items[id];
      const gradeChanged = old && entry && (testReviewItemScore(entry, old) !== testReviewItemScore(entry, next)
        || testReviewRubricScoresChanged(old.feedback, next.feedback));
      return { ...previous, items: { ...previous.items, [id]: next },
        ...(!previous.totalTouched && gradeChanged ? { overrideTotal: false } : {}) };
    });
  }, [items]);

  async function saveAll() {
    if (!review || inspectionOnly || busy || !dirty) return;
    for (const [id, itemDraft] of changedItems) {
      if ((itemDraft.gradeTouched || itemDraft.useRubricScore) && parseTestReviewScore(itemDraft.score, itemDraft.review.maxScore) === null) {
        setSelectedItemId(id);
        const message = t("courseDetail.overrideGradeInvalidRange", { max: itemDraft.review.maxScore });
        setError(message); throw new Error(message);
      }
    }
    const total = parseTestReviewScore(draft.totalScore, row.maxScore);
    if (draft.overrideTotal && total === null) {
      const message = t("courseDetail.overrideGradeInvalidRange", { max: row.maxScore });
      setError(message); throw new Error(message);
    }
    const scoreChanges = changedItems.some(([, value]) => value.gradeTouched || value.useRubricScore
      || testReviewRubricScoresChanged(value.review.feedback, value.feedback));
    setSaving(true); setError("");
    try {
      const result = await api.saveTestAttemptReview(courseId, review.id, {
        expectedUpdatedAt: review.updatedAt, expectedGradeUpdatedAt: review.gradeUpdatedAt,
        items: changedItems.map(([testItemId, value]) => ({ testItemId, ...testItemReviewPatch(value) })),
        ...(totalChanged || scoreChanges ? {
          total: draft.overrideTotal && total !== null ? { mode: "override" as const, score: total } : { mode: "calculated" as const }
        } : {}),
        ...(commentChanged ? { feedbackText: draft.reason } : {}),
        reason: t("courseDetail.reviewAndGradeReason")
      });
      setReview(result.review);
      setDraft(previous => ({ ...initialDraft(result.review), items: { ...previous.items,
        ...Object.fromEntries(result.items.map(value => [value.testItemId, createTestItemReviewDraft(value)])) } }));
      await onReviewed();
      notifications.success(t("courseDetail.reviewAndGradeSaved"));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t("courseDetail.feedbackReviewSaveError");
      setError(message); throw reason;
    } finally { setSaving(false); }
  }
  useUnsavedChangesGuard({ isDirty: dirty, onSave: saveAll, onDiscard: () => setDraft(initialDraft(review)) });
  async function reload() {
    if (busy || !review || (dirty && !await dialogs.confirm({ message: t("courseDetail.feedbackReviewDiscardConfirm"), confirmVariant: "danger" }))) return;
    const result = await api.testAttemptReview(courseId, review.id);
    setReview(result.review); setDraft(initialDraft(result.review)); setError("");
    await onReviewed();
  }
  async function regrade() {
    if (busy || (dirty && !await dialogs.confirm({ message: t("courseDetail.feedbackReviewDiscardConfirm"), confirmVariant: "danger" }))) return;
    setDraft(initialDraft(review));
    await onRegradeAttempt();
    if (review) {
      const result = await api.testAttemptReview(courseId, review.id);
      setReview(result.review); setDraft(initialDraft(result.review));
    }
  }

  return (
    <section className="dialog-panel answer-overlay test-review-overlay stack" role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : true} aria-label={embedded ? undefined : t("courseDetail.reviewAndGrade")}>
      <DialogHeader className="section-heading" closeLabel={t("common.close")} onClose={embedded ? undefined : onClose} closeDisabled={busy}>
        <div><p className="eyebrow">{row.participantName}</p><h2>{t("courseDetail.reviewAndGrade")}</h2><p className="muted">{row.activityTitle}</p></div>
      </DialogHeader>
      {loading ? <p className="muted">{t("common.loading")}</p> : null}
      {!loading && attemptCount > 1 ? <div className="row">
        <button className="button secondary" disabled={busy || selectedIndex === 0} type="button" onClick={() => onSelectAttemptIndex(selectedIndex - 1)}><AppIcon name="back" />{t("courseDetail.previousSubmission")}</button>
        <span className="muted">{t("courseDetail.submissionPosition", { current: selectedIndex + 1, total: attemptCount })}</span>
        <button className="button secondary" disabled={busy || selectedIndex >= attemptCount - 1} type="button" onClick={() => onSelectAttemptIndex(selectedIndex + 1)}><AppIcon name="next" />{t("courseDetail.nextSubmission")}</button>
      </div> : null}
      {error ? <div className="stack stack-tight"><p className="error-text" role="alert">{error}</p>
        <button className="secondary" type="button" disabled={busy} onClick={() => { void reload().catch(reason => setError(String(reason))); }}><AppIcon name="refresh" />{t("courseDetail.reloadReview")}</button>
      </div> : null}
      {!loading && review && item ? <>
        <nav className="section-actions" aria-label={t("courseDetail.testActivitiesLabel")}>
          {items.map((entry, index) => <button key={entry.testItemId} type="button" className="button test-activity-step"
            aria-current={itemIndex === index ? "step" : undefined} title={entry.title}
            aria-label={`${t("courseDetail.testActivityNumber", { number: index + 1 })}: ${entry.title}`}
            disabled={busy} onClick={() => setSelectedItemId(entry.testItemId)}>{index + 1}{draft.items[entry.testItemId] && isTestItemReviewDirty(draft.items[entry.testItemId]) ? " *" : ""}</button>)}
        </nav>
        <article className="inline-panel stack">
          <div className="section-heading"><div>
            <p className="eyebrow">{t("courseDetail.testActivityPosition", { current: itemIndex + 1, total: items.length })}</p><h3>{item.title}</h3>
          </div><strong>{displayedItemScore === null ? "—" : formatTestReviewScore(displayedItemScore)} / {item.pointsPossible}</strong></div>
          <MarkdownRenderer markdown={item.activity.description ?? ""} />
          <TestItemReviewEditor key={`${review.id}:${item.testItemId}`} courseId={courseId} parentAttemptId={review.id} item={item}
            readOnly={inspectionOnly} saving={busy} draft={draft.items[item.testItemId]} onChange={changeItem}
            renderAnswer={renderItemReview(item)} renderer={feedbackRendererFor(item.activityTypeKey)} calculateGradePercent={calculateGradePercent} t={t} />
        </article>
      </> : null}
      {!loading && !review ? <p className="muted">{t("courseDetail.noAnswers")}</p> : null}
      {!loading && review && !inspectionOnly ? <section className="form inline-panel">
        <div className="section-heading"><div><p className="eyebrow">{t("courseDetail.testReviewTotal")}</p>
          <h3 aria-live="polite">{displayedTotal === null ? t("courseDetail.testReviewPendingTotal") : `${formatTestReviewScore(displayedTotal)} / ${row.maxScore}`}</h3>
        </div><button className="button secondary" disabled={busy} type="button" onClick={() => { void regrade(); }}><AppIcon name="refresh" />{t("courseDetail.regrade")}</button></div>
        <p className="muted">{t("courseDetail.testReviewTotalHelp")}</p>
        <label className="checkbox-row"><input type="checkbox" checked={draft.overrideTotal} disabled={busy}
          onChange={event => setDraft(current => ({ ...current, overrideTotal: event.target.checked, totalTouched: true,
            totalScore: !current.overrideTotal && calculatedTotal !== null ? formatTestReviewScore(calculatedTotal) : current.totalScore }))} />
          <span>{t("courseDetail.testReviewOverrideTotal")}</span></label>
        {draft.overrideTotal ? <div className="field"><label htmlFor="test-parent-score">{t("courseDetail.testReviewTotal")}</label>
          <input id="test-parent-score" min={0} max={row.maxScore} step="any" type="number" value={draft.totalScore} disabled={busy}
            onChange={event => setDraft(current => ({ ...current, totalTouched: true, totalScore: event.target.value }))} />
          <p className="muted">{t("courseDetail.testReviewOverrideHelp")}</p>
        </div> : null}
        <div className="field"><label htmlFor="test-manual-reason">{t("courseDetail.overrideReasonPrompt")}</label>
          <textarea id="test-manual-reason" maxLength={10000} value={draft.reason} disabled={busy} onChange={event => setDraft(current => ({ ...current, reason: event.target.value }))} /></div>
        <div className="dialog-actions"><button className="secondary" type="button" disabled={busy} onClick={onClose}><AppIcon name="close" />{t("common.cancel")}</button>
          <button type="button" disabled={busy || !dirty} onClick={() => { void saveAll().catch(() => undefined); }}><AppIcon name="save" />{saving ? t("common.saving") : t("courseDetail.testReviewSaveAll")}</button></div>
      </section> : null}
    </section>
  );
}
