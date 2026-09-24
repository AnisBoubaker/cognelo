"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmationDialog, EditActionBar, RichTextEditor, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { ActivityPickerDialog } from "@/components/activity-picker-dialog";
import {
  api,
  type ActivityBank,
  type ActivityDefinition,
  type ActivityType,
  type BankActivity,
  type BankTest,
  type BankTestItem
} from "@/lib/api";
import type { Locale } from "@/lib/i18n";

type Props = {
  activity: BankActivity;
  bank: ActivityBank;
  locale: Locale;
  onActivityUpdated?: (activity: BankActivity) => void;
};

const excludedNestedTypes = new Set(["test"]);

export function BankTestActivityView({ activity, bank, locale, onActivityUpdated }: Props) {
  const router = useRouter();
  const notifications = useNotifications();
  const [test, setTest] = useState<BankTest | null>(null);
  const [definitions, setDefinitions] = useState<ActivityDefinition[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [banks, setBanks] = useState<ActivityBank[]>([]);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [savedSettings, setSavedSettings] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [itemPendingRemoval, setItemPendingRemoval] = useState<BankTestItem | null>(null);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const hasUnsavedSettings = Boolean(test && (
    title !== test.activity.title || description !== test.activity.description || JSON.stringify(test.settings) !== savedSettings
  ));

  const refresh = useCallback(async () => {
    const [testResult, typeResult, bankResult] = await Promise.all([
      api.bankTest(bank.id, activity.id),
      api.activityTypes(),
      bank.subjectId ? api.activityBanks(bank.subjectId) : Promise.resolve({ activityBanks: [] })
    ]);
    setTest(testResult.test);
    setLoadFailed(false);
    setTitle(testResult.test.activity.title);
    setDescription(testResult.test.activity.description);
    setSavedSettings(JSON.stringify(testResult.test.settings));
    setDefinitions(typeResult.registeredDefinitions);
    setActivityTypes(typeResult.activityTypes);
    setBanks(bankResult.activityBanks);
    onActivityUpdated?.(testResult.test.activity);
  }, [activity.id, bank.id, bank.subjectId, onActivityUpdated]);

  useEffect(() => {
    refresh().catch((reason) => {
      setLoadFailed(true);
      notifications.error(reason instanceof Error ? reason.message : "Could not load the reusable Test.");
    });
  }, [notifications, refresh]);

  async function perform(action: () => Promise<unknown>, successMessage?: string) {
    setBusy(true);
    try {
      await action();
      await refresh();
      if (successMessage) notifications.success(successMessage);
      return true;
    } catch (reason) {
      notifications.error(reason instanceof Error ? reason.message : "The reusable Test could not be updated.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addItem(input: Record<string, unknown>) {
    setBusy(true);
    try {
      await api.createBankTestItem(bank.id, activity.id, input);
      await refresh();
      setShowActivityPicker(false);
      notifications.success("Activity copied into the reusable Test.");
      return true;
    } catch (reason) {
      notifications.error(reason instanceof Error ? reason.message : "The activity could not be added to this Test.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createTestActivity(activityType: ActivityType) {
    if (!test) return;
    const definition = definitions.find((candidate) => candidate.key === activityType.key);
    await addItem({
      source: "local",
      activityTypeKey: activityType.key,
      title: definition?.i18n?.[locale]?.defaultTitle ?? definition?.name ?? activityType.name,
      description: definition?.i18n?.[locale]?.description ?? definition?.description ?? activityType.description,
      config: definition?.defaultConfig ?? {},
      position: test.items.length
    });
  }

  async function addBankActivityToTest(bankActivity: BankActivity) {
    if (!test) return;
    await addItem({
      source: "bank",
      bankActivityId: bankActivity.id,
      activityVersionId: bankActivity.currentVersionId ?? undefined,
      position: test.items.length
    });
  }

  const saveSettings = useCallback(async () => {
    if (!test) return;
    await perform(
      () => api.updateBankTest(bank.id, activity.id, { title: title.trim(), description, settings: test.settings }),
      "Reusable Test settings saved."
    );
  }, [activity.id, bank.id, description, test, title]);

  useUnsavedChangesGuard(useMemo(() => ({
    isDirty: hasUnsavedSettings,
    onSave: saveSettings,
    onDiscard: () => {
      if (!test) return;
      setTitle(test.activity.title);
      setDescription(test.activity.description);
      setTest({ ...test, settings: JSON.parse(savedSettings) });
    }
  }), [hasUnsavedSettings, saveSettings, savedSettings, test]));

  if (!test) {
    return <section className="section"><p className="muted">{loadFailed ? "Reusable Test unavailable." : "Loading Test…"}</p></section>;
  }

  const settings = test.settings;
  return (
    <div className="stack">
      <section className="section stack">
        <div><p className="eyebrow">Reusable Test</p><h2>Assessment details</h2></div>
        <div className="field">
          <label htmlFor="bank-test-title">Title</label>
          <input id="bank-test-title" value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bank-test-description">Instructions shown to students</label>
          <RichTextEditor id="bank-test-description" value={description} disabled={busy} locale={locale} onChange={setDescription} />
        </div>
        <div className="form-grid-two">
          <div className="field">
            <label htmlFor="bank-test-time-limit">Time limit in minutes (optional)</label>
            <input id="bank-test-time-limit" min={1} type="number" value={settings.timeLimitMinutes ?? ""} disabled={busy} onChange={(event) => setTest({ ...test, settings: { ...settings, timeLimitMinutes: event.target.value ? Number(event.target.value) : null } })} />
          </div>
          <div className="field">
            <label htmlFor="bank-test-navigation">Navigation</label>
            <select id="bank-test-navigation" value={settings.navigationMode} disabled={busy} onChange={(event) => setTest({ ...test, settings: { ...settings, navigationMode: event.target.value as "free" | "sequential" } })}>
              <option value="free">Students may move freely</option>
              <option value="sequential">Sequential</option>
            </select>
          </div>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.randomizeItems} disabled={busy} onChange={(event) => setTest({ ...test, settings: { ...settings, randomizeItems: event.target.checked } })} />
          <span>Randomize activity order for each attempt</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.allowResume} disabled={busy} onChange={(event) => setTest({ ...test, settings: { ...settings, allowResume: event.target.checked } })} />
          <span>Allow students to resume an unfinished attempt</span>
        </label>
        <EditActionBar
          isDirty={hasUnsavedSettings}
          isSaving={busy}
          savedLabel="Everything is saved."
          unsavedLabel="You have unsaved changes."
          saveLabel="Save Test settings"
          savingLabel="Saving..."
          cancelLabel="Cancel"
          onCancel={() => {
            setTitle(test.activity.title);
            setDescription(test.activity.description);
            setTest({ ...test, settings: JSON.parse(savedSettings) });
          }}
          onSave={saveSettings}
          saveDisabled={!title.trim()}
          secondaryActions={(
            <button className="button secondary" disabled={busy || hasUnsavedSettings} type="button" onClick={async () => {
              setBusy(true);
              try {
                const result = await api.duplicateBankActivity(bank.id, activity.id, `${test.activity.title} (copy)`);
                notifications.success("Reusable Test duplicated as a draft.");
                router.push(`/activity-banks/${bank.id}/activities/${result.activity.id}`);
              } catch (reason) {
                notifications.error(reason instanceof Error ? reason.message : "The Test could not be duplicated.");
              } finally {
                setBusy(false);
              }
            }}>Duplicate Test</button>
          )}
        />
      </section>

      <section className="section stack">
        <div>
          <p className="eyebrow">Composition</p>
          <h2>Test activities</h2>
          <p className="muted">Each activity is an independent copy owned by this reusable Test.</p>
        </div>
        {test.items.length ? test.items.map((item, index) => (
          <article className="card card-compact" key={item.id}>
            <div className="stack">
              <strong>{index + 1}. {item.activity.title}</strong>
              <span className="muted">{item.activity.activityType.name}</span>
              <div className="form-grid-two">
                <label className="field">Points
                  <input min={0} step="0.5" type="number" defaultValue={item.pointsPossible} disabled={busy || hasUnsavedSettings} onBlur={(event) => perform(() => api.updateBankTestItem(bank.id, activity.id, item.id, { pointsPossible: Number(event.target.value) }))} />
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={item.isRequired} disabled={busy || hasUnsavedSettings} onChange={(event) => perform(() => api.updateBankTestItem(bank.id, activity.id, item.id, { isRequired: event.target.checked }))} />
                  <span>Required</span>
                </label>
              </div>
            </div>
            <div className="section-actions">
              <Link className="button secondary" href={`/activity-banks/${bank.id}/activities/${item.bankActivityId}?testBankActivityId=${activity.id}`}>Edit</Link>
              <button className="button secondary" disabled={busy || hasUnsavedSettings || index === 0} type="button" onClick={() => perform(async () => {
                const previous = test.items[index - 1];
                await api.updateBankTestItem(bank.id, activity.id, item.id, { position: previous.position });
                await api.updateBankTestItem(bank.id, activity.id, previous.id, { position: item.position });
              })}>↑</button>
              <button className="button secondary" disabled={busy || hasUnsavedSettings || index === test.items.length - 1} type="button" onClick={() => perform(async () => {
                const next = test.items[index + 1];
                await api.updateBankTestItem(bank.id, activity.id, item.id, { position: next.position });
                await api.updateBankTestItem(bank.id, activity.id, next.id, { position: item.position });
              })}>↓</button>
              <button className="button danger" disabled={busy || hasUnsavedSettings} type="button" onClick={() => setItemPendingRemoval(item)}>Remove</button>
            </div>
          </article>
        )) : <p className="muted">This reusable Test does not contain any activities yet.</p>}
        <button className="button" disabled={busy || hasUnsavedSettings} type="button" onClick={() => setShowActivityPicker(true)}>Add activity</button>
      </section>

      {showActivityPicker ? (
        <ActivityPickerDialog
          activityTypes={activityTypes}
          activityDefinitions={definitions}
          activityBanks={banks}
          creationScope="bank"
          excludedBankActivityTypeKeys={excludedNestedTypes}
          disabled={busy}
          eyebrow="Reusable Test composition"
          title="Add activity to Test"
          onClose={() => setShowActivityPicker(false)}
          onSelectActivityType={createTestActivity}
          onSelectBankActivity={addBankActivityToTest}
        />
      ) : null}
      <ConfirmationDialog
        open={Boolean(itemPendingRemoval)}
        eyebrow="Remove Test activity"
        title="Remove this activity from the reusable Test?"
        message={itemPendingRemoval ? <><strong>{itemPendingRemoval.activity.title}</strong> will be removed from the current Test draft. Published Test versions and existing course copies remain intact.</> : null}
        confirmLabel={busy ? "Removing…" : "Remove activity"}
        cancelLabel="Keep activity"
        confirmVariant="danger"
        isConfirming={busy}
        onCancel={() => setItemPendingRemoval(null)}
        onConfirm={async () => {
          if (!itemPendingRemoval) return;
          const removed = await perform(() => api.deleteBankTestItem(bank.id, activity.id, itemPendingRemoval.id), "Activity removed from the reusable Test.");
          if (removed) setItemPendingRemoval(null);
        }}
      />
    </div>
  );
}
