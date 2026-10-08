"use client";

export function StudentPreviewBanner({
  groupTitle,
  onReset,
  t
}: {
  groupTitle?: string;
  onReset: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <section className="inline-panel student-preview-banner" role="status">
      <div>
        <strong>{t("studentView.bannerTitle", { group: groupTitle ?? "…" })}</strong>
        <p>{t("studentView.bannerText")}</p>
      </div>
      <div className="row">
        <button className="secondary" type="button" onClick={onReset}>{t("studentView.reset")}</button>
        <button className="secondary" type="button" onClick={() => window.close()}>{t("common.close")}</button>
      </div>
    </section>
  );
}
