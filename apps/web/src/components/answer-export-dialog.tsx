"use client";
import { useEffect, useId, useState } from "react";
import { ConfirmationDialog, ProgressDialog, useApplicationTime, useBodyScrollLock, useNotifications } from "@cognelo/activity-ui";
import type { AnswerExportStudent } from "@cognelo/contracts";
import { AppIcon } from "@/components/app-icon";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
export function AnswerExportDialog({ courseId, activityId, activityTitle, groupId, participantId, initialAttemptId, onClose }: {
  courseId: string; activityId: string; activityTitle: string; groupId?: string; participantId?: string; initialAttemptId?: string; onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const { timeZone } = useApplicationTime();
  const notifications = useNotifications();
  const id = useId();
  const [students, setStudents] = useState<AnswerExportStudent[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [attemptId, setAttemptId] = useState(initialAttemptId ?? "");
  const [attempts, setAttempts] = useState<"latest" | "all">("latest");
  const [format, setFormat] = useState<"pdf" | "zip">("pdf");
  const [includePrompt, setIncludePrompt] = useState(true);
  const [includeGrading, setIncludeGrading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  useBodyScrollLock(true);
  useEffect(() => {
    let cancelled = false;
    void api.answerExportStudents(courseId, activityId, groupId).then(({ students: result }) => {
      if (cancelled) return;
      const eligible = participantId ? result.filter((student) => student.participantId === participantId) : result;
      setStudents(eligible); setSelected(eligible.map((student) => student.participantId));
      if (participantId) setAttemptId(initialAttemptId ?? eligible[0]?.attempts[0]?.id ?? "");
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : t("answerExport.failed")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activityId, courseId, groupId, initialAttemptId, participantId, t]);
  async function download() {
    if (exporting || !selected.length) return;
    setExporting(true); setError("");
    try {
      const result = await api.exportActivityAnswers(courseId, activityId, { participantIds: selected, attempts, includePrompt, includeGrading, format: participantId ? "pdf" : format, locale, groupId, ...(participantId ? { attemptId } : {}) });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a"); link.href = url; link.download = result.fileName;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      onClose(); notifications.success(t("answerExport.ready"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("answerExport.failed")); }
    finally { setExporting(false); }
  }
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "-";
  return <>
    <ConfirmationDialog open={!exporting} title={t("answerExport.title")} eyebrow={activityTitle} confirmIcon="download"
      confirmLabel={t("answerExport.download")} cancelLabel={t("common.cancel")} onConfirm={download} onCancel={onClose}
      confirmDisabled={loading || !selected.length || Boolean(participantId && !students[0]?.attempts.some((attempt) => attempt.id === attemptId))}
      message={<div className="stack answer-export-options">
        {loading ? <p>{t("common.loading")}</p> : !students.length ? <p>{t("answerExport.noSubmissions")}</p> : participantId ? <>
          <strong>{students[0].name} · {students[0].groupTitle}</strong>
          <div className="field"><label htmlFor={`${id}-attempt`}>{t("answerExport.submission")}</label>
            <select id={`${id}-attempt`} value={attemptId} onChange={(event) => setAttemptId(event.target.value)}>{students[0].attempts.map((attempt) => <option key={attempt.id} value={attempt.id}>{t("answerExport.attempt", { number: attempt.attemptNumber, date: date(attempt.submittedAt) })}</option>)}</select></div>
        </> : <>
          <div className="section-heading"><strong>{t("answerExport.students", { selected: selected.length, total: students.length })}</strong><div className="section-actions">
            <button type="button" className="secondary" onClick={() => setSelected(students.map((student) => student.participantId))}><AppIcon name="check" />{t("answerExport.selectAll")}</button>
            <button type="button" className="secondary" onClick={() => setSelected([])}><AppIcon name="close" />{t("answerExport.clearAll")}</button>
          </div></div>
          <div className="answer-export-students">{students.map((student) => <label key={student.participantId} className="answer-export-student">
            <input type="checkbox" checked={selected.includes(student.participantId)} onChange={(event) => setSelected((old) => event.target.checked ? [...old, student.participantId] : old.filter((value) => value !== student.participantId))} />
            <span><strong>{student.name}</strong><small>{student.email} · {student.groupTitle}</small></span>
          </label>)}</div>
          <div className="field"><label htmlFor={`${id}-attempts`}>{t("answerExport.attempts")}</label><select id={`${id}-attempts`} value={attempts} onChange={(event) => setAttempts(event.target.value as "latest" | "all")}>
            <option value="latest">{t("answerExport.latest")}</option><option value="all">{t("answerExport.allAttempts")}</option>
          </select></div>
          <div className="field"><label htmlFor={`${id}-format`}>{t("answerExport.format")}</label><select id={`${id}-format`} value={format} onChange={(event) => setFormat(event.target.value as "pdf" | "zip")}>
            <option value="pdf">{t("answerExport.onePdf")}</option><option value="zip">{t("answerExport.zip")}</option>
          </select></div>
        </>}
        <label className="checkbox-row"><input type="checkbox" checked={includePrompt} onChange={(event) => setIncludePrompt(event.target.checked)} />{t("answerExport.includePrompt")}</label>
        <label className="checkbox-row"><input type="checkbox" checked={includeGrading} onChange={(event) => setIncludeGrading(event.target.checked)} />{t("answerExport.includeGrading")}</label>
        <p className="muted">{t("answerExport.submittedOnly")}</p>
        {error ? <p className="error" role="alert">{error}</p> : null}
      </div>} />
    <ProgressDialog open={exporting} title={t("answerExport.preparing")} progressLabel={t("common.operationProgress")} message={t("answerExport.preparingHelp")} />
  </>;
}
