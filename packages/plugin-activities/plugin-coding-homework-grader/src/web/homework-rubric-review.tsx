"use client";
import { useState } from "react";
import { MarkdownRenderer } from "@cognelo/activity-ui";
import { calculateHomeworkFeedback, isHomeworkFeedback, objectRecord, type HomeworkRubricFeedback, type HomeworkRubricScore } from "../rubric";
import { HomeworkFileViewer, type HomeworkFileReader } from "./homework-file-viewer";
import { homeworkRubricCopy } from "./rubric-copy";
import { QuestionCodeContext } from "./question-code-context";
import type { StudentQuestionContext } from "../question-context";
import type { CodingHomeworkLocale } from "./messages";

export function HomeworkRubricReview({ feedback: value, submission, onFeedbackChange, readOnly = false, locale = "en", readFile }: {
  feedback: Record<string, unknown>; submission: Record<string, unknown>; onFeedbackChange: (feedback: Record<string, unknown>) => void;
  readOnly?: boolean; locale?: CodingHomeworkLocale; readFile?: HomeworkFileReader;
}) {
  const copy = homeworkRubricCopy(locale), [tab, setTab] = useState("code");
  if (!isHomeworkFeedback(value)) return null;
  const feedback = calculateHomeworkFeedback(value);
  const files = (Array.isArray(submission.files) ? submission.files : []) as Array<{ path: string; sizeBytes: number }>;
  const questions = (Array.isArray(submission.questions) ? submission.questions : []) as Array<{ id: string; questionText: string; studentAnswer: string; context: StudentQuestionContext | null }>;
  const change = (next: HomeworkRubricFeedback) => onFeedbackChange(calculateHomeworkFeedback(next));
  return <div className="stack">
    {submission.teamSubmission === true && <p className="inline-panel muted">{copy.team}</p>}
    <div className="tabs" role="tablist" aria-label={copy.grading}>
      <button role="tab" aria-selected={tab === "code"} type="button" onClick={() => setTab("code")}>{copy.files} / {copy.code}</button>
      <button role="tab" aria-selected={tab === "questions"} type="button" onClick={() => setTab("questions")}>{copy.questionTab}</button>
    </div>
    {tab === "code" ? <div className="homework-rubric-review-grid">
      <section className="stack" style={{ minWidth: 0 }}>{readFile ? <HomeworkFileViewer key={String(submission.submissionId)} files={files} readFile={readFile} submitted locale={locale} /> : null}</section>
      <HomeworkRubricFields rubric={feedback.code} title={copy.code} locale={locale} readOnly={readOnly} onChange={code => change({ ...feedback, code })} />
    </div> : <div className="stack">{questions.map((question, index) => {
      const rubric = feedback.questions.find(item => item.id === question.id);
      return <section className="inline-panel stack" key={question.id}>
        <h3>{copy.question} {index + 1}</h3>
        <MarkdownRenderer markdown={question.questionText} />
        <div className="homework-rubric-review-grid"><div className="stack" style={{ minWidth: 0 }}><QuestionCodeContext context={question.context ?? undefined} locale={locale} /><strong>{copy.answer}</strong><p style={{ whiteSpace: "pre-wrap" }}>{question.studentAnswer.trim() || copy.noAnswer}</p></div>
          {rubric && <HomeworkRubricFields rubric={rubric} title={copy.questions} locale={locale} readOnly={readOnly} onChange={next => change({ ...feedback, questions: feedback.questions.map(item => item.id === question.id ? { ...next, id: question.id } : item) })} />}
        </div>
      </section>;
    })}</div>}
    <HomeworkRubricBreakdown feedback={feedback} locale={locale} />
    <label className="field"><span>{copy.summary}</span><textarea rows={4} maxLength={3000} value={feedback.summary} readOnly={readOnly} onChange={event => change({ ...feedback, summary: event.target.value })} /></label>
    {(["strengths", "improvements"] as const).map(field => <label className="field" key={field}><span>{copy[field]}</span><textarea rows={4} maxLength={10000} value={feedback[field].join("\n\n")} readOnly={readOnly} onChange={event => change({ ...feedback, [field]: [event.target.value] })} /></label>)}
  </div>;
}

export function HomeworkRubricFields({ rubric, title, locale, readOnly, onChange }: { rubric: HomeworkRubricScore; title: string; locale: string; readOnly: boolean; onChange?: (rubric: HomeworkRubricScore) => void }) {
  const copy = homeworkRubricCopy(locale);
  return <section className="stack" style={{ minWidth: 0 }}>
    <h3>{title}</h3>
    {rubric.summary && readOnly ? <p style={{ whiteSpace: "pre-wrap" }}>{rubric.summary}</p> : !readOnly ? <label className="field"><span>{copy.summary}</span><textarea rows={3} maxLength={3000} value={rubric.summary} onChange={event => onChange?.({ ...rubric, summary: event.target.value })} /></label> : null}
    {rubric.criteria.map(criterion => <section key={criterion.id} className="inline-panel stack stack-tight">
      <strong>{criterion.title} · {criterion.weightPercent}%</strong>
      {criterion.description && <p className="muted">{criterion.description}</p>}
      {readOnly ? <><p>{copy.score}: {criterion.scorePercent ?? copy.pending}{criterion.scorePercent !== null ? "%" : ""}</p>{criterion.feedback && <p style={{ whiteSpace: "pre-wrap" }}>{criterion.feedback}</p>}</> : <>
        <label className="field"><span>{copy.score}</span><input type="number" min={0} max={100} step="0.01" value={criterion.scorePercent ?? ""} onChange={event => { const scorePercent = event.target.value === "" ? null : Number(event.target.value); onChange?.({ ...rubric, criteria: rubric.criteria.map(item => item.id === criterion.id ? { ...item, scorePercent } : item) }); }} /></label>
        <label className="field"><span>{copy.comment}</span><textarea rows={3} maxLength={2000} value={criterion.feedback} onChange={event => { const feedback = event.target.value; onChange?.({ ...rubric, criteria: rubric.criteria.map(item => item.id === criterion.id ? { ...item, feedback } : item) }); }} /></label>
      </>}
    </section>)}
  </section>;
}
export function HomeworkRubricBreakdown({ feedback, locale, maxScore = 100 }: { feedback: HomeworkRubricFeedback; locale: string; maxScore?: number }) {
  const copy = homeworkRubricCopy(locale), format = (value: number | null, weight = 100) => value === null ? copy.pending : Number((value * weight / 100 * maxScore / 100).toFixed(2));
  return <div className="inline-panel grading-breakdown-grid">
    {feedback.codeWeightPercent > 0 && <p>{copy.codeScore}: {format(feedback.codeScore, feedback.codeWeightPercent)} / {feedback.codeWeightPercent * maxScore / 100}</p>}
    {feedback.questionsWeightPercent > 0 && <p>{copy.questionScore}: {format(feedback.questionsScore, feedback.questionsWeightPercent)} / {feedback.questionsWeightPercent * maxScore / 100}</p>}
    <p>{copy.calculated}: {format(feedback.combinedScore)} / {maxScore}</p>
  </div>;
}

export function HomeworkStudentRubricReport({ feedback: value, report, locale = "en", maxScore = 100 }: {
  feedback: { kind: string; feedbackText?: string | null; details?: Record<string, unknown> } | null;
  report?: Record<string, unknown>; locale?: string; maxScore?: number;
}) {
  if (value?.kind !== "homework_rubric" || !isHomeworkFeedback({ ...value.details, kind: value.kind })) return value?.feedbackText ? <p>{value.feedbackText}</p> : null;
  const feedback = { ...value.details, kind: value.kind } as HomeworkRubricFeedback, copy = homeworkRubricCopy(locale);
  const questions = Array.isArray(report?.questions) ? report.questions.map(objectRecord) : [];
  return <div className="stack">
    <HomeworkRubricBreakdown feedback={feedback} locale={locale} maxScore={maxScore} />
    {value.feedbackText && <p style={{ whiteSpace: "pre-wrap" }}>{value.feedbackText}</p>}
    {feedback.summary && <p style={{ whiteSpace: "pre-wrap" }}>{feedback.summary}</p>}
    {(["strengths", "improvements"] as const).map(field => feedback[field]?.some(text => text.trim()) ? <section key={field}><strong>{copy[field]}</strong>{feedback[field].filter(text => text.trim()).map((text, index) => <p key={index} style={{ whiteSpace: "pre-wrap" }}>{text}</p>)}</section> : null)}
    {feedback.codeWeightPercent > 0 && <HomeworkRubricFields rubric={feedback.code} title={copy.code} locale={locale} readOnly />}
    {feedback.questionsWeightPercent > 0 && feedback.questions.map((rubric, index) => {
      const question = questions.find(item => item.id === rubric.id);
      return <section className="inline-panel stack" key={rubric.id}><h3>{copy.question} {index + 1}</h3>
        {question && <><MarkdownRenderer markdown={String(question.questionText)} /><strong>{copy.answer}</strong><p style={{ whiteSpace: "pre-wrap" }}>{String(question.studentAnswer).trim() || copy.noAnswer}</p></>}
        <HomeworkRubricFields rubric={rubric} title={copy.questions} locale={locale} readOnly />
      </section>;
    })}
  </div>;
}
