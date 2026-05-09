"use client";

import { CodingExerciseActivityView } from "@cognelo/plugin-coding-exercises";
import { McqActivityView } from "@cognelo/plugin-mcq";
import { ParsonsActivityView } from "@cognelo/plugin-parsons";
import { WebDesignCodingExerciseActivityView } from "@cognelo/plugin-web-design-coding-exercises";
import { useNotifications } from "@cognelo/activity-ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, type ActivityBank, type ActivityDefinition, type ActivityType, type BankActivity } from "@/lib/api";
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

  const bankWebDesignClient = useMemo(
    () => ({
      listTests: async (_courseId: string, activityId: string) => api.bankWebDesignExerciseTests(activityBankId, activityId),
      saveTests: async (
        _courseId: string,
        activityId: string,
        input: Parameters<typeof api.saveBankWebDesignExerciseTests>[2]
      ) => api.saveBankWebDesignExerciseTests(activityBankId, activityId, input),
      getExpectedResult: async (_courseId: string, activityId: string) => api.bankWebDesignExerciseExpectedResult(activityBankId, activityId),
      runCode: async () => {
        throw new Error(t("bankActivityPage.runUnavailable"));
      },
      listRuns: async () => ({ submissions: [] }),
      submitCode: async () => {
        throw new Error(t("bankActivityPage.submitUnavailable"));
      },
      listSubmissions: async () => ({ submissions: [] })
    }),
    [activityBankId]
  );

  const bankCodingExerciseClient = useMemo(
    () => ({
      listHiddenTests: async (_courseId: string, activityId: string) => api.bankCodingExerciseHiddenTests(activityBankId, activityId),
      saveHiddenTests: async (
        _courseId: string,
        activityId: string,
        input: Parameters<typeof api.saveBankCodingExerciseHiddenTests>[2]
      ) => api.saveBankCodingExerciseHiddenTests(activityBankId, activityId, input),
      runCode: async () => {
        throw new Error(t("bankActivityPage.runUnavailable"));
      },
      listRuns: async () => ({ executions: [] }),
      submitCode: async () => {
        throw new Error(t("bankActivityPage.submitUnavailable"));
      },
      listSubmissions: async () => ({ executions: [] })
    }),
    [activityBankId, t]
  );

  function renderAuthoring() {
    if (!renderedActivity) {
      return <p>{t("common.loading")}</p>;
    }

    if (renderedActivity.activityType.key === "parsons-problem") {
      return (
        <ParsonsActivityView
          activity={renderedActivity}
          canManage
          course={{ id: activityBankId, title: bank?.title ?? "" }}
          onSave={saveActivity}
          attemptsClient={undefined}
          t={t}
        />
      );
    }

    if (renderedActivity.activityType.key === "coding-exercise") {
      return (
        <CodingExerciseActivityView
          activity={renderedActivity}
          canManage
          course={{ id: activityBankId, title: bank?.title ?? "" }}
          onSave={saveActivity}
          locale={locale}
          codingClient={bankCodingExerciseClient}
          aiGenerationClient={
            hasQuestionAuthoringAgent
              ? {
                  generatePrompt: (input) => api.generateBankCodingExercisePrompt(activityBankId, bankActivityId, input),
                  generateAssets: (input) => api.generateBankCodingExerciseAssets(activityBankId, bankActivityId, input)
                }
              : undefined
          }
        />
      );
    }

    if (renderedActivity.activityType.key === "mcq") {
      return (
        <McqActivityView
          activity={renderedActivity}
          canManage
          aiGenerationClient={
            hasQuestionAuthoringAgent
              ? {
                  generate: (input) => api.generateBankMcqSource(activityBankId, bankActivityId, input)
                }
              : undefined
          }
          onSave={saveActivity}
          locale={locale}
        />
      );
    }

    if (renderedActivity.activityType.key === "web-design-coding-exercise") {
      return (
        <WebDesignCodingExerciseActivityView
          activity={renderedActivity}
          canManage
          course={{ id: activityBankId }}
          onSave={saveActivity}
          locale={locale}
          webDesignClient={bankWebDesignClient}
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

        {renderAuthoring()}
      </main>
    </AppShell>
  );

  function activityTypeLabel(activityTypeKey: string) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    const localized = definition?.i18n?.[locale];
    return localized?.name ?? definition?.name ?? activity?.activityType.name ?? activityTypeKey;
  }
}
