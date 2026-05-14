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
  const [selectedBackups, setSelectedBackups] = useState<Record<string, string>>({});
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

  async function activatePlugin(plugin: ActivityPluginInstallation) {
    setSavingKey(plugin.key);
    setError("");
    try {
      const result = await api.updateActivityPlugin(plugin.key, {
        action: "activate",
        restoreBackupId: selectedBackups[plugin.key] || null
      });
      setPlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? result.plugin : candidate)));
      notifications.success(t("settings.pluginActivated"));
      await loadPlugins();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.pluginSaveError");
      setError(message);
      notifications.error(message);
    } finally {
      setSavingKey("");
    }
  }

  async function deactivatePlugin(plugin: ActivityPluginInstallation) {
    setSavingKey(plugin.key);
    setError("");
    try {
      const result = await api.updateActivityPlugin(plugin.key, { action: "deactivate" });
      setPlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? result.plugin : candidate)));
      notifications.success(t("settings.pluginDeactivated"));
      await loadPlugins();
    } catch (err) {
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
                      <span className={`status-pill ${plugin.isActivated ? "is-enabled" : "is-neutral"}`}>
                        {plugin.isActivated ? t("settings.pluginActivatedBadge") : t("settings.pluginInactiveBadge")}
                      </span>
                      {plugin.isActivated ? (
                        <>
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
                          {!plugin.isEnabled ? (
                            <button className="secondary" disabled={savingKey === plugin.key} type="button" onClick={() => void deactivatePlugin(plugin)}>
                              {t("settings.pluginDeactivate")}
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <div className="plugin-activation-actions">
                          {plugin.tableBackups?.length ? (
                            <label className="field">
                              <span>{t("settings.pluginBackupLabel")}</span>
                              <select
                                value={selectedBackups[plugin.key] ?? ""}
                                onChange={(event) => setSelectedBackups((current) => ({ ...current, [plugin.key]: event.target.value }))}
                              >
                                <option value="">{t("settings.pluginNoBackup")}</option>
                                {plugin.tableBackups.map((backup) => (
                                  <option key={backup.id} value={backup.id}>
                                    {backup.pluginVersion} · {new Date(backup.createdAt).toLocaleString()}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          <button disabled={savingKey === plugin.key} type="button" onClick={() => void activatePlugin(plugin)}>
                            {t("settings.pluginActivate")}
                          </button>
                        </div>
                      )}
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
