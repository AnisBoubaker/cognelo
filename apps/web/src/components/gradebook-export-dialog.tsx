"use client";

import { FormEvent, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { api } from "@/lib/api";
import { defaultGradeExportFileName, gradeExportBaseName } from "@/lib/gradebook-export";
import { useI18n } from "@/lib/i18n";

export type GradebookExportTarget = {
  courseId: string;
  courseTitle: string;
  activityId: string;
  activityTitle: string;
  groupId?: string;
  groupName: string;
};

export function GradebookExportDialog({ target, onClose }: { target: GradebookExportTarget; onClose: () => void }) {
  const { t } = useI18n();
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [fileName, setFileName] = useState(() => defaultGradeExportFileName(
    target.courseTitle,
    target.groupName,
    target.activityTitle,
    new Date()
  ));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const baseName = gradeExportBaseName(fileName);
    const link = document.createElement("a");
    link.href = api.courseActivityGradeExportUrl(target.courseId, target.activityId, {
      format,
      fileName: baseName,
      groupId: target.groupId
    });
    link.download = `${baseName}.${format}`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="gradebook-export-title" aria-modal="true" className="dialog-panel" role="dialog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("courseDetail.exportGradesEyebrow")}</p>
            <h2 id="gradebook-export-title">{t("courseDetail.exportGradesTitle")}</h2>
          </div>
          <button className="secondary icon-button" type="button" onClick={onClose} title={t("common.close")}>
            <AppIcon name="close" />
          </button>
        </div>
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="gradebook-export-format">{t("courseDetail.exportFormat")}</label>
            <select id="gradebook-export-format" value={format} onChange={(event) => setFormat(event.target.value as "csv" | "xlsx")}>
              <option value="csv">{t("courseDetail.exportFormatCsv")}</option>
              <option value="xlsx">{t("courseDetail.exportFormatXlsx")}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="gradebook-export-file-name">{t("courseDetail.exportFileName")}</label>
            <div className="grade-export-file-name">
              <input
                autoFocus
                id="gradebook-export-file-name"
                maxLength={160}
                required
                value={fileName}
                onChange={(event) => setFileName(event.target.value.replace(/\.(csv|xlsx)$/i, ""))}
              />
              <span aria-hidden="true">.{format}</span>
            </div>
          </div>
          <p className="muted">{t("courseDetail.exportFinalGradesOnlyHelp")}</p>
          <div className="dialog-actions">
            <button className="secondary" type="button" onClick={onClose}>{t("common.cancel")}</button>
            <button disabled={!fileName.trim()} type="submit">
              <AppIcon name="download" />
              {t("courseDetail.exportGrades")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
