"use client";

import { useEffect, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SettingsNav } from "@/components/settings-nav";
import { api, type ActivityPluginInstallation } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function PluginSettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const notifications = useNotifications();
  const [plugins, setPlugins] = useState<ActivityPluginInstallation[]>([]);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.roles.includes("admin") ?? false;

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadPlugins().catch((err) => setError(err instanceof Error ? err.message : t("settings.pluginsLoadError")));
  }, [isAdmin]);

  async function loadPlugins() {
    setLoading(true);
    try {
      const result = await api.activityPlugins();
      setPlugins(result.plugins);
    } finally {
      setLoading(false);
    }
  }

  async function updatePlugin(plugin: ActivityPluginInstallation, isEnabled: boolean) {
    const previousPlugins = plugins;
    setPlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? { ...candidate, isEnabled } : candidate)));
    setSavingKey(plugin.key);
    setError("");
    try {
      const result = await api.updateActivityPlugin(plugin.key, { isEnabled });
      setPlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? result.plugin : candidate)));
      notifications.success(t("settings.pluginUpdated"));
    } catch (err) {
      setPlugins(previousPlugins);
      const message = err instanceof Error ? err.message : t("settings.pluginSaveError");
      setError(message);
      notifications.error(message);
    } finally {
      setSavingKey("");
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
          <SettingsNav />

          <section className="section stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("settings.pluginsEyebrow")}</p>
                <h2>{t("settings.pluginsTitle")}</h2>
              </div>
            </div>

            {isAdmin ? <p className="muted">{t("settings.pluginsHelp")}</p> : <p className="muted">{t("settings.pluginsAdminOnly")}</p>}
            {error ? <p className="error">{error}</p> : null}
            {loading ? <p className="muted">{t("common.loading")}</p> : null}

            {isAdmin && !loading ? (
              <div className="plugin-settings-list">
                {plugins.map((plugin) => (
                  <article className="card card-compact plugin-settings-row" key={plugin.key}>
                    <div className="table-main-stack">
                      <strong>{plugin.name}</strong>
                      <span className="table-meta">
                        {t("settings.pluginPackageLabel")}: {plugin.packageName}
                      </span>
                      <span className="table-meta">
                        {t("settings.pluginActivitiesLabel")}: {(plugin.metadata.activityTypeKeys ?? []).join(", ")}
                      </span>
                      <span className="table-meta">
                        {t("settings.pluginDatabaseLabel")}: {plugin.metadata.databaseNamespace ?? "-"}
                      </span>
                    </div>

                    <div className="plugin-settings-state">
                      <span className={`status-pill ${plugin.isEnabled ? "is-enabled" : "is-disabled"}`}>
                        {plugin.isEnabled ? t("settings.pluginEnabled") : t("settings.pluginDisabled")}
                      </span>
                      <label className="switch-control">
                        <input
                          checked={plugin.isEnabled}
                          disabled={savingKey === plugin.key}
                          type="checkbox"
                          onChange={(event) => void updatePlugin(plugin, event.target.checked)}
                        />
                        <span aria-hidden="true" />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
