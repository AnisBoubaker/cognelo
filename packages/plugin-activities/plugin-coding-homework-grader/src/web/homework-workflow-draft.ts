"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActivityReferenceAuthoring, useApplicationTime, useNotifications, type AiModelConnectionOption } from "@cognelo/activity-ui";
import type { AiModelSelection } from "@cognelo/contracts";
import { homeworkWorkflowDraftSchema, type HomeworkWorkflowDraftInput } from "../workflow-contract";
import { defaultHomeworkSubmissionPolicy, type HomeworkSubmissionPolicy } from "../submission-policy";
import { homeworkDeadlineDraft, homeworkDeadlinePolicy, type HomeworkDeadlineDraft } from "./homework-deadline-settings";
import { homeworkWorkflowCopy } from "./workflow-copy";
import type { CodingHomeworkLocale } from "./messages";
import type { HomeworkRequest } from "./workflow-types";

type Settings = { questionGenerationEnabled: boolean; submissionPolicy: HomeworkSubmissionPolicy; questionPolicyLocked: boolean; enabled: boolean; prepared: boolean; concurrency: number;
  ai: { connections: AiModelConnectionOption[]; question: { selection: AiModelSelection | null; resolved: { model: string } | null; error: string | null } } };
type Draft = { questionAi: AiModelSelection | null; concurrency: string; enabled: boolean; deadline: HomeworkDeadlineDraft };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const draftFor = (settings: Settings, timeZone: string): Draft => ({ questionAi: settings.ai.question.selection, concurrency: String(settings.concurrency), enabled: settings.enabled, deadline: homeworkDeadlineDraft(settings.submissionPolicy ?? defaultHomeworkSubmissionPolicy, timeZone) });

/** One draft and saved baseline for all course-only controls in the main editor. */
export function useHomeworkWorkflowDraft(request: HomeworkRequest | undefined, locale: CodingHomeworkLocale, managementRevision: number) {
  const { timeZone } = useApplicationTime(), references = useActivityReferenceAuthoring(), notifications = useNotifications(), copy = homeworkWorkflowCopy(locale);
  const [settings, setSettings] = useState<Settings | null>(null), [draft, setDraft] = useState<Draft | null>(null), [saved, setSaved] = useState<Draft | null>(null);
  const dirty = !same(draft, saved), dirtyRef = useRef(dirty), version = useRef(0);
  dirtyRef.current = dirty;
  const report = useCallback((error: unknown) => notifications.error(error instanceof Error ? error.message : copy.error), [copy.error, notifications]);
  const refresh = useCallback(async (adopt = false) => {
    if (!request) return;
    const id = ++version.current, data = await request<Settings>("workflow-settings");
    if (id !== version.current) return;
    setSettings(data);
    if (adopt || !dirtyRef.current) { const next = draftFor(data, timeZone); setDraft(next); setSaved(next); }
  }, [request, timeZone]);
  useEffect(() => { const requests = version; setSettings(null); setDraft(null); setSaved(null); void refresh(true).catch(report); return () => { requests.current++; }; }, [refresh, report]);
  useEffect(() => {
    const focus = () => { if (!document.hidden) void refresh().catch(report); };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    return () => { window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [refresh, report]);
  useEffect(() => { if (managementRevision || references?.loaded) void refresh().catch(report); }, [managementRevision, references?.revision, references?.loaded, refresh, report]);
  const update = useCallback((changes: Partial<Draft>) => setDraft(current => current ? { ...current, ...changes } : current), []);
  const discard = useCallback(() => setDraft(saved), [saved]);
  const changes = useCallback((modeChanged: boolean): HomeworkWorkflowDraftInput | undefined => {
    if (!request) return;
    if (!draft || !saved) throw new Error(copy.loading);
    const result: HomeworkWorkflowDraftInput = {};
    if (!same(draft.questionAi, saved.questionAi)) result.questionGenerationAi = draft.questionAi;
    if (draft.concurrency !== saved.concurrency) result.concurrency = Number(draft.concurrency);
    if (modeChanged || draft.enabled !== saved.enabled) result.enabled = draft.enabled;
    if (!same(draft.deadline, saved.deadline)) result.submissionPolicy = homeworkDeadlinePolicy(draft.deadline, timeZone, locale);
    return homeworkWorkflowDraftSchema.parse(result);
  }, [draft, saved, request, copy.loading, timeZone, locale]);
  const acceptSaved = useCallback(async () => {
    setSaved(draft);
    // Saving has committed; a transient metadata refresh failure must not turn it
    // into an apparent failed save. Retain the known persisted draft and allow retry.
    await refresh(true).catch(report);
  }, [draft, refresh, report]);
  return { settings, draft, dirty, update, discard, changes, acceptSaved, refresh, report, timeZone, references };
}
export type HomeworkWorkflowDraft = ReturnType<typeof useHomeworkWorkflowDraft>;
