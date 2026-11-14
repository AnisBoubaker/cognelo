"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityStudentAction } from "@cognelo/contracts";
import { ProgressDialog, useDialogs, useNotifications } from "@cognelo/activity-ui";
import { api } from "./api";
import { useI18n } from "./i18n";

export function useActivityStudentActions(courseId: string, activityId: string, groupId: string | undefined, onChanged: () => Promise<void>) {
  const { locale, t } = useI18n(), dialogs = useDialogs(), notifications = useNotifications();
  const [actions, setActions] = useState<ActivityStudentAction[]>([]), [busy, setBusy] = useState<string | null>(null);
  const running = useRef(false), issueSignature = useRef("");
  const scope = `${courseId}:${activityId}:${groupId ?? ""}`, currentScope = useRef(scope);
  currentScope.current = scope;
  const load = useCallback(async (signal?: AbortSignal) => {
    const result = await api.activityStudentActions(courseId, activityId, groupId, signal);
    if (signal?.aborted) return;
    setActions(result.actions);
    const signature = JSON.stringify(result.issues);
    if (result.issues.length && signature !== issueSignature.current) notifications.error(result.issues.join("\n"));
    issueSignature.current = signature;
  }, [courseId, activityId, groupId, notifications]);
  useEffect(() => {
    const controller = new AbortController(); let fetching = false, notified = false;
    setActions([]);
    const refresh = async () => {
      if (fetching || document.visibilityState !== "visible") return;
      fetching = true;
      try { await load(controller.signal); notified = false; }
      catch (error) { if (!controller.signal.aborted && !notified) { notifications.error(error instanceof Error ? error.message : t("courseDetail.loadError")); notified = true; } }
      finally { fetching = false; }
    };
    void refresh(); const interval = window.setInterval(() => void refresh(), 10_000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [load, notifications, t]);
  const execute = async (action: ActivityStudentAction) => {
    if (running.current) return;
    running.current = true;
    const label = action.labels[locale] ?? action.labels.en;
    try {
      const reason = await dialogs.prompt({ title: label, message: action.messages[locale] ?? action.messages.en,
        inputLabel: action.reasonLabels[locale] ?? action.reasonLabels.en, required: true, maxLength: 2000, confirmLabel: label });
      if (!reason?.trim() || currentScope.current !== scope) return;
      setBusy(label);
      await api.executeActivityStudentAction(courseId, activityId, { actionId: action.id, targetId: action.targetId, participantId: action.participantId, groupId: action.groupId, reason });
      if (currentScope.current === scope) await Promise.all([load(), onChanged()]);
    } catch (error) { notifications.error(error instanceof Error ? error.message : t("courseDetail.loadError")); }
    finally { running.current = false; setBusy(null); }
  };
  return { actions, execute, busy: busy !== null,
    progress: <ProgressDialog open={busy !== null} title={busy ?? ""} progressLabel={t("common.operationProgress")} /> };
}
