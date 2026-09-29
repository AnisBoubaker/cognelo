"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EditActionBar, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { ExecutionRunnerConfigurationInput, ExecutionRunnerType } from "@cognelo/contracts";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SettingsNav } from "@/components/settings-nav";
import {
  api,
  type ExecutionRunnerCapabilityResult,
  type ExecutionRunnerConfiguration
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const runnerTypes: ExecutionRunnerType[] = ["judge0", "web_design", "sagemath"];

type RunnerForm = {
  displayName: string;
  baseUrl: string;
  authHeader: string;
  authToken: string;
  isEnabled: boolean;
  enablePerProcessAndThreadLimits: boolean;
};

type RunnerForms = Record<ExecutionRunnerType, RunnerForm>;

const emptyForms: RunnerForms = {
  judge0: emptyRunner("Judge0", "X-Auth-Token"),
  web_design: emptyRunner("Web Design runner"),
  sagemath: emptyRunner("SageMath runner")
};

export default function RunnerSettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const notifications = useNotifications();
  const isAdmin = user?.roles.includes("admin") ?? false;
  const [forms, setForms] = useState<RunnerForms>(emptyForms);
  const [savedForms, setSavedForms] = useState<RunnerForms>(emptyForms);
  const [configurations, setConfigurations] = useState<ExecutionRunnerConfiguration[]>([]);
  const [capabilityResults, setCapabilityResults] = useState<Partial<Record<ExecutionRunnerType, ExecutionRunnerCapabilityResult[]>>>({});
  const [testing, setTesting] = useState<ExecutionRunnerType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isDirty = useMemo(() => JSON.stringify(forms) !== JSON.stringify(savedForms), [forms, savedForms]);

  const applyConfigurations = useCallback((next: ExecutionRunnerConfiguration[]) => {
    const nextForms = { ...emptyForms };
    for (const configuration of next) {
      nextForms[configuration.runnerType] = formFromConfiguration(configuration);
    }
    setConfigurations(next);
    setForms(nextForms);
    setSavedForms(nextForms);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    api.executionRunnerConfigurations()
      .then(({ configurations: next }) => applyConfigurations(next))
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("settings.runnersLoadError")))
      .finally(() => setLoading(false));
  }, [applyConfigurations, isAdmin, t]);

  const saveConfigurations = useCallback(async () => {
    setError("");
    setSaving(true);
    try {
      const dirtyTypes = runnerTypes.filter((runnerType) => (
        JSON.stringify(forms[runnerType]) !== JSON.stringify(savedForms[runnerType])
      ));
      const updated = await Promise.all(dirtyTypes.map(async (runnerType) => {
        const form = forms[runnerType];
        const input: ExecutionRunnerConfigurationInput = {
          displayName: form.displayName,
          baseUrl: form.baseUrl,
          authHeader: form.authHeader,
          authToken: form.authToken,
          isEnabled: form.isEnabled,
          settings: { enablePerProcessAndThreadLimits: form.enablePerProcessAndThreadLimits }
        };
        return (await api.updateExecutionRunnerConfiguration(runnerType, input)).configuration;
      }));
      const merged = runnerTypes.map((runnerType) => (
        updated.find((configuration) => configuration.runnerType === runnerType)
        ?? configurations.find((configuration) => configuration.runnerType === runnerType)
      )).filter((configuration): configuration is ExecutionRunnerConfiguration => Boolean(configuration));
      applyConfigurations(merged);
      setCapabilityResults({});
      notifications.success(t("settings.runnersSaved"));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("settings.runnersSaveError");
      setError(message);
      notifications.error(message);
      throw caught;
    } finally {
      setSaving(false);
    }
  }, [applyConfigurations, configurations, forms, notifications, savedForms, t]);

  const discardChanges = useCallback(() => {
    setForms(savedForms);
    setError("");
  }, [savedForms]);

  useUnsavedChangesGuard(useMemo(() => ({
    isDirty,
    onSave: saveConfigurations,
    onDiscard: discardChanges
  }), [discardChanges, isDirty, saveConfigurations]));

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await saveConfigurations();
    } catch {
      // The form and notification already surface the failure.
    }
  }

  async function testRunner(runnerType: ExecutionRunnerType) {
    setError("");
    setTesting(runnerType);
    try {
      const result = await api.testExecutionRunnerConnection(runnerType);
      setCapabilityResults((current) => ({ ...current, [runnerType]: result.capabilities }));
      if (result.ok) notifications.success(t("settings.runnerTestSucceeded"));
      else notifications.error(t("settings.runnerTestMissingCapabilities"));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("settings.runnerTestError");
      setError(message);
      notifications.error(message);
    } finally {
      setTesting(null);
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
                <p className="eyebrow">{t("settings.runnersEyebrow")}</p>
                <h2>{t("settings.runnersTitle")}</h2>
                <p className="muted">{t("settings.runnersText")}</p>
              </div>
            </div>

            {!isAdmin ? <p className="muted">{t("settings.runnersAdminOnly")}</p> : null}
            {loading ? <p className="muted">{t("common.loading")}</p> : null}
            {error ? <p className="error">{error}</p> : null}

            {isAdmin && !loading ? (
              <form className="stack" onSubmit={handleSave}>
                {runnerTypes.map((runnerType) => {
                  const form = forms[runnerType];
                  const configuration = configurations.find((item) => item.runnerType === runnerType);
                  const canRetainToken = Boolean(
                    configuration?.configured &&
                    configuration.hasAuthToken &&
                    configuration.authHeader === form.authHeader
                  );
                  const runnerDirty = JSON.stringify(form) !== JSON.stringify(savedForms[runnerType]);
                  const results = capabilityResults[runnerType];
                  return (
                    <article className="card card-compact stack" key={runnerType}>
                      <div className="section-heading">
                        <div>
                          <h3>{runnerTitle(runnerType, t)}</h3>
                          <p className="muted">{runnerHelp(runnerType, t)}</p>
                        </div>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={form.isEnabled}
                            onChange={(event) => updateForm(setForms, runnerType, { isEnabled: event.target.checked })}
                          />
                          <span>{t("settings.runnerEnabled")}</span>
                        </label>
                      </div>

                      <div className="form-grid-two">
                        <div className="field">
                          <label htmlFor={`${runnerType}-name`}>{t("settings.runnerDisplayName")}</label>
                          <input
                            id={`${runnerType}-name`}
                            maxLength={160}
                            required
                            value={form.displayName}
                            onChange={(event) => updateForm(setForms, runnerType, { displayName: event.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`${runnerType}-url`}>{t("settings.runnerBaseUrl")}</label>
                          <input
                            id={`${runnerType}-url`}
                            maxLength={500}
                            placeholder={runnerPlaceholder(runnerType)}
                            required={Boolean(configuration?.configured || runnerDirty)}
                            type="url"
                            value={form.baseUrl}
                            onChange={(event) => updateForm(setForms, runnerType, { baseUrl: event.target.value })}
                          />
                        </div>
                      </div>

                      <div className="form-grid-two">
                        <div className="field">
                          <label htmlFor={`${runnerType}-auth-header`}>{t("settings.runnerAuthHeader")}</label>
                          <input
                            id={`${runnerType}-auth-header`}
                            maxLength={160}
                            value={form.authHeader}
                            onChange={(event) => updateForm(setForms, runnerType, { authHeader: event.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`${runnerType}-auth-token`}>{t("settings.runnerAuthToken")}</label>
                          <input
                            id={`${runnerType}-auth-token`}
                            maxLength={2000}
                            required={runnerDirty && Boolean(form.authHeader) && !canRetainToken}
                            type="password"
                            value={form.authToken}
                            onChange={(event) => updateForm(setForms, runnerType, { authToken: event.target.value })}
                          />
                          <p className="muted">{canRetainToken ? t("settings.runnerSecretSavedHelp") : t("settings.runnerAuthHelp")}</p>
                        </div>
                      </div>

                      {runnerType === "judge0" ? (
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={form.enablePerProcessAndThreadLimits}
                            onChange={(event) => updateForm(setForms, runnerType, { enablePerProcessAndThreadLimits: event.target.checked })}
                          />
                          <span>{t("settings.runnerJudge0ProcessLimits")}</span>
                        </label>
                      ) : null}

                      <div>
                        <button
                          className="button secondary"
                          type="button"
                          disabled={!configuration?.configured || runnerDirty || testing !== null}
                          onClick={() => void testRunner(runnerType)}
                        >
                          {testing === runnerType ? t("settings.runnerTesting") : t("settings.runnerTest")}
                        </button>
                        {!configuration?.configured || runnerDirty ? <p className="muted">{t("settings.runnerSaveBeforeTest")}</p> : null}
                      </div>

                      {results ? (
                        <div className="stack" aria-live="polite">
                          <h4>{t("settings.runnerCapabilities")}</h4>
                          <ul>
                            {results.map((result) => (
                              <li key={result.key}>
                                <strong>{result.ok ? "✓" : "✕"} {result.label}</strong> — {result.detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </article>
                  );
                })}

                <EditActionBar
                  isDirty={isDirty}
                  isSaving={saving}
                  savedLabel={t("common.savedStatus")}
                  unsavedLabel={t("common.unsavedStatus")}
                  saveLabel={t("settings.runnersSave")}
                  savingLabel={t("common.saving")}
                  cancelLabel={t("common.cancel")}
                  onCancel={discardChanges}
                  onSave={saveConfigurations}
                />
              </form>
            ) : null}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function emptyRunner(displayName: string, authHeader = ""): RunnerForm {
  return {
    displayName,
    baseUrl: "",
    authHeader,
    authToken: "",
    isEnabled: true,
    enablePerProcessAndThreadLimits: true
  };
}

function formFromConfiguration(configuration: ExecutionRunnerConfiguration): RunnerForm {
  return {
    displayName: configuration.displayName,
    baseUrl: configuration.baseUrl,
    authHeader: configuration.authHeader,
    authToken: "",
    isEnabled: configuration.isEnabled,
    enablePerProcessAndThreadLimits: configuration.settings.enablePerProcessAndThreadLimits
  };
}

function updateForm(
  setForms: React.Dispatch<React.SetStateAction<RunnerForms>>,
  runnerType: ExecutionRunnerType,
  update: Partial<RunnerForm>
) {
  setForms((current) => ({ ...current, [runnerType]: { ...current[runnerType], ...update } }));
}

function runnerTitle(runnerType: ExecutionRunnerType, t: (key: string) => string) {
  if (runnerType === "judge0") return t("settings.runnerJudge0Title");
  if (runnerType === "web_design") return t("settings.runnerWebDesignTitle");
  return t("settings.runnerSageMathTitle");
}

function runnerHelp(runnerType: ExecutionRunnerType, t: (key: string) => string) {
  if (runnerType === "judge0") return t("settings.runnerJudge0Help");
  if (runnerType === "web_design") return t("settings.runnerWebDesignHelp");
  return t("settings.runnerSageMathHelp");
}

function runnerPlaceholder(runnerType: ExecutionRunnerType) {
  if (runnerType === "judge0") return "http://runner.internal:2358";
  if (runnerType === "web_design") return "http://runner.internal:3456";
  return "http://runner.internal:3457";
}
