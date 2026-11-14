"use client";

import { useApplicationTime } from "@cognelo/activity-ui";
import type { ActivityStudentProgress } from "@cognelo/contracts";
import type { Locale } from "../lib/i18n";

export function ActivityProgressBadge({ progress, locale, t }: {
  progress: ActivityStudentProgress | null;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const { timeZone } = useApplicationTime();
  if (!progress) return <span className="muted">—</span>;
  const stage = progress.stageNames?.[locale] ?? progress.stageNames?.en;
  const label = progress.state === "not_started" ? t("courseDetail.progressNotStarted")
    : progress.state === "done" ? t("courseDetail.progressDone")
    : progress.state === "stage_submitted" ? t("courseDetail.progressStageSubmitted", { stage: stage ?? "" })
    : stage ? t("courseDetail.progressStageInProgress", { stage })
    : progress.attemptNumber ? t("courseDetail.attemptInProgress", { number: progress.attemptNumber }) : t("courseDetail.progressInProgress");
  return <div className="activity-progress-cell">
    <span className={`activity-progress-badge activity-progress-${progress.state}${progress.state === "in_progress" ? " gradebook-attempt-in-progress-badge" : ""}`}>
      <span aria-hidden="true">{progress.state === "done" ? "✓" : "●"}</span>{label}
    </span>
    {progress.startedAt && progress.state === "in_progress" ? <span className="table-meta-note muted">
      {t("courseDetail.attemptStartedAt", { date: new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(progress.startedAt)) })}
    </span> : null}
  </div>;
}
