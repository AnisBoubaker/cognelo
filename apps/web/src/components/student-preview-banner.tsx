"use client";

import { AppIcon } from "@/components/app-icon";

import type { ReactNode } from "react";

export function StudentPreviewBanner({
  groupTitle,
  activityTitle,
  actions,
  onReset,
  t
}: {
  groupTitle?: string;
  activityTitle?: string;
  actions?: ReactNode;
  onReset: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <section className="inline-panel student-preview-banner" role="status">
      <div>
        {activityTitle ? <h1 className="content-title">{activityTitle}</h1> : null}
        <strong>{t("studentView.bannerTitle", { group: groupTitle ?? "…" })}</strong>
        <p>{t("studentView.bannerText")}</p>
      </div>
      <div className="row">
        {actions}
        <button className="secondary" type="button" onClick={onReset}><AppIcon name="refresh" /> {t("studentView.reset")}</button>
        <button className="secondary" type="button" onClick={() => window.close()}><AppIcon name="close" /> {t("common.close")}</button>
      </div>
    </section>
  );
}
