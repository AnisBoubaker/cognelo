"use client";

import { useEffect, useState } from "react";
import { EditActionBar, HelpLabel, ToggleSwitch, getEditActionBarCopy, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { StudentCourseExportPolicy } from "@cognelo/contracts";
import { AppShell } from "@/components/app-shell";
import { SettingsNav } from "@/components/settings-nav";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function CourseExportSettingsPage() {
  const { user } = useAuth(), { t, locale } = useI18n(), notifications = useNotifications();
  const [draft, setDraft] = useState<StudentCourseExportPolicy | null>(null), [saved, setSaved] = useState<StudentCourseExportPolicy | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [reload, setReload] = useState(0);
  const isAdmin = user?.roles.includes("admin"), copy = getEditActionBarCopy(locale);
  const isDirty = Boolean(draft && saved && (draft.usageRights !== saved.usageRights || draft.allowTeacherEditing !== saved.allowTeacherEditing));
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    api.studentCourseExportPolicy().then(value => { if (active) { setDraft(value); setSaved(value); setError(""); } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : t("courseExport.policyLoadError")); });
    return () => { active = false; };
  }, [isAdmin, reload, t]);
  const discard = () => setDraft(saved);
  async function save() {
    if (!draft) return;
    setBusy(true);
    try { const value = await api.updateStudentCourseExportPolicy(draft); setSaved(value); setDraft(value); notifications.success(t("courseExport.policySaved")); }
    catch (err) { notifications.error(err instanceof Error ? err.message : t("courseExport.failed")); throw err; }
    finally { setBusy(false); }
  }
  useUnsavedChangesGuard({ isDirty, onSave: save, onDiscard: discard });
  return <AppShell><main className="page settings-layout"><SettingsNav /><section className="section stack">
    <HelpLabel help={t("courseExport.adminHelp")}><h1 className="section-title">{t("courseExport.adminTitle")}</h1></HelpLabel>
    {!isAdmin ? <p>{t("courseExport.adminOnly")}</p> : <>
      {error ? <div role="alert"><p className="error">{error}</p><button type="button" className="secondary" onClick={() => setReload(value => value + 1)}>{t("common.retry")}</button></div> : null}
      {!draft ? <p>{t("common.loading")}</p> : <form id="course-export-policy" className="form" onSubmit={event => { event.preventDefault(); void save().catch(() => {}); }}>
        <div className="field"><HelpLabel help={t("courseExport.siteRightsHelp")}><label htmlFor="site-export-usage-rights">{t("courseExport.siteUsageRights")}</label></HelpLabel>
          <textarea id="site-export-usage-rights" rows={8} maxLength={20_000} disabled={busy} value={draft.usageRights} onChange={event => setDraft({ ...draft, usageRights: event.target.value })} /></div>
        <ToggleSwitch label={t("courseExport.allowTeacherEditing")} help={t("courseExport.allowTeacherEditingHelp")} locale={locale} disabled={busy} checked={draft.allowTeacherEditing} onChange={allowTeacherEditing => setDraft({ ...draft, allowTeacherEditing })} />
      </form>}
      <EditActionBar form="course-export-policy" isDirty={isDirty} isSaving={busy} savedLabel={copy.saved} unsavedLabel={copy.unsaved} saveLabel={copy.save} savingLabel={copy.saving} cancelLabel={copy.cancel} onCancel={discard} saveDisabled={!draft} />
    </>}
  </section></main></AppShell>;
}
