"use client";

import { useNotifications } from "@cognelo/activity-ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityEditorTabs } from "@/components/activity-editor-tabs";
import { api, type ActivityBank, type ActivityDefinition, type ActivityType, type BankActivity } from "@/lib/api";
import { bankActivityRenderers } from "@/lib/activity-renderers";
import { useI18n } from "@/lib/i18n";

type ActivityLike = {
  id: string;
  title: string;
  description: string;
  lifecycle: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  activityType: ActivityType;
};

type ActivityLifecycle = "draft" | "published" | "paused" | "archived";

export default function BankActivityAuthoringPage() {
  const params = useParams<{ activityBankId: string; bankActivityId: string }>();
  const { activityBankId, bankActivityId } = params;
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const [bank, setBank] = useState<ActivityBank | null>(null);
  const [activity, setActivity] = useState<BankActivity | null>(null);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [hasQuestionAuthoringAgent, setHasQuestionAuthoringAgent] = useState(false);
  const [lifecycleDraft, setLifecycleDraft] = useState<ActivityLifecycle>("draft");
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [error, setError] = useState("");

  async function loadPage() {
    const [bankResult, typeResult, aiAgentResult] = await Promise.all([api.activityBank(activityBankId), api.activityTypes(), api.aiAgentConnections()]);
    const nextActivity = bankResult.activityBank.activities?.find((candidate) => candidate.id === bankActivityId) ?? null;
    setBank(bankResult.activityBank);
    setActivityDefinitions(typeResult.registeredDefinitions);
    setHasQuestionAuthoringAgent(
      aiAgentResult.connections.some((connection) => connection.id === aiAgentResult.preferences.questionAuthoringAiAgentConnectionId && connection.isEnabled)
    );
    setActivity(nextActivity);
    setLifecycleDraft((nextActivity?.lifecycle ?? "draft") as ActivityLifecycle);
    if (!nextActivity) {
      setError(t("bankActivityPage.notFound"));
    }
  }

  useEffect(() => {
    loadPage().catch((err) => setError(err instanceof Error ? err.message : t("bankActivityPage.loadError")));
  }, [activityBankId, bankActivityId]);

  const renderedActivity = useMemo<ActivityLike | null>(() => {
    if (!activity) {
      return null;
    }
    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      lifecycle: activity.lifecycle,
      config: activity.config,
      metadata: activity.metadata,
      activityType: activity.activityType
    };
  }, [activity]);

  async function saveActivity(input: { title: string; description: string; config: Record<string, unknown> }) {
    if (!activity) {
      throw new Error(t("bankActivityPage.activityNotLoaded"));
    }
    const result = await api.updateBankActivity(activityBankId, activity.id, {
      title: input.title,
      description: input.description,
      config: input.config,
      activityTypeKey: activity.activityType.key
    });
    setActivity(result.activity);
    setLifecycleDraft(result.activity.lifecycle as ActivityLifecycle);
    return {
      id: result.activity.id,
      title: result.activity.title,
      description: result.activity.description,
      lifecycle: result.activity.lifecycle,
      config: result.activity.config,
      metadata: result.activity.metadata,
      activityType: result.activity.activityType
    };
  }

  async function updateLifecycle(nextLifecycle: ActivityLifecycle) {
    if (!activity || savingLifecycle) {
      return;
    }

    const previousLifecycle = lifecycleDraft;
    setLifecycleDraft(nextLifecycle);
    setSavingLifecycle(true);
    setError("");

    try {
      const result = await api.updateBankActivity(activityBankId, activity.id, {
        lifecycle: nextLifecycle
      });
      setActivity(result.activity);
      setLifecycleDraft(result.activity.lifecycle as ActivityLifecycle);
      notifications.success(t("bankActivityPage.statusSaved"));
    } catch (err) {
      setLifecycleDraft(previousLifecycle);
      notifications.error(err instanceof Error ? err.message : t("bankActivityPage.statusSaveError"));
    } finally {
      setSavingLifecycle(false);
    }
  }

  function renderAuthoring() {
    if (!renderedActivity) {
      return <p>{t("common.loading")}</p>;
    }

    const BankActivityRenderer = activityDefinitions.some((definition) => definition.key === renderedActivity.activityType.key)
      ? bankActivityRenderers[renderedActivity.activityType.key]
      : null;
    if (BankActivityRenderer) {
      return (
        <BankActivityRenderer
          activity={renderedActivity}
          activityBankId={activityBankId}
          bankActivityId={bankActivityId}
          bankTitle={bank?.title ?? ""}
          hasQuestionAuthoringAgent={hasQuestionAuthoringAgent}
          locale={locale}
          onSave={saveActivity}
          t={t}
        />
      );
    }

    return (
      <section className="section stack">
        <h2>{t("bankActivityPage.unsupportedTitle")}</h2>
        <p className="muted">{t("bankActivityPage.unsupportedText")}</p>
      </section>
    );
  }

  async function saveConcepts(knowledgeConceptIds: string[]) {
    if (!activity) return;
    const result = await api.updateBankActivity(activityBankId, activity.id, { knowledgeConceptIds });
    setActivity(result.activity);
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{bank?.title ?? t("nav.activityBanks")}</p>
            <h1>{activity?.title ?? t("common.loading")}</h1>
            <p className="muted">
              {activity ? activityTypeLabel(activity.activityType.key) : ""}
              {activity ? ` · ${t(`activityLifecycle.${activity.lifecycle}`)}` : ""}
              {activity?.currentVersion ? ` · v${activity.currentVersion.versionNumber}` : ""}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button secondary" href={`/activity-banks/${activityBankId}`}>
              {t("bankActivityPage.backToBank")}
            </Link>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}

        <section className="section stack">
          <p className="muted">
            {t("bankActivityPage.versionNote")}
          </p>
          {activity ? (
            <div className="field" style={{ maxWidth: 360 }}>
              <label htmlFor="bank-activity-lifecycle">{t("bankActivityPage.statusLabel")}</label>
              <select
                id="bank-activity-lifecycle"
                value={lifecycleDraft}
                disabled={savingLifecycle}
                onChange={(event) => void updateLifecycle(event.target.value as ActivityLifecycle)}
              >
                <option value="draft">{t("activityLifecycle.draft")}</option>
                <option value="published">{t("activityLifecycle.published")}</option>
                <option value="paused">{t("activityLifecycle.paused")}</option>
                <option value="archived">{t("activityLifecycle.archived")}</option>
              </select>
            </div>
          ) : null}
        </section>

        {activity ? (
          <ActivityEditorTabs
            concepts={bank?.subject?.knowledgeConcepts ?? []}
            selectedConceptIds={activity.knowledgeConcepts?.map((link) => link.conceptId) ?? []}
            onSaveConcepts={saveConcepts}
            t={t}
            locale={locale}
          >
            {renderAuthoring()}
          </ActivityEditorTabs>
        ) : renderAuthoring()}
      </main>
    </AppShell>
  );

  function activityTypeLabel(activityTypeKey: string) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    const localized = definition?.i18n?.[locale];
    return localized?.name ?? definition?.name ?? activity?.activityType.name ?? activityTypeKey;
  }
}
