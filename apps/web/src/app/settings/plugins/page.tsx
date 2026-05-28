"use client";

import { useEffect, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SettingsNav } from "@/components/settings-nav";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { api, type ActivityPluginInstallation, type ContentTypePluginInstallation } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type PluginKind = "activity" | "content";
type PluginInstallation = ActivityPluginInstallation | ContentTypePluginInstallation;
type PluginSettingsTab = "activity" | "content";

export default function PluginSettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const notifications = useNotifications();
  const [activityPlugins, setActivityPlugins] = useState<ActivityPluginInstallation[]>([]);
  const [contentTypePlugins, setContentTypePlugins] = useState<ContentTypePluginInstallation[]>([]);
  const [savingKey, setSavingKey] = useState<{ kind: PluginKind; key: string } | null>(null);
  const [selectedBackups, setSelectedBackups] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.roles.includes("admin") ?? false;
  const isSaving = (kind: PluginKind, key: string) => savingKey?.kind === kind && savingKey.key === key;

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
      const [activityResult, contentTypeResult] = await Promise.all([api.activityPlugins(), api.contentTypePlugins()]);
      setActivityPlugins(activityResult.plugins);
      setContentTypePlugins(contentTypeResult.plugins);
    } finally {
      setLoading(false);
    }
  }

  async function updatePlugin(kind: PluginKind, plugin: PluginInstallation, isEnabled: boolean) {
    const previousActivityPlugins = activityPlugins;
    const previousContentTypePlugins = contentTypePlugins;
    const updateLocal = (candidate: PluginInstallation) => (candidate.key === plugin.key ? { ...candidate, isEnabled } : candidate);
    if (kind === "activity") {
      setActivityPlugins((current) => current.map(updateLocal));
    } else {
      setContentTypePlugins((current) => current.map(updateLocal));
    }
    setSavingKey({ kind, key: plugin.key });
    setError("");
    try {
      const result =
        kind === "activity"
          ? await api.updateActivityPlugin(plugin.key, { isEnabled })
          : await api.updateContentTypePlugin(plugin.key, { isEnabled });
      if (kind === "activity") {
        setActivityPlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? result.plugin : candidate)));
      } else {
        setContentTypePlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? result.plugin : candidate)));
      }
      notifications.success(t("settings.pluginUpdated"));
    } catch (err) {
      setActivityPlugins(previousActivityPlugins);
      setContentTypePlugins(previousContentTypePlugins);
      const message = err instanceof Error ? err.message : t("settings.pluginSaveError");
      setError(message);
      notifications.error(message);
    } finally {
      setSavingKey(null);
    }
  }

  async function activatePlugin(kind: PluginKind, plugin: PluginInstallation) {
    setSavingKey({ kind, key: plugin.key });
    setError("");
    try {
      const input = { action: "activate" as const, restoreBackupId: selectedBackups[backupSelectionKey(kind, plugin.key)] || null };
      const result = kind === "activity" ? await api.updateActivityPlugin(plugin.key, input) : await api.updateContentTypePlugin(plugin.key, input);
      if (kind === "activity") {
        setActivityPlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? result.plugin : candidate)));
      } else {
        setContentTypePlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? result.plugin : candidate)));
      }
      notifications.success(t("settings.pluginActivated"));
      await loadPlugins();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.pluginSaveError");
      setError(message);
      notifications.error(message);
    } finally {
      setSavingKey(null);
    }
  }

  async function deactivatePlugin(kind: PluginKind, plugin: PluginInstallation) {
    setSavingKey({ kind, key: plugin.key });
    setError("");
    try {
      const result =
        kind === "activity"
          ? await api.updateActivityPlugin(plugin.key, { action: "deactivate" })
          : await api.updateContentTypePlugin(plugin.key, { action: "deactivate" });
      if (kind === "activity") {
        setActivityPlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? result.plugin : candidate)));
      } else {
        setContentTypePlugins((current) => current.map((candidate) => (candidate.key === plugin.key ? result.plugin : candidate)));
      }
      notifications.success(t("settings.pluginDeactivated"));
      await loadPlugins();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.pluginSaveError");
      setError(message);
      notifications.error(message);
    } finally {
      setSavingKey(null);
    }
  }

  function backupSelectionKey(kind: PluginKind, pluginKey: string) {
    return `${kind}:${pluginKey}`;
  }

  function pluginTypeKeys(plugin: PluginInstallation) {
    const keys = "activityTypeKeys" in plugin.metadata ? plugin.metadata.activityTypeKeys : plugin.metadata.contentTypeKeys;
    return Array.isArray(keys) ? keys.join(", ") : "";
  }

  function renderPluginList(kind: PluginKind, plugins: PluginInstallation[]) {
    const typeLabelKey = kind === "activity" ? "settings.pluginActivitiesLabel" : "settings.pluginContentTypesLabel";

    return (
      <div className="plugin-settings-list">
        {plugins.map((plugin) => {
          const selectionKey = backupSelectionKey(kind, plugin.key);
          return (
            <article className="card card-compact plugin-settings-row" key={plugin.key}>
              <div className="table-main-stack">
                <strong>{plugin.name}</strong>
                <span className="table-meta">
                  {t("settings.pluginPackageLabel")}: {plugin.packageName}
                </span>
                <span className="table-meta">
                  {t(typeLabelKey)}: {pluginTypeKeys(plugin)}
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
                        disabled={isSaving(kind, plugin.key)}
                        type="checkbox"
                        onChange={(event) => void updatePlugin(kind, plugin, event.target.checked)}
                      />
                      <span aria-hidden="true" />
                    </label>
                    {!plugin.isEnabled ? (
                      <button className="secondary" disabled={isSaving(kind, plugin.key)} type="button" onClick={() => void deactivatePlugin(kind, plugin)}>
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
                          value={selectedBackups[selectionKey] ?? ""}
                          onChange={(event) => setSelectedBackups((current) => ({ ...current, [selectionKey]: event.target.value }))}
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
                    <button disabled={isSaving(kind, plugin.key)} type="button" onClick={() => void activatePlugin(kind, plugin)}>
                      {t("settings.pluginActivate")}
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
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
              <WorkspaceTabs<PluginSettingsTab>
                ariaLabel={t("settings.pluginsTabsLabel")}
                initialTab="activity"
                tabs={[
                  {
                    id: "activity",
                    label: t("settings.activityPluginsTitle"),
                    render: () => (
                      <div className="stack">
                        <div className="section-heading">
                          <div>
                            <p className="eyebrow">{t("settings.activityPluginsEyebrow")}</p>
                            <h3>{t("settings.activityPluginsTitle")}</h3>
                          </div>
                        </div>
                        <p className="muted">{t("settings.activityPluginsHelp")}</p>
                        {renderPluginList("activity", activityPlugins)}
                      </div>
                    )
                  },
                  {
                    id: "content",
                    label: t("settings.contentTypePluginsTitle"),
                    render: () => (
                      <div className="stack">
                        <div className="section-heading">
                          <div>
                            <p className="eyebrow">{t("settings.contentTypePluginsEyebrow")}</p>
                            <h3>{t("settings.contentTypePluginsTitle")}</h3>
                          </div>
                        </div>
                        <p className="muted">{t("settings.contentTypePluginsHelp")}</p>
                        {renderPluginList("content", contentTypePlugins)}
                      </div>
                    )
                  }
                ]}
              />
            ) : null}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
