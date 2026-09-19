"use client";

import { useEffect, useState } from "react";
import { api, type GradeChallenge } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function CourseGradeChallengesPanel({ courseId }: { courseId: string }) {
  const { t } = useI18n();
  const [challenges, setChallenges] = useState<GradeChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responseById, setResponseById] = useState<Record<string, string>>({});
  const [scoreById, setScoreById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

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

  async function resolve(challenge: GradeChallenge, status: "upheld" | "adjusted") {
    const teacherResponse = responseById[challenge.id]?.trim() ?? "";
    if (!teacherResponse) return;
    const score = Number(scoreById[challenge.id]);
    if (status === "adjusted" && !Number.isFinite(score)) return;
    setSavingId(challenge.id);
    try {
      await api.resolveGradeChallenge(courseId, challenge.id, status === "adjusted"
        ? { status, teacherResponse, score }
        : { status, teacherResponse });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.challengeResolveError"));
    } finally {
      setSavingId(null);
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
      {challenges.map((challenge) => (
        <article className="inline-panel stack" key={challenge.id}>
          <div className="row wrap" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{challenge.participantName}</strong>
              <p className="muted">{challenge.activityTitle} · {challenge.groupTitle}</p>
            </div>
            <span className="status-badge">{t(`courseDetail.challengeStatus.${challenge.status}`)}</span>
          </div>
          <div>
            <strong>{t("courseDetail.studentExplanation")}</strong>
            <p>{challenge.explanation}</p>
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
              <div className="field">
                <label htmlFor={`challenge-score-${challenge.id}`}>{t("courseDetail.adjustedScore")}</label>
                <input
                  id={`challenge-score-${challenge.id}`}
                  min={0}
                  type="number"
                  value={scoreById[challenge.id] ?? ""}
                  onChange={(event) => setScoreById((current) => ({ ...current, [challenge.id]: event.target.value }))}
                />
              </div>
              <div className="row wrap">
                <button
                  className="button secondary"
                  disabled={savingId === challenge.id || !(responseById[challenge.id]?.trim())}
                  type="button"
                  onClick={() => void resolve(challenge, "upheld")}
                >
                  {t("courseDetail.upholdGrade")}
                </button>
                <button
                  disabled={savingId === challenge.id || !(responseById[challenge.id]?.trim()) || !Number.isFinite(Number(scoreById[challenge.id]))}
                  type="button"
                  onClick={() => void resolve(challenge, "adjusted")}
                >
                  {t("courseDetail.adjustGrade")}
                </button>
              </div>
            </>
          ) : challenge.teacherResponse ? (
            <div>
              <strong>{t("courseDetail.teacherResponse")}</strong>
              <p>{challenge.teacherResponse}</p>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
