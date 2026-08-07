"use client";

import type { ReactNode } from "react";
import type { TestReviewAllItemContext, TestReviewAllSubmission } from "@/lib/test-review-all";

export function TestReviewAllPanel({
  activityTitle,
  submissions,
  loading,
  error,
  onClose,
  renderItem,
  t
}: {
  activityTitle: string;
  submissions: TestReviewAllSubmission[];
  loading: boolean;
  error: string;
  onClose: () => void;
  renderItem: (context: TestReviewAllItemContext) => ReactNode;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const referenceItems = submissions[0]?.review.items ?? [];

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
