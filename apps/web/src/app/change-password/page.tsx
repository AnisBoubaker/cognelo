"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useAuth } from "@/components/auth-provider";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getPrimaryLandingPath } from "@/lib/navigation";

export default function ForcedPasswordChangePage() {
  const { user, loading, logout, refresh } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.mustChangePassword) {
      router.replace(getPrimaryLandingPath(user));
    }
  }, [loading, router, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmNewPassword) {
      setError(t("settings.passwordMismatch"));
      return;
    }
    if (currentPassword === newPassword) {
      setError(t("settings.passwordReuse"));
      return;
    }
    setSaving(true);
    try {
      await api.changeMyPassword({ currentPassword, newPassword, confirmNewPassword });
      await refresh();
      if (user) router.replace(getPrimaryLandingPath(user));
    } catch (err) {
      setError(err instanceof ApiError && err.code === "CURRENT_PASSWORD_INCORRECT"
        ? t("settings.currentPasswordIncorrect")
        : err instanceof Error ? err.message : t("settings.passwordChangeError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || !user.mustChangePassword) {
    return <main className="page">{t("common.redirecting")}</main>;
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="stack">
          <div className="row">
            <button className="secondary" type="button" onClick={async () => { await logout(); router.replace("/login"); }}>{t("common.logout")}</button>
            <div style={{ flex: 1 }} />
            <LocaleSwitcher />
          </div>
          <div className="login-brand-block">
            <BrandLogo priority size="hero" />
            <h1>{t("settings.forcedPasswordChangeTitle")}</h1>
            <p className="muted">{t("settings.forcedPasswordChangeHelp")}</p>
          </div>
          <form className="form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="currentPassword">{t("settings.temporaryPassword")}</label>
              <input autoComplete="current-password" id="currentPassword" maxLength={200} minLength={8} required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="newPassword">{t("settings.newPassword")}</label>
              <input autoComplete="new-password" id="newPassword" maxLength={200} minLength={8} required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="confirmNewPassword">{t("settings.confirmNewPassword")}</label>
              <input autoComplete="new-password" id="confirmNewPassword" maxLength={200} minLength={8} required type="password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} />
            </div>
            <p className="muted">{t("settings.passwordRequirements")}</p>
            {error ? <p className="error" role="alert">{error}</p> : null}
            <button className="login-submit-button" disabled={saving} type="submit">{saving ? t("settings.changingPassword") : t("settings.changePassword")}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
