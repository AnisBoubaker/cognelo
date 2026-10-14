"use client";

import { useState } from "react";
import { CodeRenderer, MarkdownRenderer } from "@cognelo/activity-ui";
import type { ActivitySolution } from "@cognelo/activity-sdk";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function ActivitySolutionPanel({ courseId, groupId, activityId }: { courseId: string; groupId: string; activityId: string }) {
  const { t } = useI18n();
  const [solution, setSolution] = useState<ActivitySolution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function reveal() {
    setLoading(true);
    setError(false);
    try {
      const result = await api.activitySolution(courseId, groupId, activityId);
      setSolution(result.solution);
    } catch {
      setSolution(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section stack activity-solution" role="tabpanel" aria-label={t("activitySolution.tab")}>
      <h2>{t("activitySolution.tab")}</h2>
      {!solution ? (
        <div className="inline-panel stack">
          <strong>{t("activitySolution.tryFirstTitle")}</strong>
          <p className="muted">{t("activitySolution.tryFirstHelp")}</p>
          <div className="row">
            <button type="button" disabled={loading} onClick={() => void reveal()}>
              {loading ? t("common.loading") : t("activitySolution.show")}
            </button>
          </div>
        </div>
      ) : solution.activities.length ? solution.activities.map((entry) => (
        <article className="stack activity-solution-item" key={entry.id}>
          {solution.activities.length > 1 ? <h3>{entry.title}</h3> : null}
          {entry.content.blocks.map((block, index) => block.kind === "markdown"
            ? <MarkdownRenderer key={index} markdown={block.markdown} />
            : <div className="stack stack-tight" key={index}>
                {block.title ? <h4>{block.title}</h4> : null}
                <CodeRenderer code={block.code} language={block.language} showLineNumbers />
              </div>)}
        </article>
      )) : <p className="muted">{t("activitySolution.empty")}</p>}
      {error ? <p className="error" role="alert">{t("activitySolution.loadError")}</p> : null}
    </section>
  );
}
