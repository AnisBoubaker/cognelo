"use client";

import { formatHomeworkLateness, readHomeworkSubmissionTiming } from "../submission-policy";
import { submissionDeadlineCopy } from "./submission-deadline-copy";
import { ActionIcon, DialogHeader, useApplicationTime, useDialogs, useNotifications } from "@cognelo/activity-ui";
import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { makeStudentQuestionContext, studentQuestionContext } from "../question-context";
import type { CodingHomeworkGradebookAttemptRecord } from "./client";
import type { CodingHomeworkLocale } from "./messages";
import { HomeworkChallengeQuestion } from "./homework-challenge-question";
import { HomeworkFileViewer, type HomeworkFileReader } from "./homework-file-viewer";
import { homeworkWorkflowCopy } from "./workflow-copy";

type CodingHomeworkManualGradingRow = {
  participantName: string; participantEmail: string; score: number | null; maxScore: number;
  feedback?: { feedbackText?: string | null } | null;
};

export type CodingHomeworkManualGradingPanelProps = {
  embedded?: boolean; locale: CodingHomeworkLocale; readFile: HomeworkFileReader;
  row: CodingHomeworkManualGradingRow;
  attempts: CodingHomeworkGradebookAttemptRecord[];
  attemptCount: number; selectedAttempt: CodingHomeworkGradebookAttemptRecord | null; selectedIndex: number;
  includeAttempts: boolean; loading: boolean; error: string; readOnly?: boolean;
  isSavingOverride: boolean; isSavingRegrade: boolean; isSavingDelete: boolean;
  onClose: () => void;
  onIncludeAttemptsChange: (includeAttempts: boolean) => void;
  onSelectAttemptIndex: (index: number) => void;
  onOverrideGrade: (input: { score: number; maxScore: number; reason: string | null; feedbackText?: string | null }) => Promise<void>;
  onRegradeAttempt: () => Promise<void>;
  onDeleteSubmission: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CodingHomeworkManualGradingPanel({ embedded = false, locale, readFile, row, attemptCount, selectedAttempt, selectedIndex,
  includeAttempts, loading, error, readOnly = false, isSavingOverride, isSavingRegrade, isSavingDelete, onClose,
  onIncludeAttemptsChange, onSelectAttemptIndex, onOverrideGrade, onDeleteSubmission, onDirtyChange, t
}: CodingHomeworkManualGradingPanelProps) {
  const { timeZone } = useApplicationTime();
  const notifications = useNotifications();
  const dialogs = useDialogs();
  const copy = homeworkWorkflowCopy(locale), id = useId();
  const [tab, setTab] = useState<"questions" | "files">("questions");
  const [score, setScore] = useState(row.score === null ? "" : formatGradeNumber(row.score));
  const [feedback, setFeedback] = useState("");
  const busy = isSavingOverride || isSavingRegrade || isSavingDelete;
  const submissionTiming = readHomeworkSubmissionTiming(selectedAttempt?.metadata);
  const functionsById = useMemo(() => new Map((selectedAttempt?.functions ?? []).map(fn => [fn.id, fn])), [selectedAttempt]);
  const savedFeedback = row.feedback?.feedbackText ?? selectedAttempt?.reviews[0]?.feedback ?? "";
  const scoreChanged = score.trim() ? Number(score) !== row.score : row.score !== null;
  const dirty = !readOnly && Boolean(selectedAttempt) && (scoreChanged || feedback !== savedFeedback);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);

  useEffect(() => {
    setScore(row.score === null ? "" : formatGradeNumber(row.score)); setFeedback(savedFeedback);
  }, [savedFeedback, row.participantEmail, row.score, selectedAttempt?.id]);

  async function submitOverride(event: FormEvent) {
    event.preventDefault();
    const parsedScore = Number(score);
    if (!score.trim() || !Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > row.maxScore) {
      notifications.error(t("courseDetail.overrideGradeRangeError", { max: formatGradeNumber(row.maxScore) })); return;
    }
    await onOverrideGrade({ score: parsedScore, maxScore: row.maxScore, reason: feedback.trim() || null, feedbackText: feedback.trim() || null });
  }

  const tabs = [{ key: "questions" as const, label: copy.questionsAndAnswers }, { key: "files" as const, label: copy.submittedFiles }];
  return <section className="dialog-panel answer-overlay test-review-overlay homework-review-panel" role={embedded ? undefined : "dialog"}
    aria-modal={embedded ? undefined : true} aria-label={embedded ? undefined : t("courseDetail.reviewAndGrade")} onMouseDown={event => event.stopPropagation()}>
    <DialogHeader className="section-heading" closeLabel={t("common.close")} onClose={embedded ? undefined : onClose} closeDisabled={busy}>
      <div><p className="eyebrow">{t("courseDetail.reviewAndGrade")}</p><h2>{row.participantName}</h2><p className="muted">{row.participantEmail}</p></div>
    </DialogHeader>
    <div className="homework-review-history">
      <div className="answer-meta">
        {selectedAttempt && <><strong>{t("courseDetail.submissionAnswerLabel", { id: String(selectedAttempt.attemptNumber ?? selectedAttempt.id.slice(-6)) })}</strong>
          <span className="muted">{selectedAttempt.submittedAt ? new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedAttempt.submittedAt)) : ""}</span></>}
        {submissionTiming?.isLate && <strong>{submissionDeadlineCopy(locale).lateBy.replace("{duration}", formatHomeworkLateness(submissionTiming.lateByMs, locale))}</strong>}
      </div>
      <div className="row">
        <label className="homework-choice"><input checked={includeAttempts} type="checkbox" disabled={busy || loading} onChange={async event => {
          const checked = event.target.checked;
          if (dirty && !await dialogs.confirm({ message: t("courseDetail.feedbackReviewDiscardConfirm"), confirmVariant: "danger" })) return;
          onIncludeAttemptsChange(checked);
        }} />{t("courseDetail.includeAttempts")}</label>
        {attemptCount > 1 && <nav className="row" aria-label={t("courseDetail.includeAttempts")}>
          <button className="secondary" disabled={busy || loading || selectedIndex === 0} type="button" onClick={() => onSelectAttemptIndex(selectedIndex - 1)}><ActionIcon name="back" />{t("courseDetail.previousSubmission")}</button>
          <span className="muted">{t("courseDetail.submissionPosition", { current: selectedIndex + 1, total: attemptCount })}</span>
          <button className="secondary" disabled={busy || loading || selectedIndex >= attemptCount - 1} type="button" onClick={() => onSelectAttemptIndex(selectedIndex + 1)}><ActionIcon name="next" />{t("courseDetail.nextSubmission")}</button>
        </nav>}
      </div>
    </div>
    {loading && <p className="muted" role="status">{t("common.loading")}</p>}
    {error && <div className="row" role="status"><span>{copy.reviewUnavailable}</span><button className="secondary" type="button" onClick={() => onIncludeAttemptsChange(includeAttempts)}><ActionIcon name="refresh" />{copy.retry}</button></div>}
    {!loading && !error && selectedAttempt && <div className="homework-review-layout">
      <div className="homework-review-content">
        <div className="tab-strip" role="tablist" aria-label={copy.reviewTabs} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); const next = event.key === "Home" ? "questions" : event.key === "End" ? "files" : tab === "questions" ? "files" : "questions";
          setTab(next); event.currentTarget.querySelector<HTMLButtonElement>(`#${CSS.escape(`${id}-${next}-tab`)}`)?.focus();
        }}>
          {tabs.map(item => <button key={item.key} type="button" role="tab" id={`${id}-${item.key}-tab`} aria-controls={`${id}-${item.key}-panel`}
            aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1} onClick={() => setTab(item.key)}>{item.label}</button>)}
        </div>
        <div id={`${id}-questions-panel`} role="tabpanel" aria-labelledby={`${id}-questions-tab`} hidden={tab !== "questions"}>
          <div className="homework-challenge-list">{selectedAttempt.questions.map((question, index) => {
            const fn = question.submissionFunctionId ? functionsById.get(question.submissionFunctionId) : undefined;
            const file = fn ? selectedAttempt.files.find(file => file.id === fn.fileId) : undefined;
            const context = fn && file ? makeStudentQuestionContext({ code: fn.functionCode, functionName: fn.functionName, filePath: file.path, languageKey: file.languageKey })
              : studentQuestionContext({ submissionId: selectedAttempt.id, metadata: question.metadata });
            return <HomeworkChallengeQuestion key={question.id} review disabled locale={locale} question={{ ...question, submissionId: selectedAttempt.id, context: context ?? undefined }}
              number={index + 1} total={selectedAttempt.questions.length} value={question.studentAnswer ?? ""} />;
          })}</div>
          {!selectedAttempt.questions.length && <p className="muted">{t("courseDetail.noAnswers")}</p>}
        </div>
        <div id={`${id}-files-panel`} role="tabpanel" aria-labelledby={`${id}-files-tab`} hidden={tab !== "files"}>
          {tab === "files" && <HomeworkFileViewer key={selectedAttempt.id} files={selectedAttempt.files} readFile={readFile} locale={locale} submitted />}
        </div>
      </div>
      {readOnly ? <aside className="inline-panel muted">{t("courseDetail.attemptReviewReadOnly")}</aside> : <form className="inline-panel stack homework-review-grading" onSubmit={submitOverride}>
        <h3>{copy.grading}</h3>
        <div className="field"><label htmlFor={`${id}-score`}>{t("courseDetail.overrideGradePrompt", { max: formatGradeNumber(row.maxScore) })}</label>
          <input id={`${id}-score`} required inputMode="decimal" min={0} max={row.maxScore} step="any" type="number" disabled={busy} value={score} onChange={event => setScore(event.target.value)} /></div>
        <div className="field"><label htmlFor={`${id}-feedback`}>{copy.reviewFeedback}</label>
          <textarea id={`${id}-feedback`} rows={6} disabled={busy} value={feedback} onChange={event => setFeedback(event.target.value)} /></div>
        <div className="row"><button className="secondary" disabled={busy} type="button" onClick={onClose}><ActionIcon name="close" />{t("common.cancel")}</button>
          <button disabled={busy} type="submit"><ActionIcon name="save" />{isSavingOverride ? t("common.saving") : t("common.save")}</button></div>
        <button className="secondary" disabled={busy} type="button" onClick={() => void onDeleteSubmission()}><ActionIcon name="remove" />{isSavingDelete ? t("common.saving") : t("courseDetail.deleteSubmission")}</button>
      </form>}
    </div>}
    {!loading && !error && !selectedAttempt && <p className="muted">{t("courseDetail.noAnswers")}</p>}
  </section>;
}

function formatGradeNumber(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(2); }
