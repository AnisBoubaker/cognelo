"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { ProgressDialog, useNotifications } from "@cognelo/activity-ui";
import { api, type GradebookPluginAction } from "./api";
import { useI18n } from "./i18n";

/** Host plumbing only: eligibility and download content belong to the registered activity. */
export function useGradebookPluginActions(courseId: string, activityId: string, activityTypeKey: string, groupId?: string, revision?: unknown) {
  const { locale, t } = useI18n(), notifications = useNotifications();
  const supported = Boolean(getActivityDefinition(activityTypeKey)?.gradebookActions?.length);
  const [actions, setActions] = useState<GradebookPluginAction[]>([]);
  const [preparing, setPreparing] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!supported) { setActions([]); return; }
    let disposed = false, fetching = false, notified = false;
    const controller = new AbortController();
    setActions([]);
    async function load() {
      if (fetching || disposed || document.visibilityState !== "visible") return;
      fetching = true;
      try {
        const result = await api.gradebookPluginActions(courseId, activityId, groupId, controller.signal);
        if (!disposed) { setActions(result.actions); notified = false; }
      } catch (error) {
        if (!disposed && !notified) { notifications.error(error instanceof Error ? error.message : t("gradebookActions.loadFailed")); notified = true; }
      } finally { fetching = false; }
    }
    void load();
    const interval = window.setInterval(() => void load(), 10_000);
    window.addEventListener("focus", load);
    return () => { disposed = true; controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", load); };
  }, [courseId, activityId, activityTypeKey, groupId, supported, revision, notifications, t]);
  useEffect(() => () => { operation.current?.abort(); }, [courseId, activityId, groupId]);
  const download = useCallback(async (action: GradebookPluginAction, participantId?: string) => {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setPreparing(action.labels[locale] ?? action.labels.en);
    try {
      const result = await api.downloadGradebookPluginAction(courseId, activityId, { actionId: action.id, ...(groupId ? { groupId } : {}), ...(participantId ? { participantId } : {}) }, controller.signal);
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(result.blob), link = document.createElement("a");
      link.href = url; link.download = result.fileName; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { if (!controller.signal.aborted) notifications.error(error instanceof Error ? error.message : t("gradebookActions.failed")); }
    finally { if (operation.current === controller) { operation.current = null; setPreparing(null); } }
  }, [courseId, activityId, groupId, locale, notifications, t]);
  return { actions, download, busy: preparing !== null,
    progress: <ProgressDialog open={preparing !== null} title={t("gradebookActions.preparing")} message={preparing} progressLabel={t("common.operationProgress")} cancelLabel={t("common.cancel")} onCancel={() => operation.current?.abort()} /> };
}
