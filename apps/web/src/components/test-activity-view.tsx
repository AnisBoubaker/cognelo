"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RichTextEditor, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { api, type Activity, type ActivityBank, type ActivityDefinition, type CourseTest } from "@/lib/api";

type Props = {
  activity: Activity;
  activityRouteCourseId?: string;
  canManage: boolean;
  course?: { id: string; title?: string; subjectId?: string } | null;
  locale: "en" | "fr" | "zh" | "ar";
  hasQuestionAuthoringAgent?: boolean;
  onSave?: unknown;
  t?: unknown;
};

export function TestActivityView({ activity, activityRouteCourseId, canManage, course, locale }: Props) {
  const courseId = activityRouteCourseId ?? course?.id ?? "";
  const [test, setTest] = useState<CourseTest | null>(null);
  const [definitions, setDefinitions] = useState<ActivityDefinition[]>([]);
  const [enabledTypeKeys, setEnabledTypeKeys] = useState<string[]>([]);
  const [banks, setBanks] = useState<ActivityBank[]>([]);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [localTypeKey, setLocalTypeKey] = useState("");
  const [bankActivityId, setBankActivityId] = useState("");
  const [savedSettings, setSavedSettings] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const localDefinitions = useMemo(
    () => definitions.filter((definition) => enabledTypeKeys.includes(definition.key) && definition.provider?.kind === "plugin" && definition.grading?.supportsAttempts),
    [definitions, enabledTypeKeys]
  );
  const bankActivities = useMemo(
    () => banks.flatMap((bank) => bank.activities ?? []).filter((item) => item.lifecycle === "published" && item.currentVersionId && item.currentVersion?.lifecycle === "published"),
    [banks]
  );
  const hasUnsavedSettings = Boolean(test && (
    title !== test.activity.title || description !== test.activity.description || JSON.stringify(test.settings) !== savedSettings
  ));

  async function refresh() {
    if (!courseId) return;
    const [testResult, typeResult, bankResult] = await Promise.all([
      api.test(courseId, activity.id),
      api.activityTypes(),
      course?.subjectId ? api.activityBanks(course.subjectId) : Promise.resolve({ activityBanks: [] })
    ]);
    setTest(testResult.test);
    setTitle(testResult.test.activity.title);
    setDescription(testResult.test.activity.description);
    setSavedSettings(JSON.stringify(testResult.test.settings));
    setDefinitions(typeResult.registeredDefinitions);
    setEnabledTypeKeys(typeResult.activityTypes.map((type) => type.key));
    setBanks(bankResult.activityBanks);
    const enabledKeys = new Set(typeResult.activityTypes.map((type) => type.key));
    setLocalTypeKey((current) => current || typeResult.registeredDefinitions.find((item) => enabledKeys.has(item.key) && item.provider?.kind === "plugin" && item.grading?.supportsAttempts)?.key || "");
    const firstPublishedBankActivity = bankResult.activityBanks
      .flatMap((bank) => bank.activities ?? [])
      .find((item) => item.lifecycle === "published" && item.currentVersionId && item.currentVersion?.lifecycle === "published");
    setBankActivityId((current) => current || firstPublishedBankActivity?.id || "");
  }

  useEffect(() => {
    refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load the test."));
  }, [activity.id, courseId]);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The test could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  const saveSettings = useCallback(async () => {
    if (!test) return;
    await perform(() => api.updateTest(courseId, activity.id, { title: title.trim(), description, settings: test.settings }));
  }, [activity.id, courseId, description, test, title]);

  useUnsavedChangesGuard(
    useMemo(() => ({
      isDirty: hasUnsavedSettings,
      onSave: saveSettings,
      onDiscard: () => {
        if (!test) return;
        setTitle(test.activity.title);
        setDescription(test.activity.description);
        setTest({ ...test, settings: JSON.parse(savedSettings) });
      }
    }), [hasUnsavedSettings, saveSettings, savedSettings, test])
  );

  if (!test) {
    return <section className="section">{error ? <p className="error">{error}</p> : <p>Loading test…</p>}</section>;
  }

  const settings = test.settings;
  return (
    <div className="stack">
      {error ? <p className="error">{error}</p> : null}
      <section className="section stack">
        <div>
          <p className="eyebrow">Test settings</p>
          <h2>Assessment details</h2>
        </div>
        <div className="field">
          <label htmlFor="test-title">Title</label>
          <input id="test-title" value={title} disabled={!canManage || busy} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="test-description">Instructions shown to students</label>
          <RichTextEditor id="test-description" value={description} disabled={!canManage || busy} locale={locale} onChange={setDescription} />
        </div>
        <div className="form-grid-two">
          <div className="field">
            <label htmlFor="test-time-limit">Time limit in minutes (optional)</label>
            <input
              id="test-time-limit"
              min={1}
              type="number"
              value={settings.timeLimitMinutes ?? ""}
              disabled={!canManage || busy}
              onChange={(event) => setTest({ ...test, settings: { ...settings, timeLimitMinutes: event.target.value ? Number(event.target.value) : null } })}
            />
          </div>
          <div className="field">
            <label htmlFor="test-navigation">Navigation</label>
            <select
              id="test-navigation"
              value={settings.navigationMode}
              disabled={!canManage || busy}
              onChange={(event) => setTest({ ...test, settings: { ...settings, navigationMode: event.target.value as "free" | "sequential" } })}
            >
              <option value="free">Students may move freely</option>
              <option value="sequential">Sequential</option>
            </select>
          </div>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.randomizeItems} disabled={!canManage || busy} onChange={(event) => setTest({ ...test, settings: { ...settings, randomizeItems: event.target.checked } })} />
          <span>Randomize activity order for each attempt</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.allowResume} disabled={!canManage || busy} onChange={(event) => setTest({ ...test, settings: { ...settings, allowResume: event.target.checked } })} />
          <span>Allow students to resume an unfinished attempt</span>
        </label>
        {canManage ? (
          <button className="button" disabled={busy || !title.trim()} type="button" onClick={() => perform(() => api.updateTest(courseId, activity.id, { title: title.trim(), description, settings }))}>
            Save test settings
          </button>
        ) : null}
      </section>

      <section className="section stack">
        <div>
          <p className="eyebrow">Composition</p>
          <h2>Test activities</h2>
          <p className="muted">Each item is a regular activity owned by this Test.</p>
        </div>
        {test.items.length ? test.items.map((item, index) => (
          <article className="card card-compact" key={item.id}>
            <div className="stack">
              <strong>{index + 1}. {item.activity.title}</strong>
              <span className="muted">{item.activity.activityType.name}</span>
              <div className="form-grid-two">
                <label className="field">Points
                  <input min={0} step="0.5" type="number" defaultValue={item.pointsPossible} disabled={!canManage || busy || hasUnsavedSettings} onBlur={(event) => perform(() => api.updateTestItem(courseId, activity.id, item.id, { pointsPossible: Number(event.target.value) }))} />
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={item.isRequired} disabled={!canManage || busy || hasUnsavedSettings} onChange={(event) => perform(() => api.updateTestItem(courseId, activity.id, item.id, { isRequired: event.target.checked }))} />
                  <span>Required</span>
                </label>
              </div>
            </div>
            {canManage ? <div className="section-actions">
              <Link className="button secondary" href={`/courses/${courseId}/activities/${item.activityId}?testActivityId=${activity.id}`}>Edit</Link>
              <button className="button secondary" disabled={busy || hasUnsavedSettings || index === 0} type="button" onClick={() => perform(async () => {
                const previous = test.items[index - 1];
                await api.updateTestItem(courseId, activity.id, item.id, { position: previous.position });
                await api.updateTestItem(courseId, activity.id, previous.id, { position: item.position });
              })}>↑</button>
              <button className="button secondary" disabled={busy || hasUnsavedSettings || index === test.items.length - 1} type="button" onClick={() => perform(async () => {
                const next = test.items[index + 1];
                await api.updateTestItem(courseId, activity.id, item.id, { position: next.position });
                await api.updateTestItem(courseId, activity.id, next.id, { position: item.position });
              })}>↓</button>
              <button className="button danger" disabled={busy || hasUnsavedSettings} type="button" onClick={() => perform(() => api.deleteTestItem(courseId, activity.id, item.id))}>Remove</button>
            </div> : null}
          </article>
        )) : <p className="muted">This Test does not contain any activities yet.</p>}

        {canManage ? <div className="form-grid-two">
          <div className="field">
            <label htmlFor="test-local-type">Create an activity for this Test</label>
            <select id="test-local-type" value={localTypeKey} disabled={busy || hasUnsavedSettings} onChange={(event) => setLocalTypeKey(event.target.value)}>
              {localDefinitions.map((definition) => <option key={definition.key} value={definition.key}>{definition.i18n?.[locale]?.name ?? definition.name}</option>)}
            </select>
            <button className="button" disabled={busy || hasUnsavedSettings || !localTypeKey} type="button" onClick={() => {
              const definition = definitions.find((candidate) => candidate.key === localTypeKey);
              return perform(() => api.createTestItem(courseId, activity.id, {
                source: "local",
                activityTypeKey: localTypeKey,
                title: definition?.i18n?.[locale]?.defaultTitle ?? definition?.name ?? "New activity",
                description: definition?.i18n?.[locale]?.description ?? definition?.description ?? "",
                config: definition?.defaultConfig ?? {},
                position: test.items.length
              }));
            }}>Create activity</button>
          </div>
          <div className="field">
            <label htmlFor="test-bank-activity">Add from an activity bank</label>
            <select id="test-bank-activity" value={bankActivityId} disabled={busy || hasUnsavedSettings || !bankActivities.length} onChange={(event) => setBankActivityId(event.target.value)}>
              {bankActivities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <button className="button secondary" disabled={busy || hasUnsavedSettings || !bankActivityId} type="button" onClick={() => {
              const source = bankActivities.find((item) => item.id === bankActivityId);
              return perform(() => api.createTestItem(courseId, activity.id, {
                source: "bank",
                bankActivityId,
                activityVersionId: source?.currentVersionId ?? undefined,
                position: test.items.length
              }));
            }}>Add from bank</button>
          </div>
        </div> : null}
      </section>
    </div>
  );
}
