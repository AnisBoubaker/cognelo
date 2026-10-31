"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionIcon, ConfirmationDialog, useBodyScrollLock, useNotifications, useSharedDialogOpen } from "@cognelo/activity-ui";
import type { TestAiGradingInstructions } from "@cognelo/contracts";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

export function TestAiGradingInstructionsAction({ scope, ownerId, activityId, disabled, onApplied }: {
  scope: "course" | "bank"; ownerId: string; activityId: string; disabled?: boolean; onApplied?: () => Promise<void>;
}) {
  const { t } = useI18n();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [snapshot, setSnapshot] = useState<TestAiGradingInstructions | null>(null);
  const request = useRef<AbortController | null>(null);
  const sharedDialogOpen = useSharedDialogOpen();
  const inputId = useId();
  useBodyScrollLock(open);
  useEffect(() => () => { request.current?.abort(); }, [scope, ownerId, activityId]);

  async function show() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setOpen(true); setLoading(true); setSnapshot(null); setInstructions(""); setError("");
    try {
      const result = await api.testAiGradingInstructions(scope, ownerId, activityId, controller.signal);
      if (controller.signal.aborted) return;
      setSnapshot(result);
      const first = result.items[0]?.instructions ?? "";
      setInstructions(result.items.every(item => item.instructions === first) ? first : "");
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : t("testAiInstructions.error"));
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  async function replace() {
    if (!snapshot?.items.length || !instructions.trim() || saving) return;
    setSaving(true); setError("");
    try {
      const result = await api.replaceTestAiGradingInstructions(scope, ownerId, activityId, {
        instructions: instructions.trim(), expectedRevision: snapshot.revision
      });
      setOpen(false);
      notifications.success(t("testAiInstructions.updated", { count: result.updatedCount }));
      await onApplied?.();
    } catch (reason) {
      if (!(reason instanceof ApiError && reason.code === "ACTION_CANCELLED")) {
        setError(reason instanceof Error ? reason.message : t("testAiInstructions.error"));
      }
    } finally { setSaving(false); }
  }
  return <>
    <button className="button secondary" type="button" disabled={disabled} onClick={() => void show()}>
      <ActionIcon name="edit" />{t("testAiInstructions.action")}
    </button>
    {typeof document !== "undefined" ? createPortal(<ConfirmationDialog
      open={open && !sharedDialogOpen} title={t("testAiInstructions.action")}
      message={<div className="stack">
        {loading ? <p role="status">{t("common.loading")}</p> : snapshot?.items.length ? <>
          <p>{t("testAiInstructions.help", { count: snapshot.items.length })}</p>
          <ul>{snapshot.items.map(item => <li key={item.testItemId}>{item.title}</li>)}</ul>
          <label className="field" htmlFor={inputId}>
            <span>{t("testAiInstructions.label")}</span>
            <textarea id={inputId} rows={8} maxLength={8000} value={instructions} disabled={saving}
              onChange={event => setInstructions(event.target.value)} />
          </label>
          <p className="muted">{t("testAiInstructions.warning")}</p>
        </> : !error ? <p>{t("testAiInstructions.none")}</p> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
      </div>}
      confirmLabel={t(saving ? "common.saving" : "testAiInstructions.replace")} confirmIcon="save"
      cancelLabel={t("common.cancel")} confirmDisabled={loading || !snapshot?.items.length || !instructions.trim()}
      isConfirming={saving} onConfirm={() => void replace()} onCancel={() => {
        request.current?.abort(); setOpen(false);
      }}
    />, document.body) : null}
  </>;
}
