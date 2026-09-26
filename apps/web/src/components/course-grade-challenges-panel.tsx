"use client";

import { useEffect, useState } from "react";
import { ReviewAndGradeDialog } from "@/components/review-and-grade-dialog";
import { api, type CourseGradebookRow, type GradeChallenge } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function CourseGradeChallengesPanel({ courseId }: { courseId: string }) {
  const { t } = useI18n();
  const [challenges, setChallenges] = useState<GradeChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responseById, setResponseById] = useState<Record<string, string>>({});
  const [notifyById, setNotifyById] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const [reviewRow, setReviewRow] = useState<CourseGradebookRow | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const result = await api.courseGradeChallenges(courseId);
      setChallenges(result.challenges);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.challengesLoadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [courseId]);

  async function sendAnswer(challenge: GradeChallenge) {
    const teacherResponse = responseById[challenge.id]?.trim() ?? "";
    if (!teacherResponse) return;
    setSavingId(challenge.id);
    try {
      await api.resolveGradeChallenge(courseId, challenge.id, {
        teacherResponse,
        notifyStudent: Boolean(notifyById[challenge.id])
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.challengeResolveError"));
    } finally {
      setSavingId(null);
    }
  }

  async function openReviewAndGrade(challenge: GradeChallenge) {
    setReviewLoadingId(challenge.id);
    setError("");
    try {
      const result = await api.courseGradebook(courseId, {
        activityId: challenge.reviewActivityId ?? challenge.activityId,
        groupId: challenge.groupId
      });
      const row = result.gradebook.rows.find((candidate) => candidate.participantId === challenge.participantId);
      if (!row) throw new Error(t("courseDetail.feedbackReviewUnavailable"));
      setReviewRow(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.feedbackReviewUnavailable"));
    } finally {
      setReviewLoadingId(null);
    }
  }

  return (
    <section className="section stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("courseDetail.challengesEyebrow")}</p>
          <h2>{t("courseDetail.challengesTitle")}</h2>
          <p className="muted">{t("courseDetail.challengesHelp")}</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">{t("common.loading")}</p> : null}
      {!loading && !challenges.length ? <p className="muted">{t("courseDetail.noChallenges")}</p> : null}
      <div className="grade-challenge-list">
        {challenges.map((challenge) => (
          <details className="grade-challenge-item" key={challenge.id}>
            <summary>
              <span className="grade-challenge-title">
                <strong>{challenge.activityTitle}</strong>
                <span aria-hidden="true">→</span>
                <span>{challenge.participantName}</span>
              </span>
              <span className="muted">{challenge.groupTitle}</span>
              <span className="status-badge">{t(`courseDetail.challengeStatus.${challenge.status}`)}</span>
            </summary>
            <div className="grade-challenge-content stack">
              <div>
                <strong>{t("courseDetail.studentExplanation")}</strong>
                <p>{challenge.explanation}</p>
              </div>
              <div className="row wrap">
                <button
                  className="button secondary"
                  disabled={reviewLoadingId === challenge.id}
                  type="button"
                  onClick={() => void openReviewAndGrade(challenge)}
                >
                  {reviewLoadingId === challenge.id ? t("common.loading") : t("courseDetail.reviewAndGrade")}
                </button>
              </div>
              {challenge.status === "open" ? (
                <>
                  <div className="field">
                    <label htmlFor={`challenge-response-${challenge.id}`}>{t("courseDetail.teacherResponse")}</label>
                    <textarea
                      id={`challenge-response-${challenge.id}`}
                      rows={4}
                      value={responseById[challenge.id] ?? ""}
                      onChange={(event) => setResponseById((current) => ({ ...current, [challenge.id]: event.target.value }))}
                    />
                  </div>
                  <label className="checkbox-row" htmlFor={`challenge-notify-${challenge.id}`}>
                    <input
                      checked={Boolean(notifyById[challenge.id])}
                      id={`challenge-notify-${challenge.id}`}
                      type="checkbox"
                      onChange={(event) => setNotifyById((current) => ({ ...current, [challenge.id]: event.target.checked }))}
                    />
                    <span>{t("courseDetail.notifyStudentByEmail")}</span>
                  </label>
                  <div className="row wrap">
                    <button
                      disabled={savingId === challenge.id || !(responseById[challenge.id]?.trim())}
                      type="button"
                      onClick={() => void sendAnswer(challenge)}
                    >
                      {savingId === challenge.id ? t("common.saving") : t("courseDetail.sendChallengeAnswer")}
                    </button>
                  </div>
                </>
              ) : challenge.teacherResponse ? (
                <div>
                  <strong>{t("courseDetail.teacherResponse")}</strong>
                  <p>{challenge.teacherResponse}</p>
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
      {reviewRow ? (
        <ReviewAndGradeDialog
          courseId={courseId}
          row={reviewRow}
          onClose={() => setReviewRow(null)}
          onSaved={refresh}
        />
      ) : null}
    </section>
  );
}
