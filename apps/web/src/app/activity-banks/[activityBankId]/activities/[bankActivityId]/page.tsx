"use client";

import { CodingExerciseActivityView } from "@cognelo/plugin-coding-exercises";
import { McqActivityView } from "@cognelo/plugin-mcq";
import { ParsonsActivityView } from "@cognelo/plugin-parsons";
import { WebDesignCodingExerciseActivityView } from "@cognelo/plugin-web-design-coding-exercises";
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

export default function BankActivityAuthoringPage() {
  const params = useParams<{ activityBankId: string; bankActivityId: string }>();
  const { activityBankId, bankActivityId } = params;
  const { locale, t } = useI18n();
  const [bank, setBank] = useState<ActivityBank | null>(null);
  const [activity, setActivity] = useState<BankActivity | null>(null);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [error, setError] = useState("");

  async function loadPage() {
    const [bankResult, typeResult] = await Promise.all([api.activityBank(activityBankId), api.activityTypes()]);
    const nextActivity = bankResult.activityBank.activities?.find((candidate) => candidate.id === bankActivityId) ?? null;
    setBank(bankResult.activityBank);
    setActivityDefinitions(typeResult.registeredDefinitions);
    setActivity(nextActivity);
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

  function renderAuthoring() {
    if (!renderedActivity) {
      return <p>{t("common.loading")}</p>;
    }

    if (renderedActivity.activityType.key === "parsons-problem") {
      return (
        <ParsonsActivityView
          activity={renderedActivity}
          canManage
          course={null}
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
          course={null}
          onSave={saveActivity}
          locale={locale}
          codingClient={undefined}
        />
      );
    }

    if (renderedActivity.activityType.key === "mcq") {
      return (
        <McqActivityView
          activity={renderedActivity}
          canManage
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
