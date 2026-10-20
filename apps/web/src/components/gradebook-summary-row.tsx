"use client";

import Link from "next/link";
import { useState } from "react";
import { ContextMenu } from "@cognelo/activity-ui";
import { AppIcon, DisclosureIndicator } from "@/components/app-icon";
import { useI18n } from "@/lib/i18n";

type Props = {
  title: string;
  subtitle: string;
  href: string;
  submissions: number;
  graded: number;
  meanGrade: string;
  releaseState: "released" | "partial" | "hidden" | null;
  incompleteGrades: number;
  releasePending: boolean;
  onRelease: () => void;
  onExport: () => void;
  expanded?: boolean;
  onToggle?: () => void;
};

export function GradebookSummaryRow({ title, subtitle, href, submissions, graded, meanGrade, releaseState, incompleteGrades, releasePending, onRelease, onExport, expanded, onToggle }: Props) {
  const { t } = useI18n();
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const releaseBlocked = releaseState !== "released" && incompleteGrades > 0;
  const releaseHelp = releaseBlocked ? t("courseDetail.releaseGradesBlocked", { count: incompleteGrades }) : undefined;
  const releaseLabel = releaseState === "released" ? "gradesReleasedStatus" : releaseState === "partial" ? "gradesPartlyReleasedStatus" : "gradesHiddenStatus";

  return <div className={`table-row ${onToggle ? "table-row-gradebook-activity" : "table-row-gradebook-group-summary"}`}>
    <div className={`gradebook-activity-cell${onToggle ? "" : " is-static"}`}>
      {onToggle ? <button aria-expanded={expanded} aria-label={t("courseDetail.expandActivity", { title })} className="gradebook-expander" type="button" onClick={onToggle}>
        <DisclosureIndicator expanded={Boolean(expanded)} />
      </button> : null}
      <div className="table-main table-main-stack">
        <Link className="gradebook-results-link" href={href}>{title}</Link>
        <span className="table-meta-note muted">{subtitle}</span>
      </div>
    </div>
    <div className="gradebook-row-metrics">
      <div className="gradebook-grading-progress" title={releaseHelp}>
        <span className={submissions ? undefined : "muted"}>{submissions ? t("courseDetail.gradingProgressSummary", { graded, submitted: submissions }) : t("courseDetail.noSubmissionsSummary")}</span>
        {incompleteGrades > 0 ? <span className="gradebook-incomplete-note">{t("courseDetail.incompleteGradesSummary", { count: incompleteGrades })}</span> : null}
      </div>
      <div className="gradebook-mean">
        <span className="gradebook-metric-label muted">{t("courseDetail.meanGradeHeader")}: </span>
        <strong>{meanGrade}</strong>
      </div>
      {releaseState ? <span className={`gradebook-release-state is-${releaseState}`}>{t(`courseDetail.${releaseLabel}`)}</span> : <span className="muted">—</span>}
    </div>
    <button
      aria-label={`${title}: ${t("courseDetail.actionsHeader")}`}
      aria-expanded={Boolean(menuAnchor)}
      aria-haspopup="menu"
      className="participant-group-menu-button gradebook-row-menu"
      onClick={(event) => setMenuAnchor(menuAnchor ? null : event.currentTarget)}
      type="button"
    ><AppIcon name="more" /></button>
    <ContextMenu anchor={menuAnchor} open={Boolean(menuAnchor)} className="content-context-menu" onClose={() => setMenuAnchor(null)}>
      <Link role="menuitem" className="content-context-menu-item" href={href} onClick={() => setMenuAnchor(null)}><AppIcon name="open" />{t("courseDetail.detailedResults")}</Link>
      <button role="menuitem" className="content-context-menu-item" type="button" onClick={() => { setMenuAnchor(null); onExport(); }}><AppIcon name="download" />{t("courseDetail.exportGrades")}</button>
      {releaseState ? <button
        role="menuitem"
        className="content-context-menu-item"
        disabled={releasePending || releaseBlocked}
        title={releaseHelp}
        type="button"
        onClick={() => { setMenuAnchor(null); onRelease(); }}
      ><AppIcon name={releaseState === "released" ? "hidden" : "visible"} />{t(releaseState === "released" ? "courseDetail.hideGrades" : "courseDetail.releaseGrades")}</button> : null}
    </ContextMenu>
  </div>;
}
