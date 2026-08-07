"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import type { CourseGradebookRow, CourseTestAttemptReview } from "@/lib/api";

export function TestManualGradingPanel({
  row,
  attempts,
  selectedAttempt,
  selectedIndex,
  loading,
  readOnly,
  isSavingOverride,
  isSavingRegrade,
  onClose,
  onSelectAttemptIndex,
  onOverrideGrade,
  onRegradeAttempt,
  onGradeTestItem,
  renderItemReview,
  t
}: {
  row: CourseGradebookRow;
  attempts: CourseTestAttemptReview[];
  selectedAttempt: CourseTestAttemptReview | null;
  selectedIndex: number;
  loading: boolean;
  readOnly: boolean;
  isSavingOverride: boolean;
  isSavingRegrade: boolean;
  onClose: () => void;
  onSelectAttemptIndex: (index: number) => void;
  onOverrideGrade: (input: { score: number; maxScore: number; reason: string | null; feedbackText?: string | null }) => Promise<void>;
  onRegradeAttempt: () => Promise<void>;
  onGradeTestItem: (parentAttemptId: string, testItemId: string, score: number, reason: string | null) => Promise<void>;
  renderItemReview: (item: CourseTestAttemptReview["items"][number]) => ReactNode;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const notifications = useNotifications();
  const items = selectedAttempt?.items ?? [];
  const [scores, setScores] = useState<Record<string, string>>({});
  const [overrideScore, setOverrideScore] = useState("");
  const [reason, setReason] = useState("");
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  useEffect(() => {
    setScores(Object.fromEntries(items.map((item) => [item.testItemId, String(item.itemAttempt.normalizedScore ?? 0)])));
    setOverrideScore(row.score === null ? "" : String(row.score));
    setReason("");
  }, [row.participantId, row.score, selectedAttempt]);

  async function saveItem(testItemId: string, pointsPossible: number) {
    const score = Number(scores[testItemId]);
    if (!Number.isFinite(score) || score < 0 || score > pointsPossible) {
      notifications.error(t("courseDetail.overrideGradeRangeError", { max: pointsPossible }));
      return;
    }
    setSavingItemId(testItemId);
    try {
      if (selectedAttempt) await onGradeTestItem(selectedAttempt.id, testItemId, score, reason.trim() || null);
    } finally {
      setSavingItemId(null);
    }
  }

  async function submitParentOverride(event: FormEvent) {
    event.preventDefault();
    const score = Number(overrideScore);
    if (!Number.isFinite(score) || score < 0 || score > row.maxScore) {
      notifications.error(t("courseDetail.overrideGradeRangeError", { max: row.maxScore }));
      return;
    }
    await onOverrideGrade({ score, maxScore: row.maxScore, reason: reason.trim() || null, feedbackText: reason.trim() || null });
  }

  return (
    <section className="dialog-panel answer-overlay test-review-overlay" role="dialog" aria-modal="true">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{row.participantName}</p>
          <h2>{readOnly ? "Test results" : "Grade Test manually"}</h2>
          <p className="muted">{row.participantEmail}</p>
        </div>
        <button className="button secondary" type="button" onClick={onClose}>{t("common.close")}</button>
      </div>

      {loading ? <p className="muted">{t("common.loading")}</p> : null}
      {!loading && attempts.length > 1 ? (
        <div className="row">
          <button className="button secondary" disabled={selectedIndex === 0} type="button" onClick={() => onSelectAttemptIndex(selectedIndex - 1)}>
            {t("courseDetail.previousSubmission")}
          </button>
          <span className="muted">{t("courseDetail.submissionPosition", { current: selectedIndex + 1, total: attempts.length })}</span>
          <button className="button secondary" disabled={selectedIndex >= attempts.length - 1} type="button" onClick={() => onSelectAttemptIndex(selectedIndex + 1)}>
            {t("courseDetail.nextSubmission")}
          </button>
        </div>
      ) : null}
      {!loading && selectedAttempt ? (
        <div className="stack">
          {items.map((item, index) => (
            <article className="inline-panel stack" key={item.testItemId}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Activity {index + 1}</p>
                  <h3>{item.title}</h3>
                </div>
                <strong>{item.itemAttempt.normalizedScore ?? "-"} / {item.pointsPossible}</strong>
              </div>
              {renderItemReview(item) ?? <p className="muted">Answer review is not available for this activity type yet.</p>}
              {!readOnly ? (
                <div className="row">
                  <input
                    aria-label={`${item.title} score`}
                    min={0}
                    max={item.pointsPossible}
                    step="any"
                    style={{ maxWidth: 110 }}
                    type="number"
                    value={scores[item.testItemId] ?? ""}
                    onChange={(event) => setScores((current) => ({ ...current, [item.testItemId]: event.target.value }))}
                  />
                  <span>/ {item.pointsPossible}</span>
                  <button className="button secondary" disabled={savingItemId !== null} type="button" onClick={() => void saveItem(item.testItemId, item.pointsPossible)}>
                    {savingItemId === item.testItemId ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      {!loading && !selectedAttempt ? <p className="muted">{t("courseDetail.noAnswers")}</p> : null}

      {!readOnly ? <form className="form inline-panel" onSubmit={submitParentOverride}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("courseDetail.overrideGrade")}</p>
            <h3>{row.score === null ? "-" : `${row.score} / ${row.maxScore}`}</h3>
          </div>
          <button className="button secondary" disabled={isSavingRegrade} type="button" onClick={() => void onRegradeAttempt()}>
            {isSavingRegrade ? t("common.saving") : t("courseDetail.regrade")}
          </button>
        </div>
        <div className="field">
          <label htmlFor="test-parent-score">{t("courseDetail.overrideGrade")}</label>
          <input id="test-parent-score" min={0} max={row.maxScore} step="any" type="number" value={overrideScore} onChange={(event) => setOverrideScore(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="test-manual-reason">{t("courseDetail.overrideReasonPrompt")}</label>
          <textarea id="test-manual-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>{t("common.cancel")}</button>
          <button disabled={isSavingOverride} type="submit">{isSavingOverride ? t("common.saving") : t("common.save")}</button>
        </div>
      </form> : null}
    </section>
  );
}
