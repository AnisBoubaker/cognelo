"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityBatchAction } from "@cognelo/contracts";
import { ProgressDialog, useDialogs, useNotifications } from "@cognelo/activity-ui";
import { api } from "./api";
import { useI18n } from "./i18n";

export function useActivityBatchActions(courseId: string, activityId: string, groupId: string | undefined, onChanged: () => Promise<void>) {
  const { locale, t } = useI18n(), dialogs = useDialogs(), notifications = useNotifications();
  const [actions, setActions] = useState<ActivityBatchAction[]>([]), [busy, setBusy] = useState<string | null>(null);
  const running = useRef(false), scope = `${courseId}:${activityId}:${groupId ?? ""}`, currentScope = useRef(scope); currentScope.current = scope;
  const load = useCallback(async (signal?: AbortSignal) => {
    const result = await api.activityBatchActions(courseId, activityId, groupId, signal);
    if (!signal?.aborted) setActions(result.actions);
  }, [courseId, activityId, groupId]);
  useEffect(() => {
    const pending = new AbortController(); let fetching = false, notified = false; setActions([]);
    const refresh = async () => {
      if (fetching || document.visibilityState !== "visible") return;
      fetching = true;
      try { await load(pending.signal); notified = false; }
      catch (error) { if (!pending.signal.aborted && !notified) { notifications.error(error instanceof Error ? error.message : t("courseDetail.loadError")); notified = true; } }
      finally { fetching = false; }
    };
    void refresh(); const interval = window.setInterval(() => void refresh(), 10_000);
    window.addEventListener("focus", refresh);
    return () => { pending.abort(); window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [load, notifications, t]);
  const execute = async (action: ActivityBatchAction) => {
    if (running.current) return;
    running.current = true;
    const label = action.labels[locale] ?? action.labels.en;
    try {
      const reason = await dialogs.prompt({ title: label, message: action.messages[locale] ?? action.messages.en,
        inputLabel: action.reasonLabels[locale] ?? action.reasonLabels.en, required: true, maxLength: 2000, confirmLabel: label });
      if (!reason?.trim() || currentScope.current !== scope) return;
      setBusy(label);
      const input = { actionId: action.id, revision: action.revision, operationId: crypto.randomUUID(), reason, ...(groupId ? { groupId } : {}) };
      // A lost response may be retried with the same operation ID; the server retains a receipt.
      let result;
      try { result = await api.executeActivityBatchAction(courseId, activityId, input); }
      catch (error) { if (!(error instanceof TypeError)) throw error; result = await api.executeActivityBatchAction(courseId, activityId, input); }
      if (currentScope.current === scope) {
        await Promise.all([load(), onChanged()]);
        notifications.success(`${label} · ${result.affectedCount}`);
      }
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : t("courseDetail.loadError"));
      if (currentScope.current === scope) await load().catch(() => {});
    } finally { running.current = false; setBusy(null); }
  };
  return { actions, execute, busy: busy !== null,
    progress: <ProgressDialog open={busy !== null} title={busy ?? ""} progressLabel={t("common.operationProgress")} /> };
}
