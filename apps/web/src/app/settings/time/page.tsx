"use client";
import { useEffect, useState } from "react";
import { EditActionBar, getEditActionBarCopy, useApplicationTime, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { AppShell } from "@/components/app-shell";
import { SettingsNav } from "@/components/settings-nav";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function TimeSettingsPage() {
  const { user } = useAuth();
  const { timeZone: activeZone, setTimeZone } = useApplicationTime();
  const { t, locale } = useI18n();
  const { success } = useNotifications();
  const [zone, setZone] = useState(activeZone);
  const [saved, setSaved] = useState(activeZone);
  const [choices, setChoices] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = user?.roles.includes("admin");
  const isDirty = zone !== saved;
  const copy = getEditActionBarCopy(locale);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    api.applicationTimeSettings().then((result) => { if (active) { setZone(result.timeZone); setSaved(result.timeZone); setChoices(result.timeZones); } }).catch((err) => { if (active) setError(err instanceof Error ? err.message : t("timeSettings.loadError")); });
    return () => { active = false; };
  }, [isAdmin, t]);
  const discard = () => { setZone(saved); setError(""); };
  async function save() {
    setBusy(true); setError("");
    try {
      const result = await api.updateApplicationTimeSettings(zone);
      setSaved(result.timeZone); setZone(result.timeZone); setTimeZone?.(result.timeZone); success(t("timeSettings.saved"));
    } catch (err) { setError(err instanceof Error ? err.message : t("timeSettings.loadError")); throw err; }
    finally { setBusy(false); }
  }
  useUnsavedChangesGuard({ isDirty, onSave: save, onDiscard: discard });
  return <AppShell><main className="page settings-layout"><SettingsNav /><section className="section stack">
    <h1 className="section-title">{t("timeSettings.title")}</h1>
    {!isAdmin ? <p>{t("timeSettings.adminOnly")}</p> : <>
      <p className="muted">{t("timeSettings.help")}</p>
      <form id="application-time-settings" className="form" onSubmit={(event) => { event.preventDefault(); void save().catch(() => {}); }}>
        <div className="field"><label htmlFor="application-time-zone">{t("timeSettings.zone")}</label><select id="application-time-zone" value={zone} disabled={busy || !choices.length} onChange={(event) => setZone(event.target.value)}>{choices.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
        <p className="muted">{t("timeSettings.reloadHelp")}</p>
        {error ? <p className="error" role="alert">{error}</p> : null}
      </form>
      <EditActionBar form="application-time-settings" isDirty={isDirty} isSaving={busy} savedLabel={copy.saved} unsavedLabel={copy.unsaved} saveLabel={copy.save} savingLabel={copy.saving} cancelLabel={copy.cancel} onCancel={discard} saveDisabled={!choices.includes(zone)} />
    </>}
  </section></main></AppShell>;
}
