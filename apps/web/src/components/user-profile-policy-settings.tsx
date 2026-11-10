"use client";

import { useCallback, useEffect, useState } from "react";
import { EditActionBar, ToggleSwitch, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function UserProfilePolicySettings() {
  const { t, locale } = useI18n();
  const notifications = useNotifications();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.userProfilePolicy().then(policy => {
      if (active) { setAllowed(policy.allowUserNameChanges); setSaved(policy.allowUserNameChanges); }
    }).catch(error => { if (active) notifications.error(error instanceof Error ? error.message : t("settings.namePolicyLoadError")); });
    return () => { active = false; };
  }, [notifications, t]);

  const discard = useCallback(() => setAllowed(saved), [saved]);
  const save = useCallback(async () => {
    if (allowed === null) return;
    setSaving(true);
    try {
      const policy = await api.updateUserProfilePolicy({ allowUserNameChanges: allowed });
      setAllowed(policy.allowUserNameChanges);
      setSaved(policy.allowUserNameChanges);
      notifications.success(t("settings.namePolicySaved"));
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : t("settings.namePolicySaveError"));
      throw error;
    } finally { setSaving(false); }
  }, [allowed, notifications, t]);
  const isDirty = allowed !== null && allowed !== saved;
  useUnsavedChangesGuard({ isDirty, onSave: save, onDiscard: discard });

  return <section className="inline-panel stack" aria-label={t("settings.namePolicyTitle")}>
    <ToggleSwitch
      label={t("settings.allowUserNameChanges")}
      help={t("settings.namePolicyHelp")}
      locale={locale}
      checked={allowed === true}
      disabled={allowed === null || saving}
      onChange={setAllowed}
    />
    <EditActionBar
      isDirty={isDirty} isSaving={saving} saveDisabled={allowed === null}
      savedLabel={t("common.savedStatus")} unsavedLabel={t("common.unsavedStatus")}
      saveLabel={t("common.save")} savingLabel={t("common.saving")} cancelLabel={t("common.cancel")}
      onCancel={discard} onSave={save}
    />
  </section>;
}
