"use client";

import { useState } from "react";
import { EditActionBar, getEditActionBarCopy, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { useCourseTimeSettings } from "@/components/course-time-provider";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function CourseTimeSettings() {
  const context = useCourseTimeSettings();
  return context?.settings.canConfigure ? <CourseTimeForm context={context} /> : null;
}

function CourseTimeForm({ context }: { context: NonNullable<ReturnType<typeof useCourseTimeSettings>> }) {
  const { courseId, settings, setSettings } = context;
  const { t, locale } = useI18n();
  const notifications = useNotifications();
  const copy = getEditActionBarCopy(locale);
  const [zone, setZone] = useState(settings.courseTimeZone ?? "");
  const [saved, setSaved] = useState(settings.courseTimeZone ?? "");
  const [busy, setBusy] = useState(false);
  const isDirty = zone !== saved;
  const discard = () => setZone(saved);
  async function save() {
    setBusy(true);
    try {
      const result = await api.updateCourseTimeSettings(courseId, zone || null);
      setSaved(result.courseTimeZone ?? ""); setZone(result.courseTimeZone ?? ""); setSettings(result);
      notifications.success(t("timeSettings.saved"));
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.settingsSaveError"));
      throw err;
    } finally { setBusy(false); }
  }
  useUnsavedChangesGuard({ isDirty, onSave: save, onDiscard: discard });
  return <section className="section stack" aria-labelledby="course-time-heading">
    <h2 id="course-time-heading">{t("timeSettings.title")}</h2>
    <form id="course-time-settings" className="form" onSubmit={(event) => { event.preventDefault(); void save().catch(() => {}); }}>
      <div className="field">
        <label htmlFor="course-time-zone">{t("timeSettings.courseZone")}</label>
        <select id="course-time-zone" disabled={busy} value={zone} onChange={(event) => setZone(event.target.value)}>
          <option value="">{t("timeSettings.inheritZone", { zone: settings.applicationTimeZone })}</option>
          {settings.timeZones.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <p className="muted">{t("timeSettings.courseHelp")}</p>
        <p className="muted">{t("timeSettings.reloadHelp")}</p>
      </div>
      <EditActionBar form="course-time-settings" isDirty={isDirty} isSaving={busy} savedLabel={copy.saved} unsavedLabel={copy.unsaved} saveLabel={copy.save} savingLabel={copy.saving} cancelLabel={copy.cancel} onCancel={discard} />
    </form>
  </section>;
}
