"use client";

import { useApplicationTime, formatZonedDateTime } from "@cognelo/activity-ui";


import { useId, useState } from "react";
import { ConfirmationDialog, useBodyScrollLock, useNotifications } from "@cognelo/activity-ui";
import { api, type CourseGradebookRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { deletableSubmissions } from "@/lib/submission-deletion";

export function DeleteSubmissionDialog({ courseId, row, onClose, onDeleted }: {
  courseId: string;
  row: CourseGradebookRow;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const { timeZone } = useApplicationTime();
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const id = useId();
  const attempts = deletableSubmissions(row);
  const [attemptId, setAttemptId] = useState(attempts[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedAttempt = attempts.find((attempt) => attempt.id === attemptId);
  useBodyScrollLock(true);

  async function confirmDeletion() {
    const normalizedReason = reason.trim();
    if (!selectedAttempt || !normalizedReason || saving) return;
    setSaving(true);
    setError("");
    try {
      await api.deleteActivitySubmission(courseId, selectedAttempt.id, { reason: normalizedReason });
    } catch (error) {
      setError(error instanceof Error ? error.message : t("courseDetail.deleteSubmissionError"));
      setSaving(false);
      return;
    }
    // Deletion is already recorded. A failed refresh must not offer a second deletion.
    onClose();
    notifications.success(t("courseDetail.submissionDeleted"));
    try { await onDeleted(); }
    catch (error) { notifications.error(error instanceof Error ? error.message : t("courseDetail.loadError")); }
  }

  return (
    <ConfirmationDialog
      open
      title={t("courseDetail.deleteSubmission")}
      eyebrow={`${row.activityTitle} · ${row.participantName}`}
      confirmLabel={saving ? t("common.saving") : t("courseDetail.deleteSubmission")}
      cancelLabel={t("common.cancel")}
      confirmVariant="danger"
      confirmDisabled={!selectedAttempt || !reason.trim()}
      isConfirming={saving}
      onCancel={onClose}
      onConfirm={confirmDeletion}
      message={(
        <div className="stack">
          {selectedAttempt ? <p>{t("courseDetail.deleteSubmissionConfirm", { name: row.participantName, number: selectedAttempt.attemptNumber })}</p> : <p>{t("courseDetail.deleteSubmissionUnavailable")}</p>}
          {attempts.length > 1 ? (
            <div className="field">
              <label htmlFor={`${id}-attempt`}>{t("courseDetail.deleteSubmissionSelect")}</label>
              <select id={`${id}-attempt`} disabled={saving} value={attemptId} onChange={(event) => setAttemptId(event.target.value)}>
                {attempts.map((attempt) => <option key={attempt.id} value={attempt.id}>
                  {t("courseDetail.deleteSubmissionOption", {
                    number: attempt.attemptNumber,
                    date: formatZonedDateTime(new Date(attempt.submittedAt ?? attempt.startedAt), timeZone, locale, { dateStyle: "medium", timeStyle: "medium" })
                  })}
                </option>)}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor={`${id}-reason`}>{t("courseDetail.deleteSubmissionPrompt")}</label>
            <textarea id={`${id}-reason`} autoFocus required maxLength={1000} rows={3} disabled={saving} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <p>{t("courseDetail.deleteSubmissionHistoryNotice")}</p>
          {error ? <p className="error" role="alert">{error}</p> : null}
        </div>
      )}
    />
  );
}
