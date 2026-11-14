"use client";
import { useId, type Ref } from "react";
import { ActionIcon, AppDateTime, SubmissionStageAccessGate, SubmissionStageWaiting } from "@cognelo/activity-ui";
import type { CodingHomeworkLocale } from "./messages";
import type { HomeworkWorkspace } from "./workflow-types";
import type { HomeworkSubmissionPolicy } from "../submission-policy";
import { formatHomeworkLateness } from "../submission-policy";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { submissionDeadlineCopy } from "./submission-deadline-copy";
import { homeworkGuideState } from "./homework-submission-guide-state";
import { submissionGuideCopy } from "./submission-guide-copy";

export function HomeworkSubmissionGuide({ workspace, policy, window, clock, locale, questionsLoaded, questionAccessRequired, disabled, answersId, nextStepRef, onStart, onAccess }: {
  workspace: HomeworkWorkspace; policy: HomeworkSubmissionPolicy; window: { closesAt: string | null; closed: boolean; isLate: boolean }; clock: number;
  locale: CodingHomeworkLocale; questionsLoaded: boolean; questionAccessRequired: boolean; disabled: boolean; answersId: string;
  nextStepRef?: Ref<HTMLElement>;
  onStart: () => void; onAccess?: () => void;
}) {
  const id = useId(), copy = submissionGuideCopy(locale), workflow = homeworkWorkflowCopy(locale), deadline = submissionDeadlineCopy(locale);
  const state = homeworkGuideState(workspace, window.closed, clock), active = workspace.submission;
  const due = active ? active.submissionTiming?.deadline : policy.deadline ?? window.closesAt;
  const closesBeforeDue = Boolean(due && window.closesAt && Date.parse(window.closesAt) < Date.parse(due));
  const answerDue = workspace.questionsClosesAt ?? workspace.questionsDeadline;
  const minutes = workspace.questionsTimeLimitMinutes;
  const duration = (value: number) => copy.upTo.replace("{duration}", formatHomeworkLateness(value * 60_000, locale));
  return <section className="homework-submission-guide stack" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{copy.title}</h3><p>{state.questionsRequired ? copy.twoStages : copy.filesOnly}</p>
    <ol className={`homework-stage-list${state.questionsRequired ? "" : " is-single"}`}>
      <li><section ref={state.questionsRequired ? undefined : nextStepRef} className={`homework-stage-card is-${state.files}`} aria-labelledby={`${id}-files`}>
        <div className="homework-stage-heading"><span className="homework-stage-number" aria-hidden="true">{active ? <ActionIcon name="check" /> : "1"}</span><h4 id={`${id}-files`}>{copy.files}</h4><span className="homework-stage-status">{copy[state.files]}</span></div>
        <p>{active ? workflow.frozen : copy.fileHelp}</p>
        <dl className="homework-stage-facts">
          {!active && Boolean(workspace.preparationTimeLimitMinutes) ? <><dt>{copy.timeAllowed}</dt><dd>{duration(workspace.preparationTimeLimitMinutes!)}</dd></> : null}
          {due ? <><dt>{deadline.deadline}</dt><dd><time dateTime={due}><AppDateTime value={due} locale={locale} options={{ dateStyle: "medium", timeStyle: "medium" }} /></time></dd></> : null}
          {!active && window.closesAt && closesBeforeDue ? <><dt>{copy.fileCloses}</dt><dd><time dateTime={window.closesAt}><AppDateTime value={window.closesAt} locale={locale} options={{ dateStyle: "medium", timeStyle: "medium" }} /></time></dd></> : null}
        </dl>
        {!active && Boolean(workspace.preparationTimeLimitMinutes) ? <p className="homework-stage-help">{workspace.preparationStartedAt ? copy.fileStarted : workspace.submissionsEnabled ? copy.fileStarts : copy.fileStartsOnActivation}</p> : null}
        {!active && due ? <p className="homework-stage-help">{policy.allowLate ? window.closesAt ? !closesBeforeDue && Date.parse(window.closesAt) > Date.parse(due) ? <>{deadline.closes}: <time dateTime={window.closesAt}><AppDateTime value={window.closesAt} locale={locale} options={{ dateStyle: "medium", timeStyle: "medium" }} /></time></> : null : deadline.unlimited : deadline.noLate}</p> : null}
        {!active && window.closesAt && workspace.submissionsEnabled && workspace.teamwork?.canSubmit !== false ? <p className="homework-stage-help">{deadline.autoNotice}</p> : null}
        {!active && window.closed ? <p className="homework-stage-emphasis">{deadline.closed}</p> : null}
        {!active && window.isLate && !window.closed ? <p className="homework-stage-emphasis">{deadline.lateNow}</p> : null}
        {state.files === "waiting" ? <SubmissionStageWaiting locale={locale} /> : null}
      </section></li>
      {state.questionsRequired ? <li><section ref={nextStepRef} className={`homework-stage-card is-${state.questions}`} aria-labelledby={`${id}-questions`}>
        <div className="homework-stage-heading"><span className="homework-stage-number" aria-hidden="true">{state.complete ? <ActionIcon name="check" /> : "2"}</span><h4 id={`${id}-questions`}>{copy.questions}</h4><span className="homework-stage-status">{copy[state.questions]}</span></div>
        <p>{state.complete ? copy.complete : copy.questionsHelp}</p>
        {!state.complete ? <>
          <dl className="homework-stage-facts">
            {minutes ? <><dt>{copy.timeAllowed}</dt><dd>{duration(minutes)}</dd></> : null}
            {answerDue ? <><dt>{copy.answersDue}</dt><dd><time dateTime={answerDue}><AppDateTime value={answerDue} locale={locale} options={{ dateStyle: "medium", timeStyle: "medium" }} /></time></dd></> : null}
          </dl>
          {minutes ? <p className="homework-stage-emphasis">{active?.started ? copy.timerRunning : copy.timerStarts}</p> : null}
          {workspace.questionsRequireSafeExamBrowser ? <p className="homework-stage-security"><ActionIcon name="alert" /><span>{copy.sebRequired}</span></p> : null}
          {state.questions === "waiting" ? <SubmissionStageWaiting locale={locale} /> : null}
          {active && (state.questions === "generating" || state.questions === "failed") ? <div role="status" aria-live="polite" className="homework-generation-status">
            {state.questions === "generating" ? <span className="homework-generation-spinner" aria-hidden="true" /> : null}
            <div><strong>{active.generationIssue === "no_eligible_code" ? workflow.noEligibleCode : state.questions === "failed" ? workflow.generationFailed : active.processingStatus === "queued" ? workflow.waitingGeneration : workflow.generating}</strong>
              {active.processingStatus === "queued" && active.queuePosition !== null ? <p>{workflow.queuePosition.replace("{position}", String(active.queuePosition))}</p> : null}</div>
          </div> : null}
          {questionsLoaded ? <a className="button secondary" href={`#${answersId}`}><ActionIcon name="open" />{copy.continue}</a>
            : <button type="button" disabled={disabled || !active || active.status !== "challenge_ready" || !["ready", "active"].includes(state.questions)} onClick={onStart}><ActionIcon name="open" />{workflow.answer}</button>}
          {questionAccessRequired && !questionsLoaded ? <SubmissionStageAccessGate locale={locale} onRequestAccess={onAccess} /> : null}
        </> : null}
      </section></li> : null}
    </ol>
  </section>;
}
