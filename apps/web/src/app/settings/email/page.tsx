"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EditActionBar, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { EmailDeliveryConfigurationInput } from "@cognelo/contracts";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SettingsNav } from "@/components/settings-nav";
import { api, type EmailDeliveryConfiguration } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type FormState = Omit<EmailDeliveryConfiguration, "configured" | "updatedAt" | "hasSmtpPassword" | "hasGraphClientSecret"> & {
  smtpPassword: string;
  graphClientSecret: string;
};

const emptyForm: FormState = {
  transport: "smtp",
  fromName: "Cognelo",
  fromEmail: "",
  smtpHost: "",
  smtpPort: 587,
  smtpSecurity: "starttls",
  smtpUsername: "",
  smtpPassword: "",
  graphTenantId: "",
  graphClientId: "",
  graphClientSecret: ""
};

export default function EmailSettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const notifications = useNotifications();
  const isAdmin = user?.roles.includes("admin") ?? false;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [savedForm, setSavedForm] = useState<FormState>(emptyForm);
  const [configuration, setConfiguration] = useState<EmailDeliveryConfiguration | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);
  const canRetainSmtpPassword = Boolean(
    configuration?.configured &&
    configuration.transport === "smtp" &&
    configuration.hasSmtpPassword &&
    configuration.smtpUsername === form.smtpUsername
  );
  const canRetainGraphClientSecret = Boolean(
    configuration?.configured &&
    configuration.transport === "microsoft_graph" &&
    configuration.hasGraphClientSecret &&
    configuration.graphTenantId === form.graphTenantId &&
    configuration.graphClientId === form.graphClientId
  );

  const applyConfiguration = useCallback((next: EmailDeliveryConfiguration) => {
    const nextForm: FormState = {
      transport: next.transport,
      fromName: next.fromName,
      fromEmail: next.fromEmail,
      smtpHost: next.smtpHost,
      smtpPort: next.smtpPort,
      smtpSecurity: next.smtpSecurity,
      smtpUsername: next.smtpUsername,
      smtpPassword: "",
      graphTenantId: next.graphTenantId,
      graphClientId: next.graphClientId,
      graphClientSecret: ""
    };
    setConfiguration(next);
    setForm(nextForm);
    setSavedForm(nextForm);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    api.emailDeliveryConfiguration()
      .then(({ configuration: next }) => applyConfiguration(next))
      .catch((err) => setError(err instanceof Error ? err.message : t("settings.emailDeliveryLoadError")))
      .finally(() => setLoading(false));
  }, [applyConfiguration, isAdmin, t]);

  const saveConfiguration = useCallback(async () => {
    setError("");
    setSaving(true);
    try {
      const common = { fromName: form.fromName, fromEmail: form.fromEmail };
      const input: EmailDeliveryConfigurationInput = form.transport === "smtp"
        ? {
            ...common,
            transport: "smtp",
            smtpHost: form.smtpHost,
            smtpPort: form.smtpPort,
            smtpSecurity: form.smtpSecurity,
            smtpUsername: form.smtpUsername,
            smtpPassword: form.smtpPassword
          }
        : {
            ...common,
            transport: "microsoft_graph",
            graphTenantId: form.graphTenantId,
            graphClientId: form.graphClientId,
            graphClientSecret: form.graphClientSecret
          };
      const result = await api.updateEmailDeliveryConfiguration(input);
      applyConfiguration(result.configuration);
      notifications.success(t("settings.emailDeliverySaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.emailDeliverySaveError");
      setError(message);
      notifications.error(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [applyConfiguration, form, notifications, t]);

  const discardChanges = useCallback(() => {
    setForm(savedForm);
    setError("");
  }, [savedForm]);

  useUnsavedChangesGuard(useMemo(() => ({ isDirty, onSave: saveConfiguration, onDiscard: discardChanges }), [discardChanges, isDirty, saveConfiguration]));

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await saveConfiguration();
    } catch {
      // The form and notification surface already display the failure.
    }
  }

  async function handleTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTesting(true);
    try {
      await api.sendEmailDeliveryTest({ recipientEmail });
      notifications.success(t("settings.emailTestSent", { email: recipientEmail }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.emailTestError");
      setError(message);
      notifications.error(message);
    } finally {
      setTesting(false);
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
                  <p className="eyebrow">{t("settings.emailDeliveryEyebrow")}</p>
                  <h2>{t("settings.emailDeliveryTitle")}</h2>
                </div>
              </div>

              {!isAdmin ? <p className="muted">{t("settings.emailDeliveryAdminOnly")}</p> : null}
              {loading ? <p className="muted">{t("common.loading")}</p> : null}
              {error ? <p className="error">{error}</p> : null}

              {isAdmin && !loading ? (
                <form className="form" onSubmit={handleSave}>
                  <div className="field">
                    <label htmlFor="emailTransport">{t("settings.emailTransport")}</label>
                    <select
                      id="emailTransport"
                      value={form.transport}
                      onChange={(event) => setForm((current) => ({ ...current, transport: event.target.value as FormState["transport"] }))}
                    >
                      <option value="smtp">{t("settings.emailTransportSmtp")}</option>
                      <option value="microsoft_graph">{t("settings.emailTransportMicrosoftGraph")}</option>
                    </select>
                    <p className="muted">{form.transport === "smtp" ? t("settings.emailTransportSmtpHelp") : t("settings.emailTransportMicrosoftGraphHelp")}</p>
                  </div>

                  <div className="form-grid-two">
                    <div className="field">
                      <label htmlFor="fromName">{t("settings.emailFromName")}</label>
                      <input id="fromName" maxLength={160} required value={form.fromName} onChange={(event) => setForm((current) => ({ ...current, fromName: event.target.value }))} />
                    </div>
                    <div className="field">
                      <label htmlFor="fromEmail">{t("settings.emailFromAddress")}</label>
                      <input id="fromEmail" maxLength={320} required type="email" value={form.fromEmail} onChange={(event) => setForm((current) => ({ ...current, fromEmail: event.target.value }))} />
                    </div>
                  </div>

                  {form.transport === "smtp" ? (
                    <>
                      <div className="form-grid-two">
                        <div className="field">
                          <label htmlFor="smtpHost">{t("settings.smtpHost")}</label>
                          <input id="smtpHost" maxLength={255} required value={form.smtpHost} onChange={(event) => setForm((current) => ({ ...current, smtpHost: event.target.value }))} />
                        </div>
                        <div className="field">
                          <label htmlFor="smtpPort">{t("settings.smtpPort")}</label>
                          <input id="smtpPort" max={65535} min={1} required type="number" value={form.smtpPort} onChange={(event) => setForm((current) => ({ ...current, smtpPort: Number(event.target.value) }))} />
                        </div>
                      </div>
                      <div className="form-grid-two">
                        <div className="field">
                          <label htmlFor="smtpSecurity">{t("settings.smtpSecurity")}</label>
                          <select id="smtpSecurity" value={form.smtpSecurity} onChange={(event) => setForm((current) => ({ ...current, smtpSecurity: event.target.value as FormState["smtpSecurity"] }))}>
                            <option value="starttls">{t("settings.smtpSecurityStarttls")}</option>
                            <option value="tls">{t("settings.smtpSecurityTls")}</option>
                            <option value="none">{t("settings.smtpSecurityNone")}</option>
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="smtpUsername">{t("settings.smtpUsername")}</label>
                          <input id="smtpUsername" maxLength={320} value={form.smtpUsername} onChange={(event) => setForm((current) => ({ ...current, smtpUsername: event.target.value }))} />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="smtpPassword">{t("settings.smtpPassword")}</label>
                        <input id="smtpPassword" maxLength={2000} required={Boolean(form.smtpUsername) && !canRetainSmtpPassword} type="password" value={form.smtpPassword} onChange={(event) => setForm((current) => ({ ...current, smtpPassword: event.target.value }))} />
                        <p className="muted">{canRetainSmtpPassword ? t("settings.emailSecretSavedHelp") : t("settings.smtpPasswordHelp")}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-grid-two">
                        <div className="field">
                          <label htmlFor="graphTenantId">{t("settings.graphTenantId")}</label>
                          <input id="graphTenantId" maxLength={255} required value={form.graphTenantId} onChange={(event) => setForm((current) => ({ ...current, graphTenantId: event.target.value }))} />
                        </div>
                        <div className="field">
                          <label htmlFor="graphClientId">{t("settings.graphClientId")}</label>
                          <input id="graphClientId" maxLength={255} required value={form.graphClientId} onChange={(event) => setForm((current) => ({ ...current, graphClientId: event.target.value }))} />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="graphClientSecret">{t("settings.graphClientSecret")}</label>
                        <input id="graphClientSecret" maxLength={2000} required={!canRetainGraphClientSecret} type="password" value={form.graphClientSecret} onChange={(event) => setForm((current) => ({ ...current, graphClientSecret: event.target.value }))} />
                        <p className="muted">{canRetainGraphClientSecret ? t("settings.emailSecretSavedHelp") : t("settings.graphClientSecretHelp")}</p>
                      </div>
                      <p className="muted">{t("settings.graphPermissionHelp")}</p>
                      <p className="muted">{t("settings.graphFromNameHelp")}</p>
                    </>
                  )}

                  <EditActionBar
                    isDirty={isDirty}
                    isSaving={saving}
                    savedLabel={t("common.savedStatus")}
                    unsavedLabel={t("common.unsavedStatus")}
                    saveLabel={t("settings.emailDeliverySave")}
                    savingLabel={t("common.saving")}
                    cancelLabel={t("common.cancel")}
                    onCancel={discardChanges}
                    onSave={saveConfiguration}
                  />
                </form>
              ) : null}
            </section>

            {isAdmin && !loading ? (
              <section className="section stack">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{t("settings.emailTestEyebrow")}</p>
                    <h2>{t("settings.emailTestTitle")}</h2>
                  </div>
                </div>
                <p className="muted">{t("settings.emailTestHelp")}</p>
                <form className="inline-panel form" onSubmit={handleTest}>
                  <div className="field">
                    <label htmlFor="testRecipientEmail">{t("settings.emailTestRecipient")}</label>
                    <input id="testRecipientEmail" maxLength={320} required type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} />
                  </div>
                  <div className="row">
                    <button disabled={testing || !configuration?.configured || isDirty} type="submit">
                      {testing ? t("settings.emailTesting") : t("settings.emailTestSend")}
                    </button>
                  </div>
                  {!configuration?.configured ? <p className="muted">{t("settings.emailTestSaveFirst")}</p> : null}
                  {isDirty ? <p className="muted">{t("settings.emailTestUnsaved")}</p> : null}
                </form>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
