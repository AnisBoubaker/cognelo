"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmationDialog, MarkdownRenderer, RichTextEditor, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { ActivityExecutionStateHost } from "@cognelo/activity-sdk";
import { ActivityPickerDialog } from "@/components/activity-picker-dialog";
import {
  api,
  type Activity,
  type ActivityBank,
  type ActivityDefinition,
  type ActivityType,
  type BankActivity,
  type CourseTest,
  type CourseTestItem,
  type CourseTestRuntime,
  type CourseTestRuntimeItem
} from "@/lib/api";
import type { Locale } from "@/lib/i18n";

type Props = {
  activity: Activity;
  activityRouteCourseId?: string;
  canManage: boolean;
  course?: { id: string; title?: string; subjectId?: string } | null;
  groupId?: string;
  locale: Locale;
  hasQuestionAuthoringAgent?: boolean;
  onSubmitted?: () => void;
  studentViewMode?: "attempt" | "previous";
  onNewAttemptAvailabilityChange?: (canStartNewAttempt: boolean) => void;
  onPreviousSubmissionsAvailabilityChange?: (hasPreviousSubmissions: boolean) => void;
  renderStudentItem?: (context: TestStudentItemRendererContext) => ReactNode;
  onSave?: unknown;
  t?: (key: string, vars?: Record<string, string | number>) => string;
};

export type TestStudentItemRendererContext = {
  runtime: CourseTestRuntime;
  item: CourseTestRuntimeItem;
  disabled: boolean;
  executionHost: ActivityExecutionStateHost<Record<string, unknown>>;
};

export function TestActivityView(props: Props) {
  if (!props.canManage && props.groupId) {
    return <TestStudentRuntime {...props} groupId={props.groupId} />;
  }
  return <TestAuthoringView {...props} />;
}

function TestAuthoringView({ activity, activityRouteCourseId, canManage, course, locale }: Props) {
  const courseId = activityRouteCourseId ?? course?.id ?? "";
  const router = useRouter();
  const notifications = useNotifications();
  const [test, setTest] = useState<CourseTest | null>(null);
  const [definitions, setDefinitions] = useState<ActivityDefinition[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [banks, setBanks] = useState<ActivityBank[]>([]);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [savedSettings, setSavedSettings] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [itemPendingRemoval, setItemPendingRemoval] = useState<CourseTestItem | null>(null);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
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
    setLoadFailed(false);
    setTitle(testResult.test.activity.title);
    setDescription(testResult.test.activity.description);
    setSavedSettings(JSON.stringify(testResult.test.settings));
    setDefinitions(typeResult.registeredDefinitions);
    setActivityTypes(typeResult.activityTypes);
    setBanks(bankResult.activityBanks);
  }

  useEffect(() => {
    refresh().catch((reason) => {
      setLoadFailed(true);
      notifications.error(reason instanceof Error ? reason.message : "Could not load the test.");
    });
  }, [activity.id, courseId]);

  async function perform(action: () => Promise<unknown>, successMessage?: string) {
    setBusy(true);
    try {
      await action();
      await refresh();
      if (successMessage) {
        notifications.success(successMessage);
      }
      return true;
    } catch (reason) {
      notifications.error(reason instanceof Error ? reason.message : "The test could not be updated.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addItem(input: Record<string, unknown>) {
    setBusy(true);
    try {
      const result = await api.createTestItem(courseId, activity.id, input);
      setTest((current) => current ? {
        ...current,
        items: [...current.items.filter((item) => item.id !== result.item.id), result.item]
          .sort((left, right) => left.position - right.position)
      } : current);
      notifications.success("Activity added to the Test.");
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
    const added = await addItem({
      source: "local",
      activityTypeKey: activityType.key,
      title: definition?.i18n?.[locale]?.defaultTitle ?? definition?.name ?? activityType.name,
      description: definition?.i18n?.[locale]?.description ?? definition?.description ?? activityType.description,
      config: definition?.defaultConfig ?? {},
      position: test.items.length
    });
    if (added) setShowActivityPicker(false);
  }

  async function addBankActivityToTest(bankActivity: BankActivity) {
    if (!test) return;
    const added = await addItem({
      source: "bank",
      bankActivityId: bankActivity.id,
      activityVersionId: bankActivity.currentVersionId ?? undefined,
      position: test.items.length
    });
    if (added) setShowActivityPicker(false);
  }

  const saveSettings = useCallback(async () => {
    if (!test) return;
    await perform(
      () => api.updateTest(courseId, activity.id, { title: title.trim(), description, settings: test.settings }),
      "Test settings saved."
    );
  }, [activity.id, courseId, description, test, title]);

  async function duplicateCurrentTest() {
    setBusy(true);
    try {
      const result = await api.duplicateTest(courseId, activity.id);
      notifications.success("Test duplicated. The copy is an editable draft.");
      router.push(`/courses/${courseId}/activities/${result.test.activityId}`);
    } catch (reason) {
      notifications.error(reason instanceof Error ? reason.message : "The Test could not be duplicated.");
    } finally {
      setBusy(false);
    }
  }

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
    return <section className="section"><p className="muted">{loadFailed ? "Test unavailable." : "Loading test…"}</p></section>;
  }

  const settings = test.settings;
  return (
    <div className="stack">
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
          <div className="section-actions">
            <button className="button" disabled={busy || !title.trim()} type="button" onClick={saveSettings}>
              Save test settings
            </button>
            <button className="button secondary" disabled={busy || hasUnsavedSettings} type="button" onClick={duplicateCurrentTest}>
              Duplicate Test
            </button>
          </div>
        ) : null}
      </section>

      <section className="section stack">
        <div>
          <p className="eyebrow">Composition</p>
          <h2>Test activities</h2>
          <p className="muted">Each item is a regular activity owned by this Test.</p>
          <p className="muted">Published activities can be composed here while Test execution support is developed separately.</p>
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
              <button className="button danger" disabled={busy || hasUnsavedSettings} type="button" onClick={() => setItemPendingRemoval(item)}>Remove</button>
            </div> : null}
          </article>
        )) : <p className="muted">This Test does not contain any activities yet.</p>}

        {canManage ? (
          <button
            className="button"
            disabled={busy || hasUnsavedSettings}
            type="button"
            onClick={() => setShowActivityPicker(true)}
          >
            Add activity
          </button>
        ) : null}
      </section>
      {showActivityPicker ? (
        <ActivityPickerDialog
          activityTypes={activityTypes}
          activityDefinitions={definitions}
          activityBanks={banks}
          disabled={busy}
          eyebrow="Test composition"
          title="Add activity to Test"
          onClose={() => setShowActivityPicker(false)}
          onSelectActivityType={createTestActivity}
          onSelectBankActivity={addBankActivityToTest}
        />
      ) : null}
      <ConfirmationDialog
        open={Boolean(itemPendingRemoval)}
        eyebrow="Remove Test activity"
        title="Remove this activity from the Test?"
        message={itemPendingRemoval ? <>
          <strong>{itemPendingRemoval.activity.title}</strong> and its Test-only configuration will be permanently deleted. This cannot be undone.
        </> : null}
        confirmLabel={busy ? "Removing…" : "Remove activity"}
        cancelLabel="Keep activity"
        confirmVariant="danger"
        isConfirming={busy}
        onCancel={() => setItemPendingRemoval(null)}
        onConfirm={async () => {
          if (!itemPendingRemoval) return;
          const removed = await perform(
            () => api.deleteTestItem(courseId, activity.id, itemPendingRemoval.id),
            "Activity removed from the Test."
          );
          if (removed) {
            setItemPendingRemoval(null);
          }
        }}
      />
    </div>
  );
}

function TestStudentRuntime({
  activity,
  activityRouteCourseId,
  groupId,
  onSubmitted,
  studentViewMode = "attempt",
  onNewAttemptAvailabilityChange,
  onPreviousSubmissionsAvailabilityChange,
  renderStudentItem,
  t = (key) => key
}: Props & { groupId: string }) {
  const courseId = activityRouteCourseId ?? "";
  const notifications = useNotifications();
  const [runtime, setRuntime] = useState<CourseTestRuntime | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [furthestVisitedIndex, setFurthestVisitedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingSaveCount, setPendingSaveCount] = useState(0);
  const [showStartConfirmation, setShowStartConfirmation] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [sessionId] = useState(() => globalThis.crypto?.randomUUID?.() ?? `test-session-${Date.now()}-${Math.random()}`);
  const autoSubmittedAttemptRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const applyRuntime = useCallback((nextRuntime: CourseTestRuntime) => {
    setRuntime(nextRuntime);
    onNewAttemptAvailabilityChange?.(
      Boolean(nextRuntime.attempt?.lifecycle === "started" && !nextRuntime.resume.blocked) || nextRuntime.availability.canStart
    );
    onPreviousSubmissionsAvailabilityChange?.(nextRuntime.hasPreviousSubmissions);
  }, [onNewAttemptAvailabilityChange, onPreviousSubmissionsAvailabilityChange]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.testRuntime(courseId, groupId, activity.id, studentViewMode, sessionId)
      .then((result) => {
        if (!cancelled) applyRuntime(result.runtime);
      })
      .catch((reason) => {
        if (!cancelled) notifications.error(reason instanceof Error ? reason.message : t("courseDetail.testLoadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activity.id, applyRuntime, courseId, groupId, notifications, sessionId, studentViewMode]);

  useEffect(() => {
    setSelectedIndex(0);
    setFurthestVisitedIndex(0);
    setPendingSaveCount(0);
  }, [runtime?.attempt?.id, studentViewMode]);

  const selectedRuntimeItem = runtime?.test.items[selectedIndex] ?? null;
  const executionHost = useMemo<ActivityExecutionStateHost<Record<string, unknown>> | null>(() => {
    if (!runtime?.attempt || !selectedRuntimeItem) return null;
    const parentAttemptId = runtime.attempt.id;
    const testItemId = selectedRuntimeItem.id;
    return {
      context: {
        kind: "test_item",
        parentAttemptId,
        testItemId,
        testItemAttemptId: selectedRuntimeItem.itemAttempt?.id ?? null
      },
      load: async () => (await api.testItemAttempt(
        courseId,
        groupId,
        activity.id,
        testItemId,
        parentAttemptId,
        sessionId
      )).itemAttempt?.state ?? null,
      save: async (state) => {
        setPendingSaveCount((current) => current + 1);
        const save = saveQueueRef.current.then(async () => {
          await api.saveTestItemState(courseId, groupId, activity.id, testItemId, parentAttemptId, state, sessionId);
        });
        saveQueueRef.current = save.catch(() => undefined);
        try {
          await save;
          return state;
        } finally {
          setPendingSaveCount((current) => Math.max(0, current - 1));
        }
      },
      executeAction: async <TResult,>(action: string, payload: unknown) => {
        return api.executeTestItemAction<TResult>(
          courseId,
          groupId,
          activity.id,
          testItemId,
          parentAttemptId,
          sessionId,
          action,
          payload
        );
      }
    };
  }, [activity.id, courseId, groupId, runtime?.attempt?.id, selectedRuntimeItem?.id, selectedRuntimeItem?.itemAttempt?.id, sessionId]);

  async function startTest() {
    setBusy(true);
    try {
      const result = await api.startTestAttempt(courseId, groupId, activity.id, sessionId);
      applyRuntime(result.runtime);
      setShowStartConfirmation(false);
      notifications.success(t("courseDetail.testStarted"));
    } catch (reason) {
      notifications.error(reason instanceof Error ? reason.message : t("courseDetail.testStartError"));
    } finally {
      setBusy(false);
    }
  }

  async function finishTest() {
    if (!runtime?.attempt) return;
    if (pendingSaveCount > 0) {
      notifications.error(t("courseDetail.testWaitForSave"));
      return;
    }
    setBusy(true);
    try {
      const result = await api.submitTestAttempt(courseId, groupId, activity.id, runtime.attempt.id, sessionId);
      applyRuntime(result.runtime);
      setShowSubmitConfirmation(false);
      notifications.success(t("courseDetail.testSubmitted"));
      onSubmitted?.();
    } catch (reason) {
      notifications.error(reason instanceof Error ? reason.message : t("courseDetail.testSubmitError"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!runtime?.attempt || runtime.attempt.lifecycle !== "started" || !runtime.timing.expiresAt) return;
    setClock(Date.now());
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [runtime?.attempt?.id, runtime?.attempt?.lifecycle, runtime?.timing.expiresAt]);

  const remainingSeconds = runtime?.timing.expiresAt
    ? Math.max(0, Math.ceil((new Date(runtime.timing.expiresAt).getTime() - clock) / 1000))
    : null;

  useEffect(() => {
    if (
      runtime?.attempt?.lifecycle === "started" &&
      (remainingSeconds === 0 || runtime.resume.blocked) &&
      autoSubmittedAttemptRef.current !== runtime.attempt.id &&
      pendingSaveCount === 0 &&
      !busy
    ) {
      autoSubmittedAttemptRef.current = runtime.attempt.id;
      notifications.info(t(runtime.resume.blocked
        ? "courseDetail.testResumeDisabledSubmitting"
        : "courseDetail.testTimeExpiredSubmitting"));
      void finishTest();
    }
  }, [busy, pendingSaveCount, remainingSeconds, runtime?.attempt?.id, runtime?.attempt?.lifecycle, runtime?.resume.blocked, t]);

  if (loading || !runtime) {
    return <section className="section"><p className="muted" role="status">{t("courseDetail.testLoading")}</p></section>;
  }

  const attemptStarted = runtime.attempt?.lifecycle === "started" && !runtime.resume.blocked;
  const selectedItem = selectedRuntimeItem;
  const isReadOnly = !attemptStarted;

  if (!runtime.attempt) {
    return (
      <section className="section stack">
        <div>
          <p className="eyebrow">{t("courseDetail.testSummative")}</p>
          <h2>{runtime.test.activity.title}</h2>
        </div>
        <MarkdownRenderer markdown={runtime.test.activity.description} />
        <div className="inline-panel stack stack-tight">
          <strong>{t("courseDetail.testActivityCount", { count: runtime.test.items.length })}</strong>
          {runtime.test.settings.timeLimitMinutes ? <span className="muted">{t("courseDetail.testTimeLimit", { count: runtime.test.settings.timeLimitMinutes })}</span> : null}
          <span className="muted">{t(runtime.test.settings.navigationMode === "sequential" ? "courseDetail.testNavigationSequential" : "courseDetail.testNavigationFree")}</span>
        </div>
        <button className="button" disabled={busy || !runtime.availability.canStart} type="button" onClick={() => setShowStartConfirmation(true)}>
          {t("courseDetail.testStart")}
        </button>
        {!runtime.availability.canStart && runtime.availability.reason ? <p className="error">{runtime.availability.reason}</p> : null}
        <ConfirmationDialog
          open={showStartConfirmation}
          eyebrow={t("courseDetail.testStart")}
          title={t("courseDetail.testStartConfirmTitle")}
          message={runtime.test.settings.timeLimitMinutes
            ? t("courseDetail.testTimerStarts", { count: runtime.test.settings.timeLimitMinutes })
            : t("courseDetail.testAttemptBegins")}
          confirmLabel={busy ? t("courseDetail.testStarting") : t("courseDetail.testStart")}
          cancelLabel={t("courseDetail.testNotYet")}
          isConfirming={busy}
          onCancel={() => setShowStartConfirmation(false)}
          onConfirm={startTest}
        />
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="section stack">
        <div>
          <p className="eyebrow">{isReadOnly ? t("courseDetail.testSubmittedLabel") : t("courseDetail.testAttemptNumber", { number: runtime.attempt.attemptNumber })}</p>
          <h2>{runtime.test.activity.title}</h2>
        </div>
        <MarkdownRenderer markdown={runtime.test.activity.description} />
        <div className="inline-panel">
          <strong>{t("courseDetail.testActivityPosition", { current: Math.min(selectedIndex + 1, runtime.test.items.length), total: runtime.test.items.length })}</strong>
          {remainingSeconds !== null ? (
            <span aria-live="polite" className={remainingSeconds <= 60 ? "error" : "muted"} role="status">
              {" · "}{t("courseDetail.testTimeRemaining", { time: formatRemainingTime(remainingSeconds) })}
            </span>
          ) : null}
        </div>
        <div className="section-actions" aria-label={t("courseDetail.testActivitiesLabel")}>
          {runtime.test.items.map((item, index) => {
            const sequentiallyLocked = runtime.test.settings.navigationMode === "sequential" && index > furthestVisitedIndex;
            return (
              <button
                aria-current={selectedIndex === index ? "step" : undefined}
                className={selectedIndex === index ? "button" : "button secondary"}
                disabled={sequentiallyLocked}
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedIndex(index);
                  setFurthestVisitedIndex((current) => Math.max(current, index));
                }}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </section>

      {selectedItem ? (
        <section className="section stack">
          <div>
            <p className="eyebrow">{t("courseDetail.testActivityPosition", { current: selectedIndex + 1, total: runtime.test.items.length })}</p>
            <h2>{selectedItem.activity.title}</h2>
          </div>
          {runtime.resume.blocked ? (
            <p className="muted">{t("courseDetail.testResumeDisabledSubmitting")}</p>
          ) : renderStudentItem && executionHost ? renderStudentItem({
            runtime,
            item: selectedItem,
            disabled: isReadOnly,
            executionHost
          }) : <p className="error">{t("courseDetail.testRendererUnavailable")}</p>}
        </section>
      ) : null}

      <section className="section section-actions">
        <button className="button secondary" disabled={selectedIndex === 0} type="button" onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))}>
          {t("courseDetail.testPreviousActivity")}
        </button>
        <button
          className="button secondary"
          disabled={selectedIndex >= runtime.test.items.length - 1}
          type="button"
          onClick={() => {
            const nextIndex = Math.min(runtime.test.items.length - 1, selectedIndex + 1);
            setSelectedIndex(nextIndex);
            setFurthestVisitedIndex((current) => Math.max(current, nextIndex));
          }}
        >
          {t("courseDetail.testNextActivity")}
        </button>
        {attemptStarted ? (
          <button className="button" disabled={busy || pendingSaveCount > 0} type="button" onClick={() => setShowSubmitConfirmation(true)}>
            {pendingSaveCount > 0 ? t("courseDetail.testSavingAnswers") : t("courseDetail.testSubmit")}
          </button>
        ) : null}
      </section>
      <ConfirmationDialog
        open={showSubmitConfirmation}
        eyebrow={t("courseDetail.testSubmit")}
        title={t("courseDetail.testSubmitConfirmTitle")}
        message={t("courseDetail.testSubmitConfirmMessage")}
        confirmLabel={busy ? t("courseDetail.testSubmitting") : t("courseDetail.testSubmit")}
        cancelLabel={t("courseDetail.testKeepWorking")}
        isConfirming={busy}
        onCancel={() => setShowSubmitConfirmation(false)}
        onConfirm={finishTest}
      />
    </div>
  );
}

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
