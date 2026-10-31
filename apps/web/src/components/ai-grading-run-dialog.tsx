"use client";
import { useEffect, useRef } from "react";
import { ActionIcon, DialogHeader, ProgressDialog, useBodyScrollLock } from "@cognelo/activity-ui";
import { useI18n } from "../lib/i18n";
import type { useAiGradingRun } from "../lib/use-ai-grading-run";

export function AiGradingRunDialog({ grading }: { grading: ReturnType<typeof useAiGradingRun> }) {
  const { run, busy, finalizing, error, act } = grading;
  const { t } = useI18n();
  const dialog = useRef<HTMLElement>(null);
  const review = run?.status === "review";
  useBodyScrollLock(review);
  useEffect(() => {
    if (!review) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, [review]);
  if (!run) return error ? <p className="error" role="alert">{error}</p> : null;
  if (!review) return <ProgressDialog open title={t("courseDetail.aiAssessmentRunning")}
    eyebrow={t("courseDetail.gradebookEyebrow")} progressLabel={t("courseDetail.aiAssessmentRunning")}
    progress={run.total ? run.completed / run.total * 100 : 0}
    progressSummary={t("aiGrading.progress", { completed: run.completed, total: run.total })}
    message={error || t(finalizing ? "aiGrading.saving" : "aiGrading.stagingHelp")} cancelLabel={t(busy && !finalizing ? "aiGrading.cancelling" : "common.cancel")}
    cancelling={busy} onCancel={() => void act("cancel")} />;
  const completed = run.students.filter(student => student.status === "completed");
  const pending = run.students.filter(student => student.status !== "completed");
  return <div className="dialog-backdrop" role="presentation">
    <section className="dialog-panel stack" role="dialog" aria-modal="true" aria-labelledby="ai-grading-recovery-title"
      tabIndex={-1} ref={dialog} onKeyDown={event => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        if (!buttons.length) { event.preventDefault(); dialog.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === dialog.current)) { event.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
      }}>
      <DialogHeader closeLabel={t("common.close")}><h2 id="ai-grading-recovery-title">{t("aiGrading.stoppedTitle")}</h2></DialogHeader>
      <p>{t("aiGrading.decisionHelp")}</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="ai-grading-recovery-lists">
        <section><h3>{t("aiGrading.completed", { count: completed.length })}</h3>
          {completed.length ? <ul>{completed.map(student => <li key={student.attemptId}>{student.name}</li>)}</ul> : <p>{t("aiGrading.none")}</p>}
        </section>
        <section><h3>{t("aiGrading.notGraded", { count: pending.length })}</h3>
          {pending.length ? <ul>{pending.map(student => <li key={student.attemptId}>{student.name}
            {student.error ? <p className="error">{student.error}</p> : null}</li>)}</ul> : <p>{t("aiGrading.none")}</p>}
        </section>
      </div>
      <div className="row wrap">
        <button type="button" disabled={busy || !completed.length} onClick={() => void act("keep")}><ActionIcon name="save" />{t(busy ? "common.saving" : "aiGrading.keep")}</button>
        <button className="danger" type="button" disabled={busy} onClick={() => void act("discard")}><ActionIcon name="remove" />{t("aiGrading.discard")}</button>
      </div>
    </section>
  </div>;
}
