"use client";

import { CodeRenderer } from "@cognelo/activity-ui";
import { parsonsAttemptStateSchema, parseParsonsConfig } from "@cognelo/plugin-parsons";
import type { ReactNode } from "react";
import type { CourseGradebookRow } from "@/lib/api";

export type ActivityReviewResponse = {
  participantId: string;
  participantName: string;
  groupTitle: string;
  state: Record<string, unknown> | null;
  score: number | null;
  maxScore: number;
  isPass: boolean | null;
  testResults?: Array<{ testId: string; name: string; passed: boolean }>;
};

export function ActivityReviewAllPanel({ activityTypeKey, activityTitle, config, responses, solution, tests, mcqReport, loading, error, onClose, t }: {
  activityTypeKey: string;
  activityTitle: string;
  config: Record<string, unknown>;
  responses: ActivityReviewResponse[];
  solution: unknown;
  tests?: Array<{ id: string; name: string }>;
  mcqReport?: ReactNode;
  loading: boolean;
  error: string;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <section className="dialog-panel answer-overlay test-review-overlay" role="dialog" aria-modal="true">
      <div className="section-heading">
        <div><p className="eyebrow">{activityTitle}</p><h2>{t("courseDetail.reviewAll")}</h2></div>
        <button className="button secondary" type="button" onClick={onClose}>{t("common.close")}</button>
      </div>
      {loading ? <p className="muted">{t("courseDetail.loadingStudentAnswers")}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error ? (
        activityTypeKey === "mcq" ? mcqReport
          : activityTypeKey === "parsons-problem" ? <ParsonsReport config={config} responses={responses} t={t} />
          : activityTypeKey === "coding-exercise" ? <CodingReport config={config} responses={responses} solution={solution} tests={tests ?? []} />
          : activityTypeKey === "web-design-coding-exercise" ? <WebDesignReport responses={responses} solution={solution} tests={tests ?? []} />
          : <GlobalSolution config={config} solution={solution} />
      ) : null}
    </section>
  );
}

function ParsonsReport({ config, responses, t }: { config: Record<string, unknown>; responses: ActivityReviewResponse[]; t: (key: string, params?: Record<string, string | number>) => string }) {
  const parsedConfig = parseParsonsConfig(config);
  const evaluated = responses.flatMap((response) => {
    const parsed = response.state ? parsonsAttemptStateSchema.safeParse(response.state) : null;
    return parsed?.success && parsed.data.lastEvaluation ? [{ response, evaluation: parsed.data.lastEvaluation }] : [];
  });
  const errorBuckets = bucket(evaluated, ({ evaluation }) => evaluation.misplacedBlocks, ({ response }) => response);
  const gradeBuckets = bucket(responses.filter((response) => response.score !== null), (response) => Math.round(((response.score ?? 0) / Math.max(1, response.maxScore)) * 10) * 10, (response) => response);
  return <div className="stack">
    <section className="inline-panel stack"><h3>{t("courseDetail.correctAnswer")}</h3><CodeRenderer code={parsedConfig.solution} language={parsedConfig.language} showLineNumbers /></section>
    <Distribution title="Errors distribution" buckets={errorBuckets} suffix=" errors" />
    <Distribution title="Grade distribution" buckets={gradeBuckets} suffix="%" />
  </div>;
}

function CodingReport({ config, responses, solution, tests }: { config: Record<string, unknown>; responses: ActivityReviewResponse[]; solution: unknown; tests: Array<{ id: string; name: string }> }) {
  const code = typeof solution === "string" ? solution : "";
  const language = typeof config.language === "string" ? config.language : "text";
  return <div className="stack"><section className="inline-panel stack"><h3>Correct solution</h3>{code ? <CodeRenderer code={code} language={language} showLineNumbers /> : <p className="muted">No reference solution is available.</p>}</section><PerTestResults responses={responses} tests={tests} /></div>;
}

function WebDesignReport({ responses, solution, tests }: { responses: ActivityReviewResponse[]; solution: unknown; tests: Array<{ id: string; name: string }> }) {
  const files = Array.isArray(solution) ? solution : [];
  return <div className="stack"><section className="inline-panel stack"><h3>Correct solution</h3>{files.map((value, index) => {
    const file = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const code = typeof file.starterCode === "string" ? file.starterCode : "";
    return code ? <div className="stack stack-tight" key={String(file.id ?? index)}><strong>{String(file.path ?? `File ${index + 1}`)}</strong><CodeRenderer code={code} language={typeof file.language === "string" ? file.language : "text"} showLineNumbers /></div> : null;
  })}</section><PerTestResults responses={responses} tests={tests} /></div>;
}

function GlobalSolution({ config, solution }: { config: Record<string, unknown>; solution: unknown }) {
  const value = typeof solution === "string" ? solution : typeof config.solution === "string" ? config.solution : "";
  return <section className="inline-panel stack"><h3>Correct solution</h3>{value ? <CodeRenderer code={value} language={typeof config.language === "string" ? config.language : "text"} showLineNumbers /> : <p className="muted">This activity does not expose a richer aggregate report; its global solution is shown when available.</p>}</section>;
}

function PerTestResults({ responses, tests }: { responses: ActivityReviewResponse[]; tests: Array<{ id: string; name: string }> }) {
  return <section className="inline-panel stack"><h3>Results by test</h3>{tests.map((test) => {
    const results = responses.flatMap((response) => response.testResults?.find((result) => result.testId === test.id) ? [response] : []);
    const passed = results.filter((response) => response.testResults?.find((result) => result.testId === test.id)?.passed);
    const failed = results.filter((response) => !passed.includes(response));
    return <div className="stack stack-tight" key={test.id}><strong>{test.name}</strong><div className="aggregate-stacked-bar" aria-label={`${test.name}: ${passed.length} passed, ${failed.length} failed`}>
      <BarSegment className="is-pass" label="Passed" responses={passed} total={results.length} />
      <BarSegment className="is-fail" label="Failed" responses={failed} total={results.length} />
      {!results.length ? <span className="muted">No submitted results</span> : null}
    </div></div>;
  })}</section>;
}

function Distribution({ title, buckets, suffix }: { title: string; buckets: Array<{ value: number; responses: ActivityReviewResponse[] }>; suffix: string }) {
  const maximum = Math.max(1, ...buckets.map((entry) => entry.responses.length));
  return <section className="inline-panel stack"><h3>{title}</h3><div className="aggregate-bars">{buckets.map((entry) => <div className="aggregate-bar-column" key={entry.value}><span className="aggregate-bar-value">{entry.responses.length}</span><span className="aggregate-bar" style={{ height: `${Math.max(8, entry.responses.length / maximum * 140)}px` }} title={names(entry.responses)} /><span>{entry.value}{suffix}</span></div>)}</div></section>;
}

function BarSegment({ className, label, responses, total }: { className: string; label: string; responses: ActivityReviewResponse[]; total: number }) {
  if (!responses.length) return null;
  return <span className={`aggregate-stacked-segment ${className}`} style={{ flexGrow: responses.length / Math.max(1, total) }} title={names(responses)}>{label}: {responses.length}</span>;
}

function names(responses: ActivityReviewResponse[]) { return responses.map((response) => `${response.participantName} (${response.groupTitle})`).join("\n"); }
function bucket<T>(values: T[], getValue: (value: T) => number, getResponse: (value: T) => ActivityReviewResponse) {
  const map = new Map<number, ActivityReviewResponse[]>();
  for (const value of values) map.set(getValue(value), [...(map.get(getValue(value)) ?? []), getResponse(value)]);
  return [...map].sort(([left], [right]) => left - right).map(([value, responses]) => ({ value, responses }));
}

export function toActivityReviewResponse(row: CourseGradebookRow, state: Record<string, unknown> | null): ActivityReviewResponse {
  return { participantId: row.participantId, participantName: row.participantName, groupTitle: row.groupTitle, state, score: row.score, maxScore: row.maxScore, isPass: row.isPass };
}
