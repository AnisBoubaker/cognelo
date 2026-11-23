import type { GradingReview } from "@cognelo/contracts";

/** The host renders required reviews for every activity plugin. Evidence stays plugin-owned. */
export function GradingReviewNotice({ reviews, t }: {
  reviews?: GradingReview[]; t: (key: string) => string;
}) {
  const required = reviews?.filter(review => review.status === "required") ?? [];
  if (!required.length) return null;
  return <div className="inline-panel stack" role="alert">
    <strong>{t("courseDetail.gradingReviewRequired")}</strong>
    {required.map(review => <p key={review.id}>{review.message}</p>)}
    <p>{t("courseDetail.gradingReviewFinalScore")}</p>
  </div>;
}
