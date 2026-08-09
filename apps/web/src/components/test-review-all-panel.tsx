"use client";

import type { ReactNode } from "react";
import {
  buildTestReportSummary,
  type TestReviewAllItemContext,
  type TestReviewAllSubmission
} from "@/lib/test-review-all";

export function TestReviewAllPanel({
  activityTitle,
  participantCount,
  submissions,
  loading,
  error,
  onClose,
  renderItem,
  t
}: {
  activityTitle: string;
  participantCount: number;
  submissions: TestReviewAllSubmission[];
  loading: boolean;
  error: string;
  onClose: () => void;
  renderItem: (context: TestReviewAllItemContext) => ReactNode;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const referenceItems = submissions[0]?.review.items ?? [];
  const report = buildTestReportSummary(submissions, participantCount);

  return (
    <section className="dialog-panel answer-overlay test-review-overlay" role="dialog" aria-modal="true">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("courseDetail.testOverview")}</p>
          <h2>{t("courseDetail.reviewAll")}</h2>
          <p className="muted">{activityTitle} · {t("courseDetail.latestCompletedTestAttempts", { count: submissions.length })}</p>
        </div>
        <button className="button secondary" type="button" onClick={onClose}>{t("common.close")}</button>
      </div>

      {loading ? <p className="muted">{t("courseDetail.loadingStudentAnswers")}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error && !referenceItems.length ? <p className="muted">{t("courseDetail.noCompletedTestAnswers")}</p> : null}

      {!loading && !error && referenceItems.length ? (
        <section className="test-report-summary stack">
          <div>
            <p className="eyebrow">{t("courseDetail.reportSummaryEyebrow")}</p>
            <h3>{t("courseDetail.reportOverallResults")}</h3>
            <p className="muted">{t("courseDetail.reportLatestAttemptMethod")}</p>
          </div>
          <div className="test-report-metrics">
            <ReportMetric
              label={t("courseDetail.reportSubmissions")}
              value={`${report.submissionCount} / ${report.participantCount}`}
              note={t("courseDetail.reportCompletionRate", { value: formatPercentage(report.completionRate) })}
            />
            <ReportMetric
              label={t("courseDetail.reportAverageScore")}
              value={formatPercentage(report.scores.mean)}
              note={t("courseDetail.reportGradedAttempts", { count: report.gradedCount })}
            />
            <ReportMetric
              label={t("courseDetail.reportMedianScore")}
              value={formatPercentage(report.scores.median)}
              note={t("courseDetail.reportScoreRange", {
                minimum: formatPercentage(report.scores.minimum),
                maximum: formatPercentage(report.scores.maximum)
              })}
            />
            <ReportMetric
              label={t("courseDetail.reportScoreSpread")}
              value={report.scores.standardDeviation === null ? "—" : formatDecimal(report.scores.standardDeviation)}
              note={t("courseDetail.reportPercentagePoints")}
            />
            <ReportMetric
              label={t("courseDetail.reportAverageTime")}
              value={formatDuration(report.durations.mean)}
              note={t("courseDetail.reportTimedAttempts", { count: report.durations.count })}
            />
            <ReportMetric
              label={t("courseDetail.reportLateSubmissions")}
              value={String(report.lateSubmissionCount)}
              note={t("courseDetail.reportSubmissionPercentage", {
                value: formatPercentage(report.submissionCount ? (report.lateSubmissionCount / report.submissionCount) * 100 : null)
              })}
            />
          </div>

          <div className="stack stack-tight">
            <h3>{t("courseDetail.reportActivityPerformance")}</h3>
            <div className="test-report-activity-table">
              <div className="test-report-activity-row test-report-activity-head" aria-hidden="true">
                <span>{t("courseDetail.reportActivity")}</span>
                <span>{t("courseDetail.reportResponses")}</span>
                <span>{t("courseDetail.reportAverage")}</span>
                <span>{t("courseDetail.reportMedian")}</span>
              </div>
              {report.activities.map((activity, index) => (
                <div className="test-report-activity-row" key={activity.testItemId}>
                  <span><strong>{index + 1}. {activity.title}</strong></span>
                  <span>{activity.responseCount} / {report.submissionCount}</span>
                  <span>{formatPercentage(activity.scores.mean)}</span>
                  <span>{formatPercentage(activity.scores.median)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !error ? referenceItems.map((item, index) => {
        const responses = submissions.flatMap((submission) => {
          const responseItem = submission.review.items.find((candidate) => candidate.testItemId === item.testItemId);
          return responseItem ? [{
            participantId: submission.participantId,
            participantName: submission.participantName,
            groupTitle: submission.groupTitle,
            item: responseItem
          }] : [];
        });
        return (
          <article className="inline-panel stack" key={item.testItemId}>
            <div>
              <p className="eyebrow">{t("courseDetail.testActivityNumber", { number: index + 1 })}</p>
              <h3>{item.title}</h3>
              <p className="muted">{t("courseDetail.testResponseCount", { count: responses.length })}</p>
            </div>
            {renderItem({ item, responses, t }) ?? <p className="muted">{t("courseDetail.reviewAllRendererUnavailable")}</p>}
          </article>
        );
      }) : null}
    </section>
  );
}

function ReportMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="test-report-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function formatPercentage(value: number | null) {
  return value === null ? "—" : `${formatDecimal(value)}%`;
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDuration(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.max(0, Math.round(value));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}
