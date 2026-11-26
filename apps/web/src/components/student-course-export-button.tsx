"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressDialog, useNotifications } from "@cognelo/activity-ui";
import { AppIcon } from "./app-icon";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function StudentCourseExportButton({ courseId }: { courseId: string }) {
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const current = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => () => { current.current?.abort(); current.current = null; }, []);

  async function download() {
    if (current.current) return;
    const controller = new AbortController(); current.current = controller; setRunning(true);
    try {
      const file = await api.exportStudentCourse(courseId, locale, controller.signal);
      if (controller.signal.aborted || current.current !== controller) return;
      const url = URL.createObjectURL(file.blob), link = document.createElement("a");
      link.href = url; link.download = file.fileName; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      notifications.success(t("courseExport.ready"));
    } catch (error) {
      if (controller.signal.aborted || current.current !== controller) return;
      const key = error instanceof ApiError && error.status === 413 ? "courseExport.tooLarge"
        : error instanceof ApiError && error.status === 409 ? "courseExport.changed"
          : error instanceof ApiError && error.status === 403 ? "courseExport.unavailable"
            : error instanceof ApiError && error.status === 429 ? "courseExport.busy" : null;
      notifications.error(key ? t(key) : error instanceof Error ? error.message : t("courseExport.failed"));
    } finally {
      if (current.current === controller) { current.current = null; setRunning(false); }
    }
  }
  function cancel() { const controller = current.current; current.current = null; controller?.abort(); setRunning(false); }
  return <>
    <button type="button" className="secondary" disabled={running} onClick={() => { void download(); }}><AppIcon name="download" />{t("courseExport.action")}</button>
    <ProgressDialog open={running} title={t("courseExport.preparing")} message={t("courseExport.preparingHelp")}
      progressLabel={t("common.operationProgress")} cancelLabel={t("common.cancel")} onCancel={cancel} />
  </>;
}
