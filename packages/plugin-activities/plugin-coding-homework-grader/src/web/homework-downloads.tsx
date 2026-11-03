"use client";
import { ActionIcon } from "@cognelo/activity-ui";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";

export function HomeworkDownloads({ promptPdfId, hasProvidedFiles, activityFileUrl, providedFilesUrl, locale }: {
  promptPdfId?: string; hasProvidedFiles: boolean; activityFileUrl?: (id: string) => string; providedFilesUrl?: string; locale: CodingHomeworkLocale;
}) {
  const copy = homeworkWorkflowCopy(locale);
  const pdfUrl = promptPdfId && activityFileUrl ? activityFileUrl(promptPdfId) : null;
  if (!pdfUrl && !(hasProvidedFiles && providedFilesUrl)) return null;
  return <div className="row wrap homework-downloads">
    {pdfUrl && <a className="button secondary" href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`} download><ActionIcon name="download" /> {copy.downloadAssignment}</a>}
    {hasProvidedFiles && providedFilesUrl && <a className="button secondary" href={providedFilesUrl} download><ActionIcon name="download" /> {copy.downloadProvidedFiles}</a>}
  </div>;
}
