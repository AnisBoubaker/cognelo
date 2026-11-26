"use client";
import { HelpLabel } from "@cognelo/activity-ui";

import { AppIcon } from "@/components/app-icon";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EditActionBar, ToggleSwitch, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { CourseInput, StudentContentLayout, StudentCourseExportPolicy } from "@cognelo/contracts";
import { api, ApiError, type Course, type Subject } from "@/lib/api";
import { resolveStudentContentLayout } from "@/lib/course-settings";
import { useI18n } from "@/lib/i18n";

type CourseFormInput = CourseInput & { studentContentLayout?: StudentContentLayout; studentCourseExportEnabled?: boolean; studentCourseExportUsageRights?: string | null; studentCourseExportConfidential?: boolean };

type Props = {
  initial?: Pick<Course, "subjectId" | "title" | "description" | "status" | "metadata" | "studentCourseExportEnabled" | "studentCourseExportUsageRights" | "studentCourseExportConfidential">;
  showStudentContentLayout?: boolean;
  subjects: Subject[];
  submitLabel: string;
  onSubmit: (input: CourseFormInput) => Promise<void>;
};

export function CourseForm({ initial, showStudentContentLayout = false, subjects, submitLabel, onSubmit }: Props) {
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? subjects[0]?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [studentCourseExportEnabled, setStudentCourseExportEnabled] = useState(initial?.studentCourseExportEnabled === true);
  const [usageRights, setUsageRights] = useState<string | null>(initial?.studentCourseExportUsageRights ?? null);
  const [confidential, setConfidential] = useState(initial?.studentCourseExportConfidential === true);
  const [exportPolicy, setExportPolicy] = useState<StudentCourseExportPolicy | null>(null);
  const [policyError, setPolicyError] = useState("");
  const [policyReload, setPolicyReload] = useState(0);
  const [studentContentLayout, setStudentContentLayout] = useState<StudentContentLayout>(() =>
    resolveStudentContentLayout(initial?.metadata)
  );
  const [savedSnapshot, setSavedSnapshot] = useState(() => courseSnapshot(initial, subjects[0]?.id ?? ""));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showStudentContentLayout) return;
    let active = true;
    api.studentCourseExportPolicy().then(policy => { if (active) { setExportPolicy(policy); setPolicyError(""); } })
      .catch(err => { if (active) setPolicyError(err instanceof Error ? err.message : t("courseExport.policyLoadError")); });
    return () => { active = false; };
  }, [showStudentContentLayout, policyReload, t]);

  useEffect(() => {
    if (!subjectId && subjects[0]?.id) {
      setSubjectId(subjects[0].id);
      setSavedSnapshot((current) => (current.subjectId ? current : courseSnapshot(initial, subjects[0].id)));
    }
  }, [initial, subjectId, subjects]);

  const currentSnapshot = useMemo(
    () => ({ subjectId, title, description, status, studentContentLayout, studentCourseExportEnabled, usageRights, confidential }),
    [description, status, studentContentLayout, studentCourseExportEnabled, usageRights, confidential, subjectId, title]
  );
  const hasUnsavedChanges = !courseSnapshotsEqual(currentSnapshot, savedSnapshot);

  const discardChanges = useCallback(() => {
    setSubjectId(savedSnapshot.subjectId);
    setTitle(savedSnapshot.title);
    setDescription(savedSnapshot.description);
    setStatus(savedSnapshot.status);
    setStudentContentLayout(savedSnapshot.studentContentLayout);
    setStudentCourseExportEnabled(savedSnapshot.studentCourseExportEnabled);
    setUsageRights(savedSnapshot.usageRights); setConfidential(savedSnapshot.confidential);
    setError("");
  }, [savedSnapshot]);

  const saveCourse = useCallback(async () => {
    setError("");
    setSaving(true);
    try {
      if (showStudentContentLayout && studentCourseExportEnabled && (!exportPolicy || policyError)) throw new Error(t("courseExport.policyLoadError"));
      await onSubmit({
        subjectId,
        title,
        description,
        status,
        ...(showStudentContentLayout ? { studentContentLayout, studentCourseExportEnabled, studentCourseExportConfidential: confidential,
          ...(exportPolicy?.allowTeacherEditing && usageRights !== savedSnapshot.usageRights ? { studentCourseExportUsageRights: usageRights } : {}) } : {})
      });
      setSavedSnapshot({ subjectId, title, description, status, studentContentLayout, studentCourseExportEnabled, usageRights, confidential });
    } catch (err) {
      const locked = err instanceof ApiError && err.code === "COURSE_EXPORT_RIGHTS_LOCKED";
      if (locked) {
        setUsageRights(savedSnapshot.usageRights);
        await api.studentCourseExportPolicy().then(setExportPolicy).catch(() => { setExportPolicy(null); setPolicyError(t("courseExport.policyLoadError")); });
      }
      notifications.error(locked ? t("courseExport.rightsLocked") : err instanceof Error ? err.message : t("courseForm.saveError"));
      setError("");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [description, notifications, onSubmit, showStudentContentLayout, status, studentContentLayout, studentCourseExportEnabled, usageRights, confidential, exportPolicy, policyError, savedSnapshot.usageRights, subjectId, t, title]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedChanges,
        onSave: saveCourse,
        onDiscard: discardChanges
      }),
      [discardChanges, hasUnsavedChanges, saveCourse]
    )
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await saveCourse();
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="subjectId">{t("courseForm.subject")}</label>
        <select id="subjectId" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.title}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="title">{t("courseForm.title")}</label>
        <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} />
      </div>
      <div className="field">
        <label htmlFor="description">{t("courseForm.description")}</label>
        <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="status">{t("courseForm.status")}</label>
        <select id="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="draft">{t("status.draft")}</option>
          <option value="published">{t("status.published")}</option>
          <option value="archived">{t("status.archived")}</option>
        </select>
      </div>
      {showStudentContentLayout ? (
        <div className="field">
          <HelpLabel help={<>{t("courseForm.studentContentLayoutHelp")}</>}><label htmlFor="studentContentLayout">{t("courseForm.studentContentLayout")}</label></HelpLabel>
          <select
            id="studentContentLayout"
            value={studentContentLayout}
            onChange={(event) => setStudentContentLayout(event.target.value as StudentContentLayout)}
          >
            <option value="accordion">{t("courseForm.studentContentLayoutAccordion")}</option>
            <option value="folder_tabs">{t("courseForm.studentContentLayoutFolderTabs")}</option>
          </select>

        </div>
      ) : null}
      {showStudentContentLayout ? <ToggleSwitch checked={studentCourseExportEnabled} onChange={setStudentCourseExportEnabled}
        label={t("courseExport.setting")} help={t("courseExport.settingHelp")} locale={locale} disabled={saving} /> : null}
      {showStudentContentLayout && studentCourseExportEnabled ? <>
        {policyError ? <div role="alert"><p className="error">{policyError}</p><button className="secondary" type="button" onClick={() => setPolicyReload(value => value + 1)}>{t("common.retry")}</button></div> : null}
        <div className="field">
          <HelpLabel help={t("courseExport.usageRightsHelp")}><label htmlFor="course-export-usage-rights">{t("courseExport.usageRights")}</label></HelpLabel>
          <textarea id="course-export-usage-rights" rows={6} maxLength={20_000} disabled={saving} readOnly={!exportPolicy?.allowTeacherEditing || Boolean(policyError)}
            value={exportPolicy?.allowTeacherEditing ? usageRights ?? exportPolicy.usageRights : exportPolicy?.usageRights ?? ""} onChange={event => setUsageRights(event.target.value)} />
          {!exportPolicy ? <p className="muted">{t("common.loading")}</p> : !exportPolicy.allowTeacherEditing ? <p className="muted">{t("courseExport.rightsLocked")}</p> : usageRights !== null ?
            <button className="secondary" type="button" disabled={saving} onClick={() => setUsageRights(null)}>{t("courseExport.useSiteDefault")}</button> : <p className="muted">{t("courseExport.inheritsSiteDefault")}</p>}
        </div>
        <ToggleSwitch checked={confidential} onChange={setConfidential} label={t("courseExport.confidential")} help={t("courseExport.confidentialHelp")} locale={locale} disabled={saving} />
      </> : null}
      {error ? <p className="error">{error}</p> : null}
      {initial ? (
        <EditActionBar
          isDirty={hasUnsavedChanges}
          isSaving={saving}
          savedLabel={t("common.savedStatus")}
          unsavedLabel={t("common.unsavedStatus")}
          saveLabel={submitLabel}
          savingLabel={t("common.saving")}
          cancelLabel={t("common.cancel")}
          onCancel={discardChanges}
          onSave={saveCourse}
          saveDisabled={!subjectId}
        />
      ) : (
        <button type="submit" disabled={saving || !subjectId}>
          <AppIcon name="add" />
          {saving ? t("common.saving") : submitLabel}
        </button>
      )}
    </form>
  );
}

function courseSnapshot(initial: Props["initial"], fallbackSubjectId: string) {
  return {
    subjectId: initial?.subjectId ?? fallbackSubjectId,
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "draft",
    studentContentLayout: resolveStudentContentLayout(initial?.metadata),
    studentCourseExportEnabled: initial?.studentCourseExportEnabled === true,
    usageRights: initial?.studentCourseExportUsageRights ?? null,
    confidential: initial?.studentCourseExportConfidential === true
  };
}

function courseSnapshotsEqual(
  left: ReturnType<typeof courseSnapshot>,
  right: ReturnType<typeof courseSnapshot>
) {
  return left.subjectId === right.subjectId
    && left.title === right.title
    && left.description === right.description
    && left.status === right.status
    && left.studentContentLayout === right.studentContentLayout
    && left.studentCourseExportEnabled === right.studentCourseExportEnabled
    && left.usageRights === right.usageRights && left.confidential === right.confidential;
}
