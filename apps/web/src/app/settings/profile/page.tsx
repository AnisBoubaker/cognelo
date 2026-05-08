"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ProfileSettingsPage() {
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const notifications = useNotifications();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    setFirstName(user.firstName ?? firstNameFromName(user.name));
    setLastName(user.lastName ?? lastNameFromName(user.name));
  }, [user]);

  const roles = useMemo(() => user?.roles.map((role) => t(`roles.${role}`)).join(", ") ?? "", [t, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.updateMyProfile({ firstName, lastName });
      await refresh();
      notifications.success(t("settings.profileSaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.profileSaveError");
      setError(message);
      notifications.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{t("settings.eyebrow")}</p>
            <h1>{t("settings.title")}</h1>
            <p className="muted">{t("settings.subtitle")}</p>
          </div>
        </section>

        <div className="settings-layout">
          <aside className="settings-nav" aria-label={t("settings.navLabel")}>
            <Link aria-current="page" className="is-active" href="/settings/profile">
              <span>{t("settings.profileNav")}</span>
              <small>{t("settings.profileNavText")}</small>
            </Link>
          </aside>

          <section className="section stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("settings.profileEyebrow")}</p>
                <h2>{t("settings.profileTitle")}</h2>
              </div>
            </div>

            <form className="form" onSubmit={handleSubmit}>
              <div className="form-grid-two">
                <div className="field">
                  <label htmlFor="firstName">{t("settings.firstName")}</label>
                  <input
                    id="firstName"
                    maxLength={120}
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="lastName">{t("settings.lastName")}</label>
                  <input
                    id="lastName"
                    maxLength={120}
                    required
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

              {error ? <p className="error">{error}</p> : null}

              <div className="row">
                <button disabled={saving} type="submit">
                  {saving ? t("common.saving") : t("settings.saveProfile")}
                </button>
              </div>
            </form>
          </section>
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
