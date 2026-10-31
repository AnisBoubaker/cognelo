"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiGradingRunSummary } from "@cognelo/contracts";
import { api } from "./api";
import { useI18n } from "./i18n";
import { useNotifications } from "@cognelo/activity-ui";

type Input = { attemptIds: string[]; instructions?: string; templateAttemptIds?: string[] };
export function useAiGradingRun(courseId: string, activityId: string, onChanged: () => Promise<void>) {
  const [run, setRun] = useState<AiGradingRunSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const scope = `${courseId}:${activityId}`;
  const scopeRef = useRef(scope);
  const executing = useRef<string | null>(null);
  const interrupted = useRef<string | null>(null);
  const finished = useRef(new Set<string>());
  const onChangedRef = useRef(onChanged); onChangedRef.current = onChanged;
  const { t } = useI18n(); const notifications = useNotifications();
  const accept = useCallback((next: AiGradingRunSummary | null) => {
    if (!mounted.current || (next && finished.current.has(next.id))) return;
    if (next && ["completed", "discarded"].includes(next.status)) {
      executing.current = null; interrupted.current = null; setRun(null);
      if (!finished.current.has(next.id)) {
        finished.current.add(next.id);
        void onChangedRef.current().catch(() => {});
        notifications.success(t(next.status === "completed" ? "courseDetail.aiFeedbackGenerated" : "aiGrading.discarded"));
      }
    } else setRun(current => !next || (current?.id === next.id && current.status === "review" && next.status === "running") ? current : next);
  }, [notifications, t]);

  useEffect(() => {
    mounted.current = true;
    if (scopeRef.current !== scope) {
      scopeRef.current = scope; setRun(null); setError(""); setBusy(false);
      interrupted.current = null; executing.current = null;
    }
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const recover = async () => {
      try { const result = await api.pendingAiGradingRun(courseId, activityId); if (active) accept(result.run); }
      catch { if (active) retry = setTimeout(() => void recover(), 3000); }
    };
    void recover();
    return () => { active = false; clearTimeout(retry); mounted.current = false; executing.current = null; requestController.current?.abort(); };
  }, [courseId, activityId, scope, accept]);

  const runId = run?.id;
  useEffect(() => {
    if (!runId) return;
    let active = true; let polling = false; let lastHeartbeat = 0;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const action = interrupted.current === runId ? "interrupt"
          : executing.current === runId && Date.now() - lastHeartbeat >= 10_000 ? "heartbeat" : null;
        if (action === "heartbeat") lastHeartbeat = Date.now();
        const result = action ? await api.actOnAiGradingRun(courseId, runId, action) : await api.aiGradingRun(courseId, runId);
        if (active) { accept(result.run); if (action === "interrupt") interrupted.current = null; }
      } catch {
        if (executing.current === runId) { interrupted.current = runId; executing.current = null; }
        if (active) setError(t("aiGrading.connectionLost"));
      } finally { polling = false; }
    };
    const timer = setInterval(() => void poll(), 3000);
    return () => { active = false; clearInterval(timer); };
  }, [runId, courseId, accept, t]); // Keep the heartbeat schedule stable while progress changes.

  const start = async (input: Input) => {
    setError(""); setBusy(true);
    let id: string | null = null;
    try {
      const created = await api.createAiGradingRun(courseId, activityId, input);
      if (scopeRef.current !== scope || !mounted.current) return;
      id = created.run.id; executing.current = id; accept(created.run); setBusy(false);
      for (const student of created.run.students) {
        if (!mounted.current || executing.current !== id) return;
        requestController.current = new AbortController();
        const result = await api.processAiGradingRunAttempt(courseId, id, student.attemptId, requestController.current.signal);
        if (executing.current !== id || !mounted.current) return;
        accept(result.run);
        if (result.run.status !== "running") { executing.current = null; return; }
      }
      if (executing.current === id && mounted.current) {
        setFinalizing(true); setBusy(true);
        try { accept((await api.actOnAiGradingRun(courseId, id, "finish")).run); }
        finally { setBusy(false); setFinalizing(false); }
      }
    } catch (err) {
      if (id && executing.current !== id) return;
      executing.current = null;
      if (mounted.current) setError(err instanceof Error ? err.message : t("courseDetail.aiFeedbackError"));
      if (id) {
        interrupted.current = id;
        try { accept((await api.actOnAiGradingRun(courseId, id, "interrupt")).run); interrupted.current = null; } catch { /* The polling recovery retains this decision. */ }
      } else {
        try { accept((await api.pendingAiGradingRun(courseId, activityId)).run); } catch { /* Preserve the error. */ }
      }
    } finally { if (mounted.current && !id) setBusy(false); setFinalizing(false); }
  };
  const act = async (action: "cancel" | "keep" | "discard") => {
    if (!run || busy) return;
    executing.current = null;
    requestController.current?.abort();
    if (action === "cancel") interrupted.current = run.id;
    setBusy(true); setError("");
    try { accept((await api.actOnAiGradingRun(courseId, run.id, action)).run); interrupted.current = null; }
    catch (err) { setError(err instanceof Error ? err.message : t("courseDetail.aiFeedbackError")); }
    finally { setBusy(false); }
  };
  return { run, busy, finalizing, error, start, act };
}
