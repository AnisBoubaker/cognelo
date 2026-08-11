"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor, CodeRenderer, EditActionBar, KnowledgeGenerationModeField, MarkdownRenderer, codeLanguageOptions, getEditActionBarCopy, normalizeCodeLanguage, useActivityKnowledgeGeneration, useNotifications, useUnsavedChangesGuard, type ActivityKnowledgeGenerationRequest, type GeneratedKnowledgeSelection } from "@cognelo/activity-ui";
import {
  createParsonsGroup,
  createParsonsPrecedenceRule,
  evaluateParsonsSolution,
  getSolutionLines,
  parseParsonsConfig,
  rebaseParsonsGroupsOnSolutionChange,
  removeParsonsGroup,
  removeParsonsGroupDependencies,
  resetParsonsBlocks,
  type ParsonsBlock,
  type ParsonsGroup,
  type ParsonsPrecedenceRule
} from "../parsons";
import { buildParsonsAttemptState, createInitialParsonsAttemptState, type ParsonsAttemptEvaluation } from "../attempt-types";

type ActivityLike = {
  id: string;
  title: string;
  description: string;
  config?: Record<string, unknown>;
  assignment?: {
    id: string;
    metadata?: Record<string, unknown>;
  };
};

type CourseLike = {
  id?: string;
  title: string;
};

type ParsonsAttemptStateLike = ReturnType<typeof createInitialParsonsAttemptState>;

type ParsonsAttemptLike = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  lastInteractionAt: string;
  completedAt: string | null;
  latestState: ParsonsAttemptStateLike;
};

type ParsonsAttemptAvailability = {
  canStart: boolean;
  reason: string | null;
};

type ParsonsSubmissionReview = {
  attempt: ParsonsAttemptLike;
  grade: {
    rawScore: number;
    rawMaxScore: number;
    normalizedScore: number;
    normalizedMaxScore: number;
  } | null;
};

type ParsonsAttemptsClient = {
  ensureAttempt: (
    activityId: string,
    courseId: string,
    input?: { forceNew?: boolean }
  ) => Promise<{ attempt: ParsonsAttemptLike; attemptAvailability?: ParsonsAttemptAvailability }>;
  listSubmissions?: (activityId: string, courseId: string) => Promise<{ submissions: ParsonsSubmissionReview[] }>;
  updateAttempt: (
    activityId: string,
    courseId: string,
    input: {
      attemptId: string;
      state?: ParsonsAttemptStateLike;
      event?: { type: "move" | "indent" | "reset" | "check" | "submit"; payload?: Record<string, unknown> };
      result?: ParsonsAttemptEvaluation;
      submit?: boolean;
      complete?: boolean;
      abandon?: boolean;
    }
  ) => Promise<{ attempt: ParsonsAttemptLike }>;
};

type ParsonsActivityViewProps = {
  activity: ActivityLike;
  course: CourseLike | null;
  canManage: boolean;
  onSave: (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<ActivityLike>;
  attemptsClient?: ParsonsAttemptsClient;
  studentViewMode?: "attempt" | "previous";
  deferSubmission?: boolean;
  onNewAttemptAvailabilityChange?: (canStartNewAttempt: boolean) => void;
  onPreviousSubmissionsAvailabilityChange?: (hasPreviousSubmissions: boolean) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale?: "en" | "fr" | "zh" | "ar";
  aiGenerationClient?: {
    generate: (input: { description: string; language: string; locale: "en" | "fr" | "zh" | "ar"; knowledge: ActivityKnowledgeGenerationRequest }) => Promise<
      | {
          status?: "ok" | "warning";
          warningMessage?: string;
          prompt: string;
          solution: string;
          attempts: number;
          knowledgeConceptSelections?: GeneratedKnowledgeSelection[];
        }
      | {
          status: "error";
          message: string;
          attempts: number;
        }
    >;
  };
};

type ParsonsAuthoringSnapshot = {
  title: string;
  description: string;
  prompt: string;
  solution: string;
  language: string;
  stripIndentation: boolean;
  groups: ParsonsGroup[];
  precedenceRules: ParsonsPrecedenceRule[];
};

export function ParsonsActivityView({
  activity,
  course,
  canManage,
  onSave,
  attemptsClient,
  studentViewMode = "attempt",
  deferSubmission = false,
  onNewAttemptAvailabilityChange,
  onPreviousSubmissionsAvailabilityChange,
  t,
  locale = "en",
  aiGenerationClient
}: ParsonsActivityViewProps) {
  const actionCopy = getEditActionBarCopy(locale);
  const notifications = useNotifications();
  const knowledgeGeneration = useActivityKnowledgeGeneration();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [solution, setSolution] = useState("");
  const [language, setLanguage] = useState("python");
  const [stripIndentation, setStripIndentation] = useState(false);
  const [groups, setGroups] = useState<ParsonsGroup[]>([]);
  const [precedenceRules, setPrecedenceRules] = useState<ParsonsPrecedenceRule[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<ParsonsAuthoringSnapshot>(() => parsonsSnapshotFromActivity(activity));
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [precedenceDraft, setPrecedenceDraft] = useState<{ beforeGroupId: string; afterGroupId: string } | null>(null);
  const [blocks, setBlocks] = useState<ParsonsBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showReplaceGenerationDialog, setShowReplaceGenerationDialog] = useState(false);
  const [attempt, setAttempt] = useState<ParsonsAttemptLike | null>(null);
  const [previousSubmissions, setPreviousSubmissions] = useState<ParsonsSubmissionReview[]>([]);
  const attemptRef = useRef<ParsonsAttemptLike | null>(null);
  const blocksRef = useRef<ParsonsBlock[]>([]);
  const selectedBlockIdRef = useRef<string | null>(null);

  const solutionLines = getSolutionLines(solution);
  const isInstrumentedStudentSession = Boolean(attemptsClient && course?.id && !canManage);
  const assessmentMode = activity.assignment?.metadata?.assessmentMode === "summative" ? "summative" : "formative";
  const isSummativeStudentSession = isInstrumentedStudentSession && assessmentMode === "summative";
  const isReadOnlyStudentAttempt = isSummativeStudentSession && attempt?.status === "completed";
  const activityConfigKey = useMemo(() => JSON.stringify(activity.config ?? {}), [activity.config]);

  useEffect(() => {
    const config = parseParsonsConfig(activity.config);
    setTitle(activity.title);
    setDescription(activity.description);
    setPrompt(config.prompt);
    setSolution(config.solution);
    setLanguage(normalizeCodeLanguage(config.language));
    setStripIndentation(config.stripIndentation);
    setGroups(config.groups);
    setPrecedenceRules(config.precedenceRules);
    setSavedSnapshot(parsonsSnapshotFromActivity(activity));
    setSelectedLines([]);
    setSelectedGroupId(null);
    setPrecedenceDraft(null);
    setBlocks(resetParsonsBlocks(config));
    setSelectedBlockId(null);
    setFeedback("");
    setAttempt(null);
    setPreviousSubmissions([]);
    setError("");
    setGenerating(false);
    setShowReplaceGenerationDialog(false);
  }, [activity.id, activity.title, activity.description, activityConfigKey]);

  useEffect(() => {
    if (selectedGroupId && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    selectedBlockIdRef.current = selectedBlockId;
  }, [selectedBlockId]);

  useEffect(() => {
    if (!isInstrumentedStudentSession || !course?.id || !attemptsClient) {
      setAttempt(null);
      return;
    }

    let cancelled = false;
    setError("");

    Promise.all([
      attemptsClient.ensureAttempt(activity.id, course.id),
      isSummativeStudentSession && attemptsClient.listSubmissions ? attemptsClient.listSubmissions(activity.id, course.id) : Promise.resolve({ submissions: [] })
    ])
      .then(([attemptResult, submissionsResult]) => {
        if (cancelled) {
          return;
        }
        const { attempt } = attemptResult;
        setAttempt(attempt);
        onNewAttemptAvailabilityChange?.(attemptResult.attemptAvailability?.canStart ?? attempt.status !== "completed");
        onPreviousSubmissionsAvailabilityChange?.(submissionsResult.submissions.length > 0);
        setPreviousSubmissions(submissionsResult.submissions);
        setBlocks(attempt.latestState.blocks);
        setSelectedBlockId(attempt.latestState.selectedBlockId ?? null);
        setFeedback(isSummativeStudentSession ? "" : attempt.latestState.lastEvaluation ? formatFeedback(attempt.latestState.lastEvaluation) : "");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("parsons.attemptLoadError"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activity.id, attemptsClient, course?.id, isInstrumentedStudentSession, isSummativeStudentSession, t]);

  function buildAttemptStateSnapshot(nextBlocks: ParsonsBlock[], nextSelectedBlockId: string | null, lastEvaluation?: ParsonsAttemptEvaluation | null) {
    return buildParsonsAttemptState(parseParsonsConfig(activity.config), nextBlocks, nextSelectedBlockId, lastEvaluation);
  }

  function formatFeedback(result: ParsonsAttemptEvaluation) {
    if (result.isCorrect) {
      return t("parsons.correct");
    }

    const parts = [];
    if (!result.orderCorrect) {
      parts.push(t("parsons.orderFeedback", { count: result.misplacedBlocks }));
    }
    if (!result.indentationCorrect && stripIndentation) {
      parts.push(t("parsons.indentFeedback", { count: result.incorrectIndents }));
    }
    return parts.join(" ");
  }

  async function persistAttemptUpdate(input: {
    state?: ParsonsAttemptStateLike;
    event?: { type: "move" | "indent" | "reset" | "check" | "submit"; payload?: Record<string, unknown> };
    result?: ParsonsAttemptEvaluation;
    submit?: boolean;
    complete?: boolean;
    forceNew?: boolean;
  }) {
    if (!isInstrumentedStudentSession || !course?.id || !attemptsClient) {
      return null;
    }

    try {
      let currentAttempt = attemptRef.current;
      if (!currentAttempt || input.forceNew) {
        const ensured = await attemptsClient.ensureAttempt(activity.id, course.id, { forceNew: Boolean(input.forceNew) });
        currentAttempt = ensured.attempt;
        setAttempt(ensured.attempt);
      }

      if (!currentAttempt) {
        return null;
      }

      const result = await attemptsClient.updateAttempt(activity.id, course.id, {
        attemptId: currentAttempt.id,
        state: input.state,
        event: input.event,
        result: input.result,
        submit: input.submit,
        complete: input.complete
      });
      setAttempt(result.attempt);
      return result.attempt;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parsons.attemptSaveError"));
      return null;
    }
  }

  const currentSnapshot = useMemo(
    () => buildParsonsSnapshot({ title, description, prompt, solution, language, stripIndentation, groups, precedenceRules }),
    [description, groups, language, precedenceRules, prompt, solution, stripIndentation, title]
  );
  const hasUnsavedChanges = canManage && !parsonsSnapshotsEqual(currentSnapshot, savedSnapshot);

  const discardChanges = useCallback(() => {
    setTitle(savedSnapshot.title);
    setDescription(savedSnapshot.description);
    setPrompt(savedSnapshot.prompt);
    setSolution(savedSnapshot.solution);
    setLanguage(savedSnapshot.language);
    setStripIndentation(savedSnapshot.stripIndentation);
    setGroups(savedSnapshot.groups);
    setPrecedenceRules(savedSnapshot.precedenceRules);
    setError("");
  }, [savedSnapshot]);

  const saveParsonsChanges = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const nextActivity = await onSave({
        title,
        description,
        config: {
          prompt,
          solution,
          language,
          stripIndentation,
          groups,
          precedenceRules
        }
      });
      const savedConfig = parseParsonsConfig(nextActivity.config);
      setGroups(savedConfig.groups);
      setPrecedenceRules(savedConfig.precedenceRules);
      setSavedSnapshot(parsonsSnapshotFromActivity(nextActivity));
      setBlocks(resetParsonsBlocks(savedConfig));
      setSelectedBlockId(null);
      notifications.success(t("parsons.saved"));
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("parsons.saveError"));
      setError("");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [description, groups, language, notifications, onSave, precedenceRules, prompt, solution, stripIndentation, t, title]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedChanges,
        onSave: saveParsonsChanges,
        onDiscard: discardChanges
      }),
      [discardChanges, hasUnsavedChanges, saveParsonsChanges]
    )
  );

  async function saveParsonsProblem(event: FormEvent) {
    event.preventDefault();
    await saveParsonsChanges();
  }

  function requestParsonsGeneration() {
    if (!aiGenerationClient) {
      return;
    }
    if (description.trim().length < 10) {
      notifications.error(t("parsons.generateDescriptionRequired"));
      return;
    }
    if (prompt.trim().length > 0 || solution.trim().length > 0) {
      setShowReplaceGenerationDialog(true);
      return;
    }

    void generateParsonsProblem();
  }

  async function generateParsonsProblem() {
    if (!aiGenerationClient) {
      return;
    }

    setGenerating(true);
    setShowReplaceGenerationDialog(false);
    setError("");
    try {
      const result = await aiGenerationClient.generate({
        description,
        language,
        locale,
        knowledge: knowledgeGeneration.request
      });

      if (result.status === "error") {
        notifications.error(result.message);
        return;
      }

      setPrompt(result.prompt);
      handleSolutionChange(result.solution);
      setSelectedLines([]);
      setSelectedGroupId(null);
      setSelectedBlockId(null);
      setPrecedenceDraft(null);
      setFeedback("");
      setGroups([]);
      setPrecedenceRules([]);
      setBlocks(
        resetParsonsBlocks(
          parseParsonsConfig({ prompt: result.prompt, solution: result.solution, language, stripIndentation, groups: [], precedenceRules: [] })
        )
      );
      knowledgeGeneration.applySelections(result.knowledgeConceptSelections);

      if (result.status === "warning") {
        notifications.warning(result.warningMessage || t("parsons.generatedWithWarning"));
      } else {
        notifications.success(result.attempts > 1 ? `${t("parsons.generated")} (${result.attempts})` : t("parsons.generated"));
      }
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("parsons.generateError"));
    } finally {
      setGenerating(false);
    }
  }

  function moveBlock(index: number, direction: -1 | 1) {
    if (isReadOnlyStudentAttempt) {
      return;
    }
    const currentBlocks = blocksRef.current;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= currentBlocks.length) {
      return;
    }

    const nextBlocks = [...currentBlocks];
    [nextBlocks[index], nextBlocks[nextIndex]] = [nextBlocks[nextIndex], nextBlocks[index]];
    setBlocks(nextBlocks);

    const movedBlock = nextBlocks[nextIndex];
    void persistAttemptUpdate({
      state: buildAttemptStateSnapshot(nextBlocks, selectedBlockIdRef.current),
      event: {
        type: "move",
        payload: {
          blockId: movedBlock?.id ?? null,
          direction,
          fromIndex: index,
          toIndex: nextIndex
        }
      }
    });
  }

  function moveSelectedBlock(direction: -1 | 1) {
    if (!selectedBlockId) {
      return;
    }
    const index = blocks.findIndex((block) => block.id === selectedBlockId);
    if (index !== -1) {
      moveBlock(index, direction);
    }
  }

  function adjustIndent(index: number, direction: -1 | 1) {
    if (isReadOnlyStudentAttempt) {
      return;
    }
    const currentBlocks = blocksRef.current;
    const nextBlocks = currentBlocks.map((block, currentIndex) =>
      currentIndex === index ? { ...block, currentIndent: Math.max(0, Math.min(6, block.currentIndent + direction)) } : block
    );
    setBlocks(nextBlocks);

    void persistAttemptUpdate({
      state: buildAttemptStateSnapshot(nextBlocks, selectedBlockIdRef.current),
      event: {
        type: "indent",
        payload: {
          blockId: nextBlocks[index]?.id ?? null,
          direction,
          nextIndent: nextBlocks[index]?.currentIndent ?? 0
        }
      }
    });
  }

  function adjustSelectedIndent(direction: -1 | 1) {
    if (!selectedBlockId) {
      return;
    }
    const index = blocks.findIndex((block) => block.id === selectedBlockId);
    if (index !== -1) {
      adjustIndent(index, direction);
    }
  }

  async function resetWorkspace() {
    if (isReadOnlyStudentAttempt) {
      return;
    }
    const config = parseParsonsConfig(activity.config);
    const nextBlocks = resetParsonsBlocks(config);
    setBlocks(nextBlocks);
    setSelectedBlockId(null);
    setFeedback("");
    const attemptStatus = attemptRef.current?.status;
    await persistAttemptUpdate({
      forceNew: attemptStatus === "completed",
      state: buildAttemptStateSnapshot(nextBlocks, null),
      event: { type: "reset", payload: { completedReplay: attemptStatus === "completed" } }
    });
  }

  function checkSolution() {
    if (isReadOnlyStudentAttempt) {
      return;
    }
    const result = evaluateParsonsSolution(blocksRef.current, parseParsonsConfig(activity.config));
    const nextFeedback = formatFeedback(result);
    setFeedback(nextFeedback);
    if (result.isCorrect) {
      notifications.success(nextFeedback);
    } else {
      notifications.info(nextFeedback);
    }

    void persistAttemptUpdate({
      state: buildAttemptStateSnapshot(blocksRef.current, selectedBlockIdRef.current, result),
      event: {
        type: "check",
        payload: {
          isCorrect: result.isCorrect,
          misplacedBlocks: result.misplacedBlocks,
          incorrectIndents: result.incorrectIndents
        }
      },
      result,
      complete: false
    });
  }

  function submitSolution() {
    if (isReadOnlyStudentAttempt) {
      return;
    }
    const result = evaluateParsonsSolution(blocksRef.current, parseParsonsConfig(activity.config));
    if (!isSummativeStudentSession) {
      const nextFeedback = formatFeedback(result);
      setFeedback(nextFeedback);
      if (result.isCorrect) {
        notifications.success(nextFeedback);
      } else {
        notifications.info(nextFeedback);
      }
    }

    void persistAttemptUpdate({
      state: buildAttemptStateSnapshot(blocksRef.current, selectedBlockIdRef.current, result),
      event: {
        type: "submit",
        payload: {
          isCorrect: result.isCorrect,
          misplacedBlocks: result.misplacedBlocks,
          incorrectIndents: result.incorrectIndents
        }
      },
      result,
      submit: true,
      complete: true
    });
  }

  function toggleSelectedLine(lineIndex: number) {
    setSelectedLines((current) =>
      current.includes(lineIndex) ? current.filter((value) => value !== lineIndex) : [...current, lineIndex].sort((a, b) => a - b)
    );
  }

  function handleSolutionChange(nextSolution: string) {
    setGroups((current) => rebaseParsonsGroupsOnSolutionChange(solution, nextSolution, current));
    setSolution(nextSolution);
  }

  function createGroupFromSelection() {
    const nextGroup = createParsonsGroup(selectedLines, solutionLines.length);
    if (!nextGroup) {
      setError(t("parsons.groupSelectionError"));
      return;
    }
    if (groups.some((group) => !(nextGroup.endLine < group.startLine || nextGroup.startLine > group.endLine))) {
      setError(t("parsons.groupOverlapError"));
      return;
    }

    setGroups((current) => [...current, { ...nextGroup, label: t("parsons.newGroupLabel", { count: current.length + 1 }) }]);
    setSelectedGroupId(nextGroup.id);
    setSelectedLines([]);
    setError("");
  }

  function updateGroup(groupId: string, patch: Partial<ParsonsGroup>) {
    setGroups((current) => current.map((group) => (group.id === groupId ? { ...group, ...patch } : group)));
  }

  function deleteGroup(groupId: string) {
    setGroups((current) => removeParsonsGroup(current, groupId));
    setPrecedenceRules((current) => removeParsonsGroupDependencies(current, groupId));
    setSelectedGroupId((current) => (current === groupId ? null : current));
    setPrecedenceDraft((current) =>
      current && (current.beforeGroupId === groupId || current.afterGroupId === groupId) ? null : current
    );
  }

  function startPrecedenceRule() {
    if (groups.length < 2) {
      return;
    }
    setPrecedenceDraft({
      beforeGroupId: groups[0]?.id ?? "",
      afterGroupId: groups[1]?.id ?? groups[0]?.id ?? ""
    });
  }

  function savePrecedenceRule() {
    if (!precedenceDraft || !precedenceDraft.beforeGroupId || !precedenceDraft.afterGroupId) {
      return;
    }
    if (precedenceDraft.beforeGroupId === precedenceDraft.afterGroupId) {
      setError(t("parsons.precedenceSelectionError"));
      return;
    }

    setPrecedenceRules((current) => [
      ...current.filter(
        (rule) => !(rule.beforeGroupId === precedenceDraft.beforeGroupId && rule.afterGroupId === precedenceDraft.afterGroupId)
      ),
      createParsonsPrecedenceRule(precedenceDraft.beforeGroupId, precedenceDraft.afterGroupId)
    ]);
    setPrecedenceDraft(null);
    setError("");
  }

  function deletePrecedenceRule(ruleId: string) {
    setPrecedenceRules((current) => current.filter((rule) => rule.id !== ruleId));
  }

  useEffect(() => {
    if (!selectedBlockId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelectedBlock(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelectedBlock(1);
      } else if (stripIndentation && event.key === "ArrowLeft") {
        event.preventDefault();
        adjustSelectedIndent(-1);
      } else if (stripIndentation && event.key === "ArrowRight") {
        event.preventDefault();
        adjustSelectedIndent(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blocks, selectedBlockId, stripIndentation]);

  return (
    <>
      {error ? <p className="error">{error}</p> : null}

      {canManage ? (
        <section className="section stack">
          <div>
            <p className="eyebrow">{t("parsons.authoringEyebrow")}</p>
            <h2>{t("parsons.authoringTitle")}</h2>
          </div>
          <form className="form" onSubmit={saveParsonsProblem}>
            <div className="field">
              <label htmlFor="activity-title">{t("parsons.activityTitle")}</label>
              <input id="activity-title" minLength={2} required value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="parsons-language">{t("parsons.language")}</label>
              <select id="parsons-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                {codeLanguageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="activity-description">{t("parsons.activityDescription")}</label>
              <textarea id="activity-description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            {aiGenerationClient ? (
              <div className="stack" style={{ gap: 8 }}>
                <KnowledgeGenerationModeField locale={locale} />
                <button className="secondary" disabled={generating || description.trim().length < 10} type="button" onClick={requestParsonsGeneration}>
                  {generating ? t("parsons.generating") : t("parsons.generate")}
                </button>
                <p className="muted">{t("parsons.generateHelp")}</p>
              </div>
            ) : null}

            {showReplaceGenerationDialog ? (
              <div className="dialog-backdrop" role="presentation">
                <div aria-modal="true" className="dialog-panel" role="dialog" aria-labelledby="parsons-ai-replace-title">
                  <div className="stack" style={{ gap: 8 }}>
                    <p className="eyebrow">{t("parsons.generate")}</p>
                    <h2 id="parsons-ai-replace-title">{t("parsons.replaceGeneratedTitle")}</h2>
                    <p className="muted">{t("parsons.replaceGeneratedMessage")}</p>
                  </div>
                  <div className="dialog-actions">
                    <button className="secondary" type="button" onClick={() => setShowReplaceGenerationDialog(false)}>
                      {t("parsons.keepCurrentGenerated")}
                    </button>
                    <button type="button" onClick={() => void generateParsonsProblem()}>
                      {t("parsons.replaceCurrentGenerated")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="parsons-prompt">{t("parsons.prompt")}</label>
              <textarea id="parsons-prompt" required value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="parsons-solution">{t("parsons.solution")}</label>
              <CodeEditor
                id="parsons-solution"
                language={language}
                leftRail={renderSelectionRail(solutionLines, groups, selectedLines, toggleSelectedLine, t)}
                leftRailWidth={26}
                minHeight={260}
                onChange={handleSolutionChange}
                rightRail={renderGroupRail(solutionLines, groups, selectedGroupId, setSelectedGroupId)}
                rightRailWidth={180}
                value={solution}
              />
            </div>
            <label className="checkbox-row">
              <input checked={stripIndentation} type="checkbox" onChange={(event) => setStripIndentation(event.target.checked)} />
              <span>{t("parsons.stripIndentation")}</span>
            </label>
            <section className="inline-panel stack">
              <div className="row wrap parsons-group-toolbar">
                <div className="stack stack-tight">
                  <p className="eyebrow">{t("parsons.groupsEyebrow")}</p>
                  <h3>{t("parsons.groupsTitle")}</h3>
                  <p className="muted">{t("parsons.groupsText")}</p>
                </div>
                <div className="row wrap">
                  <button className="secondary" type="button" onClick={createGroupFromSelection}>
                    {t("parsons.createGroup")}
                  </button>
                  <button className="secondary" disabled={groups.length < 2} type="button" onClick={startPrecedenceRule}>
                    {t("parsons.addPrecedence")}
                  </button>
                </div>
              </div>

              {selectedGroupId ? (
                <div className="parsons-group-card">
                  {groups
                    .filter((group) => group.id === selectedGroupId)
                    .map((group) => (
                      <div className="stack" key={group.id}>
                        <div className="field">
                          <label htmlFor={`parsons-group-${group.id}`}>{t("parsons.groupLabel")}</label>
                          <input
                            id={`parsons-group-${group.id}`}
                            required
                            value={group.label}
                            onChange={(event) => updateGroup(group.id, { label: event.target.value })}
                          />
                        </div>
                        <label className="checkbox-row">
                          <input
                            checked={!group.orderSensitive}
                            type="checkbox"
                            onChange={(event) => updateGroup(group.id, { orderSensitive: !event.target.checked })}
                          />
                          <span>{t("parsons.groupFlexible")}</span>
                        </label>
                        <div className="row wrap">
                          <button className="secondary" type="button" onClick={() => deleteGroup(group.id)}>
                            {t("parsons.deleteGroup")}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="muted">{t("parsons.groupSelectionHint")}</p>
              )}

              <div className="stack">
                <h3>{t("parsons.precedenceTitle")}</h3>
                <p className="muted">{t("parsons.precedenceText")}</p>
                {precedenceDraft ? (
                  <div className="parsons-precedence-editor">
                    <div className="field">
                      <label htmlFor="parsons-precedence-before">{t("parsons.precedenceBefore")}</label>
                      <select
                        id="parsons-precedence-before"
                        value={precedenceDraft.beforeGroupId}
                        onChange={(event) =>
                          setPrecedenceDraft((current) => (current ? { ...current, beforeGroupId: event.target.value } : current))
                        }
                      >
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="parsons-precedence-arrow" aria-hidden="true">
                      →
                    </span>
                    <div className="field">
                      <label htmlFor="parsons-precedence-after">{t("parsons.precedenceAfter")}</label>
                      <select
                        id="parsons-precedence-after"
                        value={precedenceDraft.afterGroupId}
                        onChange={(event) =>
                          setPrecedenceDraft((current) => (current ? { ...current, afterGroupId: event.target.value } : current))
                        }
                      >
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="row wrap">
                      <button type="button" onClick={savePrecedenceRule}>
                        {t("common.save")}
                      </button>
                      <button className="secondary" type="button" onClick={() => setPrecedenceDraft(null)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}

                {precedenceRules.length > 0 ? (
                  <div className="parsons-precedence-list">
                    {precedenceRules.map((rule) => {
                      const beforeLabel = groups.find((group) => group.id === rule.beforeGroupId)?.label ?? rule.beforeGroupId;
                      const afterLabel = groups.find((group) => group.id === rule.afterGroupId)?.label ?? rule.afterGroupId;
                      return (
                        <div className="parsons-precedence-item" key={rule.id}>
                          <span>{beforeLabel}</span>
                          <span className="parsons-precedence-arrow" aria-hidden="true">
                            →
                          </span>
                          <span>{afterLabel}</span>
                          <button className="secondary icon-button" title={t("parsons.deletePrecedence")} type="button" onClick={() => deletePrecedenceRule(rule.id)}>
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">{t("parsons.noPrecedenceRules")}</p>
                )}
              </div>
            </section>
            <EditActionBar
              isDirty={hasUnsavedChanges}
              isSaving={saving}
              savedLabel={actionCopy.saved}
              unsavedLabel={actionCopy.unsaved}
              saveLabel={t("common.save")}
              savingLabel={t("common.saving")}
              cancelLabel={actionCopy.cancel}
              onCancel={discardChanges}
              onSave={saveParsonsChanges}
            />
          </form>
        </section>
      ) : null}

      {!canManage && previousSubmissions.length && studentViewMode === "previous" ? (
        <section className="section stack">
          <div>
            <p className="eyebrow">{t("parsons.previousSubmissionsTitle")}</p>
            <h2>{t("parsons.previousSubmissionsTitle")}</h2>
          </div>
          <div className="stack">
            {previousSubmissions.map((submission) => (
              <article className="inline-panel stack" key={submission.attempt.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{t("parsons.submissionDateLabel", { date: formatSubmissionDate(submission.attempt.completedAt ?? submission.attempt.lastInteractionAt) })}</strong>
                  {submission.grade ? (
                    <span className="participant-status is-graded">
                      {t("parsons.submissionGrade")}: {formatPoints(submission.grade.normalizedScore)} / {formatPoints(submission.grade.normalizedMaxScore)}
                    </span>
                  ) : null}
                </div>
                {submission.attempt.latestState.lastEvaluation ? (
                  <p className="muted">{formatFeedback(submission.attempt.latestState.lastEvaluation)}</p>
                ) : null}
                <div className="parsons-board">
                  {submission.attempt.latestState.blocks.map((block, index) => (
                    <article className="parsons-block parsons-block-row" key={block.id}>
                      <div className="parsons-code-line parsons-code-line-compact">
                        <CodeRenderer
                          className="parsons-inline-code"
                          code={block.displayText}
                          contentOffset={block.currentIndent * 18}
                          language={language}
                          showLineNumbers
                          startingLineNumber={index + 1}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {canManage || studentViewMode === "attempt" ? (
      <section className="section stack">
          <div>
            <p className="eyebrow">{t("parsons.studentEyebrow")}</p>
            <h2>{t("parsons.studentTitle")}</h2>
            <MarkdownRenderer markdown={prompt} className="muted" compact />
            {course ? <p className="muted">{t("parsons.inCourse", { title: course.title })}</p> : null}
          </div>

        <div className="parsons-toolbar row">
          <button className="secondary" type="button" onClick={resetWorkspace} disabled={isReadOnlyStudentAttempt}>
            {t("parsons.reset")}
          </button>
          {isSummativeStudentSession && !deferSubmission ? (
            <button type="button" onClick={submitSolution} disabled={isReadOnlyStudentAttempt}>
              {t("parsons.submit")}
            </button>
          ) : !isSummativeStudentSession ? (
            <button type="button" onClick={checkSolution}>
              {t("parsons.check")}
            </button>
          ) : null}
        </div>

        <p className="muted">{t("parsons.keyboardHint")}</p>

        {feedback ? <p className="parsons-feedback">{feedback}</p> : null}

        <div className="parsons-board">
          {blocks.map((block, index) => (
            <article
              aria-pressed={selectedBlockId === block.id}
              className={`parsons-block parsons-block-row ${selectedBlockId === block.id ? "is-selected" : ""}`}
              key={block.id}
              role={isReadOnlyStudentAttempt ? undefined : "button"}
              tabIndex={isReadOnlyStudentAttempt ? undefined : 0}
              onClick={() => {
                if (!isReadOnlyStudentAttempt) {
                  setSelectedBlockId((current) => (current === block.id ? null : block.id));
                }
              }}
              onKeyDown={(event) => {
                if (isReadOnlyStudentAttempt) {
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedBlockId((current) => (current === block.id ? null : block.id));
                }
              }}
            >
              <div className="parsons-block-controls parsons-block-controls-left">
                <button
                  aria-label={t("parsons.moveUp")}
                  className="secondary icon-button"
                  disabled={isReadOnlyStudentAttempt}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedBlockId(block.id);
                    moveBlock(index, -1);
                  }}
                >
                  <ParsonsControlIcon direction="up" />
                </button>
                <button
                  aria-label={t("parsons.moveDown")}
                  className="secondary icon-button"
                  disabled={isReadOnlyStudentAttempt}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedBlockId(block.id);
                    moveBlock(index, 1);
                  }}
                >
                  <ParsonsControlIcon direction="down" />
                </button>
                {stripIndentation ? (
                  <>
                    <button
                      aria-label={t("parsons.outdent")}
                      className="secondary icon-button"
                      disabled={isReadOnlyStudentAttempt}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedBlockId(block.id);
                        adjustIndent(index, -1);
                      }}
                    >
                      <ParsonsControlIcon direction="left" />
                    </button>
                    <button
                      aria-label={t("parsons.indent")}
                      className="secondary icon-button"
                      disabled={isReadOnlyStudentAttempt}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedBlockId(block.id);
                        adjustIndent(index, 1);
                      }}
                    >
                      <ParsonsControlIcon direction="right" />
                    </button>
                  </>
                ) : null}
              </div>
              <div className="parsons-code-line parsons-code-line-compact">
                <CodeRenderer
                  className="parsons-inline-code"
                  code={block.displayText}
                  contentOffset={block.currentIndent * 18}
                  language={language}
                  showLineNumbers
                  startingLineNumber={index + 1}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
      ) : null}
    </>
  );
}

function ParsonsControlIcon({ direction }: { direction: "up" | "down" | "left" | "right" }) {
  const paths = {
    up: "M12 16V8m0 0-4 4m4-4 4 4",
    down: "M12 8v8m0 0-4-4m4 4 4-4",
    left: "M16 12H8m0 0 4-4m-4 4 4 4",
    right: "M8 12h8m0 0-4-4m4 4-4 4"
  };

  return (
    <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
      <path d={paths[direction]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function parsonsSnapshotFromActivity(activity: ActivityLike) {
  const config = parseParsonsConfig(activity.config);
  return buildParsonsSnapshot({
    title: activity.title,
    description: activity.description,
    prompt: config.prompt,
    solution: config.solution,
    language: normalizeCodeLanguage(config.language),
    stripIndentation: config.stripIndentation,
    groups: config.groups,
    precedenceRules: config.precedenceRules
  });
}

function buildParsonsSnapshot(snapshot: ParsonsAuthoringSnapshot): ParsonsAuthoringSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as ParsonsAuthoringSnapshot;
}

function parsonsSnapshotsEqual(left: ParsonsAuthoringSnapshot, right: ParsonsAuthoringSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatPoints(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatSubmissionDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderSelectionRail(
  solutionLines: string[],
  groups: ParsonsGroup[],
  selectedLines: number[],
  toggleSelectedLine: (lineIndex: number) => void,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  return (
    <div className="parsons-editor-rail parsons-editor-selection-rail">
      {solutionLines.map((_, lineIndex) => {
        const inGroup = groups.some((group) => lineIndex >= group.startLine && lineIndex <= group.endLine);
        const selected = selectedLines.includes(lineIndex);
        return (
          <button
            aria-label={t("parsons.selectLine", { line: lineIndex + 1 })}
            className={`parsons-line-marker ${selected ? "is-selected" : ""} ${inGroup ? "is-grouped" : ""}`}
            key={`marker-${lineIndex}`}
            type="button"
            onClick={() => toggleSelectedLine(lineIndex)}
          />
        );
      })}
    </div>
  );
}

function renderGroupRail(
  solutionLines: string[],
  groups: ParsonsGroup[],
  selectedGroupId: string | null,
  setSelectedGroupId: (groupId: string | null) => void
) {
  return (
    <div className="parsons-editor-rail parsons-editor-group-rail">
      <div className="parsons-editor-group-rail-inner" style={{ height: `${solutionLines.length * 21}px` }}>
        {groups.map((group) => (
          <button
            className={`parsons-group-box ${selectedGroupId === group.id ? "is-selected" : ""} ${group.orderSensitive ? "" : "is-flex"}`}
            key={group.id}
            style={{
              top: `${group.startLine * 21}px`,
              height: `${Math.max(21, (group.endLine - group.startLine + 1) * 21)}px`
            }}
            type="button"
            onClick={() => setSelectedGroupId(selectedGroupId === group.id ? null : group.id)}
          >
            <span className="parsons-group-box-line" />
            <span className="parsons-group-box-label">{group.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
