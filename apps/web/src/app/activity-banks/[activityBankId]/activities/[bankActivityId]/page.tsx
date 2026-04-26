"use client";

import { CodingExerciseActivityView } from "@cognelo/plugin-coding-exercises";
import { ParsonsActivityView } from "@cognelo/plugin-parsons";
import { WebDesignCodingExerciseActivityView } from "@cognelo/plugin-web-design-coding-exercises";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, type ActivityBank, type ActivityType, type BankActivity } from "@/lib/api";
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
  const [error, setError] = useState("");

  async function loadPage() {
    const result = await api.activityBank(activityBankId);
    const nextActivity = result.activityBank.activities?.find((candidate) => candidate.id === bankActivityId) ?? null;
    setBank(result.activityBank);
    setActivity(nextActivity);
    if (!nextActivity) {
      setError("Activity not found in this bank.");
    }
  }

  useEffect(() => {
    loadPage().catch((err) => setError(err instanceof Error ? err.message : "Unable to load bank activity."));
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
      throw new Error("Activity not loaded.");
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
        throw new Error("Run is not available while authoring activity bank items.");
      },
      listRuns: async () => ({ submissions: [] }),
      submitCode: async () => {
        throw new Error("Submit is not available while authoring activity bank items.");
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
        <h2>Unsupported activity type</h2>
        <p className="muted">This activity type does not have a bank authoring view yet.</p>
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
              {activity?.activityType.name}
              {activity?.currentVersion ? ` · v${activity.currentVersion.versionNumber}` : ""}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button secondary" href={`/activity-banks/${activityBankId}`}>
              Back to bank
            </Link>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}

        <section className="section stack">
          <p className="muted">
            Changes saved here update the activity bank activity and create a new activity version for future course assignments.
          </p>
        </section>

        {renderAuthoring()}
      </main>
    </AppShell>
  );
}
