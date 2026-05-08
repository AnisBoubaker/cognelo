"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SettingsNav } from "@/components/settings-nav";
import { api, type AiAgentConnection } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const providers = ["ollama", "openai", "codex", "claude"] as const;

type FormState = {
  id: string | null;
  displayName: string;
  provider: (typeof providers)[number];
  model: string;
  baseUrl: string;
  apiKey: string;
  scope: "personal" | "global";
  isEnabled: boolean;
};

const emptyForm: FormState = {
  id: null,
  displayName: "",
  provider: "ollama",
  model: "",
  baseUrl: "",
  apiKey: "",
  scope: "personal",
  isEnabled: true
};

export default function AiAgentSettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const notifications = useNotifications();
  const [connections, setConnections] = useState<AiAgentConnection[]>([]);
  const [questionAuthoringAgentId, setQuestionAuthoringAgentId] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.roles.includes("admin") ?? false;
  const personalConnections = connections.filter((connection) => connection.scope === "personal");
  const globalConnections = connections.filter((connection) => connection.scope === "global");

  const formTitle = useMemo(() => (form.id ? t("settings.aiAgentEditTitle") : t("settings.aiAgentNewTitle")), [form.id, t]);

  useEffect(() => {
    loadConnections().catch((err) => setError(err instanceof Error ? err.message : t("settings.aiAgentsLoadError")));
  }, []);

  async function loadConnections() {
    setLoading(true);
    try {
      const result = await api.aiAgentConnections();
      setConnections(result.connections);
      setQuestionAuthoringAgentId(result.preferences.questionAuthoringAiAgentConnectionId ?? "");
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await api.updateAiAgentPreferences({
        questionAuthoringAiAgentConnectionId: questionAuthoringAgentId || null
      });
      setQuestionAuthoringAgentId(result.preferences.questionAuthoringAiAgentConnectionId ?? "");
      notifications.success(t("settings.aiAgentPreferencesSaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.aiAgentPreferencesSaveError");
      setError(message);
      notifications.error(message);
    } finally {
      setSaving(false);
    }
  }

  function editConnection(connection: AiAgentConnection) {
    setError("");
    setForm({
      id: connection.id,
      displayName: connection.displayName,
      provider: connection.provider,
      model: connection.model,
      baseUrl: connection.baseUrl ?? "",
      apiKey: "",
      scope: connection.scope,
      isEnabled: connection.isEnabled
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const input = {
        displayName: form.displayName,
        provider: form.provider,
        model: form.model,
        baseUrl: form.baseUrl || null,
        ...(form.apiKey || !form.id ? { apiKey: form.apiKey || null } : {}),
        scope: form.scope,
        isEnabled: form.isEnabled
      };
      if (form.id) {
        await api.updateAiAgentConnection(form.id, input);
        notifications.success(t("settings.aiAgentUpdated"));
      } else {
        await api.createAiAgentConnection(input);
        notifications.success(t("settings.aiAgentCreated"));
      }
      setForm(emptyForm);
      await loadConnections();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.aiAgentSaveError");
      setError(message);
      notifications.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteConnection(connection: AiAgentConnection) {
    if (!window.confirm(t("settings.aiAgentDeleteConfirm", { name: connection.displayName }))) {
      return;
    }
    setError("");
    try {
      await api.deleteAiAgentConnection(connection.id);
      notifications.success(t("settings.aiAgentDeleted"));
      if (form.id === connection.id) {
        setForm(emptyForm);
      }
      await loadConnections();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.aiAgentDeleteError");
      setError(message);
      notifications.error(message);
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

          <div className="stack">
            <section className="section stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("settings.aiAgentsEyebrow")}</p>
                  <h2>{t("settings.aiAgentsTitle")}</h2>
                </div>
              </div>

              {error ? <p className="error">{error}</p> : null}
              {loading ? <p className="muted">{t("common.loading")}</p> : null}

              <form className="inline-panel form" onSubmit={savePreferences}>
                <div className="field">
                  <label htmlFor="questionAuthoringAgent">{t("settings.questionAuthoringAgent")}</label>
                  <select
                    id="questionAuthoringAgent"
                    value={questionAuthoringAgentId}
                    onChange={(event) => setQuestionAuthoringAgentId(event.target.value)}
                  >
                    <option value="">{t("settings.noAiAgentSelected")}</option>
                    {connections
                      .filter((connection) => connection.isEnabled)
                      .map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {formatAiAgentOption(connection, t)}
                        </option>
                      ))}
                  </select>
                  <p className="muted">{t("settings.questionAuthoringAgentHelp")}</p>
                </div>
                <div className="row">
                  <button disabled={saving} type="submit">
                    {saving ? t("common.saving") : t("settings.saveAiAgentPreferences")}
                  </button>
                </div>
              </form>

              <div className="grid">
                <AgentList
                  connections={personalConnections}
                  emptyText={t("settings.aiAgentsPersonalEmpty")}
                  title={t("settings.aiAgentsPersonalTitle")}
                  canEdit
                  onDelete={deleteConnection}
                  onEdit={editConnection}
                  t={t}
                />
                <AgentList
                  connections={globalConnections}
                  emptyText={t("settings.aiAgentsGlobalEmpty")}
                  title={t("settings.aiAgentsGlobalTitle")}
                  canEdit={isAdmin}
                  onDelete={deleteConnection}
                  onEdit={editConnection}
                  t={t}
                />
              </div>
            </section>

            <section className="section stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("settings.aiAgentFormEyebrow")}</p>
                  <h2>{formTitle}</h2>
                </div>
                {form.id ? (
                  <button className="secondary" type="button" onClick={() => setForm(emptyForm)}>
                    {t("settings.aiAgentNew")}
                  </button>
                ) : null}
              </div>

              <form className="form" onSubmit={handleSubmit}>
                <div className="form-grid-two">
                  <div className="field">
                    <label htmlFor="displayName">{t("settings.aiAgentDisplayName")}</label>
                    <input
                      id="displayName"
                      maxLength={160}
                      required
                      value={form.displayName}
                      onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="provider">{t("settings.aiAgentProvider")}</label>
                    <select
                      id="provider"
                      value={form.provider}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, provider: event.target.value as FormState["provider"] }))
                      }
                    >
                      {providers.map((provider) => (
                        <option key={provider} value={provider}>
                          {t(`aiAgentProviders.${provider}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid-two">
                  <div className="field">
                    <label htmlFor="model">{t("settings.aiAgentModel")}</label>
                    <input
                      id="model"
                      maxLength={160}
                      required
                      value={form.model}
                      onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="baseUrl">{t("settings.aiAgentBaseUrl")}</label>
                    <input
                      id="baseUrl"
                      maxLength={500}
                      type="url"
                      value={form.baseUrl}
                      onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-grid-two">
                  <div className="field">
                    <label htmlFor="apiKey">{t("settings.aiAgentApiKey")}</label>
                    <input
                      id="apiKey"
                      autoComplete="off"
                      maxLength={2000}
                      type="password"
                      value={form.apiKey}
                      onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="scope">{t("settings.aiAgentScope")}</label>
                    <select
                      id="scope"
                      disabled={!isAdmin}
                      value={form.scope}
                      onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value as FormState["scope"] }))}
                    >
                      <option value="personal">{t("settings.aiAgentScopePersonal")}</option>
                      {isAdmin ? <option value="global">{t("settings.aiAgentScopeGlobal")}</option> : null}
                    </select>
                  </div>
                </div>

                <label className="checkbox-row">
                  <input
                    checked={form.isEnabled}
                    type="checkbox"
                    onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))}
                  />
                  <span>{t("settings.aiAgentEnabled")}</span>
                </label>

                <div className="row">
                  <button disabled={saving} type="submit">
                    {saving ? t("common.saving") : t("settings.aiAgentSave")}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function formatAiAgentOption(connection: AiAgentConnection, t: (key: string, values?: Record<string, string | number>) => string) {
  const scope = connection.scope === "global" ? t("settings.aiAgentScopeGlobal") : t("settings.aiAgentScopePersonal");
  return `${connection.displayName} · ${t(`aiAgentProviders.${connection.provider}`)} · ${connection.model} · ${scope}`;
}

function AgentList({
  connections,
  emptyText,
  title,
  canEdit,
  onDelete,
  onEdit,
  t
}: {
  connections: AiAgentConnection[];
  emptyText: string;
  title: string;
  canEdit: boolean;
  onDelete: (connection: AiAgentConnection) => void;
  onEdit: (connection: AiAgentConnection) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <article className="card card-compact ai-agent-list">
      <div className="section-heading">
        <h3>{title}</h3>
      </div>
      {connections.length ? (
        <div className="stack">
          {connections.map((connection) => (
            <div key={connection.id} className="ai-agent-row">
              <div className="table-main-stack">
                <strong>{connection.displayName}</strong>
                <span className="table-meta">
                  {t(`aiAgentProviders.${connection.provider}`)} · {connection.model}
                </span>
                <span className="table-meta">{connection.baseUrl || t("settings.aiAgentDefaultEndpoint")}</span>
              </div>
              <div className="row">
                <span className={`status-pill ${connection.isEnabled ? "is-enabled" : "is-disabled"}`}>
                  {connection.isEnabled ? t("settings.aiAgentEnabledBadge") : t("settings.aiAgentDisabledBadge")}
                </span>
                <span className={`status-pill ${connection.hasApiKey ? "is-enabled" : "is-neutral"}`}>
                  {connection.hasApiKey ? t("settings.aiAgentKeySaved") : t("settings.aiAgentNoKey")}
                </span>
              </div>
              {canEdit ? (
                <div className="table-actions">
                  <button className="secondary" type="button" onClick={() => onEdit(connection)}>
                    {t("common.edit")}
                  </button>
                  <button className="secondary" type="button" onClick={() => onDelete(connection)}>
                    {t("common.remove")}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">{emptyText}</p>
      )}
    </article>
  );
}
