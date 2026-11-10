"use client";
import { HelpLabel } from "@cognelo/activity-ui";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EditActionBar, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SettingsNav } from "@/components/settings-nav";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ProfileSettingsPage() {
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const notifications = useNotifications();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState({ firstName: "", lastName: "" });
  const [allowUserNameChanges, setAllowUserNameChanges] = useState<boolean | null>(null);
  const isAdmin = user?.roles.includes("admin") ?? false;
  const canChangeName = isAdmin || allowUserNameChanges === true;
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user?.id || isAdmin) return;
    let active = true;
    api.userProfilePolicy().then(policy => {
      if (active) setAllowUserNameChanges(policy.allowUserNameChanges);
    }).catch(err => { if (active) notifications.error(err instanceof Error ? err.message : t("settings.namePolicyLoadError")); });
    return () => { active = false; };
  }, [user?.id, isAdmin, notifications, t]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const nextSnapshot = {
      firstName: user.firstName ?? firstNameFromName(user.name),
      lastName: user.lastName ?? lastNameFromName(user.name)
    };
    setFirstName(nextSnapshot.firstName);
    setLastName(nextSnapshot.lastName);
    setSavedSnapshot(nextSnapshot);
  }, [user]);

  const roles = useMemo(() => user?.roles.map((role) => t(`roles.${role}`)).join(", ") ?? "", [t, user]);

  const currentSnapshot = useMemo(() => ({ firstName, lastName }), [firstName, lastName]);
  const hasUnsavedChanges = canChangeName && (currentSnapshot.firstName !== savedSnapshot.firstName || currentSnapshot.lastName !== savedSnapshot.lastName);

  const discardChanges = useCallback(() => {
    setFirstName(savedSnapshot.firstName);
    setLastName(savedSnapshot.lastName);
  }, [savedSnapshot]);

  const saveProfile = useCallback(async () => {
    if (!canChangeName) return;
    setSaving(true);
    try {
      await api.updateMyProfile({ firstName, lastName });
      await refresh();
      setSavedSnapshot({ firstName, lastName });
      notifications.success(t("settings.profileSaved"));
    } catch (err) {
      const nameLocked = err instanceof ApiError && err.code === "USER_NAME_CHANGES_DISABLED";
      const message = nameLocked ? t("settings.nameChangesLocked") : err instanceof Error ? err.message : t("settings.profileSaveError");
      if (nameLocked) {
        setAllowUserNameChanges(false);
        setFirstName(savedSnapshot.firstName);
        setLastName(savedSnapshot.lastName);
      }
      notifications.error(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canChangeName, firstName, lastName, notifications, refresh, savedSnapshot, t]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedChanges,
        onSave: saveProfile,
        onDiscard: discardChanges
      }),
      [discardChanges, hasUnsavedChanges, saveProfile]
    )
  );

  const hasUnsavedPassword = Boolean(currentPassword || newPassword || confirmNewPassword);
  const discardPassword = useCallback(() => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordError("");
  }, []);
  const savePassword = useCallback(async () => {
    setPasswordError("");
    if (newPassword !== confirmNewPassword) {
      const message = t("settings.passwordMismatch");
      setPasswordError(message);
      notifications.error(message);
      throw new Error(message);
    }
    if (currentPassword === newPassword) {
      const message = t("settings.passwordReuse");
      setPasswordError(message);
      notifications.error(message);
      throw new Error(message);
    }

    setChangingPassword(true);
    try {
      await api.changeMyPassword({ currentPassword, newPassword, confirmNewPassword });
      discardPassword();
      notifications.success(t("settings.passwordChanged"));
    } catch (err) {
      const message = err instanceof ApiError && err.code === "CURRENT_PASSWORD_INCORRECT"
        ? t("settings.currentPasswordIncorrect")
        : err instanceof Error
          ? err.message
          : t("settings.passwordChangeError");
      setPasswordError(message);
      notifications.error(message);
      throw err;
    } finally {
      setChangingPassword(false);
    }
  }, [confirmNewPassword, currentPassword, discardPassword, newPassword, notifications, t]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedPassword,
        onSave: savePassword,
        onDiscard: discardPassword
      }),
      [discardPassword, hasUnsavedPassword, savePassword]
    )
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await saveProfile(); } catch { /* Shared notifications report the error. */ }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await savePassword();
    } catch {
      // The form and shared notification surface already show the error.
    }
  }

  return (
    <AppShell>
      <main className="page stack">
        <div className="settings-layout">
          <SettingsNav />

          <div className="stack">
            <section className="section stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("settings.profileEyebrow")}</p>
                  <HelpLabel help={!isAdmin && allowUserNameChanges === false ? t("settings.nameChangesLocked") : undefined}><h1 className="content-title">{t("settings.profileTitle")}</h1></HelpLabel>
                </div>
              </div>

              <form className="form" onSubmit={handleSubmit}>
                <div className="form-grid-two">
                  <div className={canChangeName ? "field" : "field field-locked"}>
                    <label htmlFor="firstName">{t("settings.firstName")}</label>
                    <input
                      id="firstName"
                      maxLength={120}
                      required
                      readOnly={!canChangeName}
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </div>
                  <div className={canChangeName ? "field" : "field field-locked"}>
                    <label htmlFor="lastName">{t("settings.lastName")}</label>
                    <input
                      id="lastName"
                      maxLength={120}
                      required
                      readOnly={!canChangeName}
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </div>
                </div>

                <div className="field field-locked">
                  <label htmlFor="email">{t("settings.email")}</label>
                  <input id="email" readOnly value={user?.email ?? ""} />
                  <p className="muted">{t("settings.emailLocked")}</p>
                </div>

                <div className="field">
                  <label htmlFor="roles">{t("settings.roles")}</label>
                  <input id="roles" readOnly value={roles} />
                </div>

                {canChangeName ? <EditActionBar
                  isDirty={hasUnsavedChanges}
                  isSaving={saving}
                  savedLabel={t("common.savedStatus")}
                  unsavedLabel={t("common.unsavedStatus")}
                  saveLabel={t("settings.saveProfile")}
                  savingLabel={t("common.saving")}
                  cancelLabel={t("common.cancel")}
                  onCancel={discardChanges}
                  onSave={saveProfile}
                /> : null}
              </form>
            </section>

            <section className="section stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("settings.passwordEyebrow")}</p>
                  <HelpLabel help={<>{t("settings.passwordHelp")}</>}><h2>{t("settings.passwordTitle")}</h2></HelpLabel>

                </div>
              </div>

              <form className="form" onSubmit={handlePasswordSubmit}>
                <div className="field">
                  <label htmlFor="currentPassword">{t("settings.currentPassword")}</label>
                  <input
                    autoComplete="current-password"
                    id="currentPassword"
                    maxLength={200}
                    minLength={8}
                    required
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </div>

                <div className="form-grid-two">
                  <div className="field">
                    <label htmlFor="newPassword">{t("settings.newPassword")}</label>
                    <input
                      autoComplete="new-password"
                      id="newPassword"
                      maxLength={200}
                      minLength={8}
                      required
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="confirmNewPassword">{t("settings.confirmNewPassword")}</label>
                    <input
                      autoComplete="new-password"
                      id="confirmNewPassword"
                      maxLength={200}
                      minLength={8}
                      required
                      type="password"
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                    />
                  </div>
                </div>
                <p className="muted">{t("settings.passwordRequirements")}</p>

                {passwordError ? <p className="error" role="alert">{passwordError}</p> : null}

                <EditActionBar
                  isDirty={hasUnsavedPassword}
                  isSaving={changingPassword}
                  savedLabel={t("common.savedStatus")}
                  unsavedLabel={t("common.unsavedStatus")}
                  saveLabel={t("settings.changePassword")}
                  savingLabel={t("settings.changingPassword")}
                  cancelLabel={t("common.cancel")}
                  onCancel={discardPassword}
                  onSave={savePassword}
                />
              </form>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function firstNameFromName(name: string | null) {
  const trimmed = name?.trim() ?? "";
  return trimmed.split(/\s+/)[0] ?? "";
}

function lastNameFromName(name: string | null) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed.includes(" ")) {
    return "";
  }
  return trimmed.split(/\s+/).slice(1).join(" ");
}
