"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { CodeEditor, CodeRenderer, codeLanguageOptions, normalizeCodeLanguage } from "@cognara/activity-ui";
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
};

type CourseLike = {
  id?: string;
  title: string;
};

type ParsonsAttemptStateLike = ReturnType<typeof createInitialParsonsAttemptState>;

type ParsonsAttemptLike = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  latestState: ParsonsAttemptStateLike;
};

type ParsonsAttemptsClient = {
  ensureAttempt: (activityId: string, courseId: string, input?: { forceNew?: boolean }) => Promise<{ attempt: ParsonsAttemptLike }>;
  updateAttempt: (
    activityId: string,
    courseId: string,
    input: {
      attemptId: string;
      state?: ParsonsAttemptStateLike;
      event?: { type: "move" | "indent" | "reset" | "check"; payload?: Record<string, unknown> };
      result?: ParsonsAttemptEvaluation;
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
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export function ParsonsActivityView({ activity, course, canManage, onSave, attemptsClient, t }: ParsonsActivityViewProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [solution, setSolution] = useState("");
  const [language, setLanguage] = useState("python");
  const [stripIndentation, setStripIndentation] = useState(false);
  const [groups, setGroups] = useState<ParsonsGroup[]>([]);
  const [precedenceRules, setPrecedenceRules] = useState<ParsonsPrecedenceRule[]>([]);
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [precedenceDraft, setPrecedenceDraft] = useState<{ beforeGroupId: string; afterGroupId: string } | null>(null);
  const [blocks, setBlocks] = useState<ParsonsBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState<ParsonsAttemptLike | null>(null);
  const attemptRef = useRef<ParsonsAttemptLike | null>(null);
  const blocksRef = useRef<ParsonsBlock[]>([]);
  const selectedBlockIdRef = useRef<string | null>(null);

  const solutionLines = getSolutionLines(solution);
  const isInstrumentedStudentSession = Boolean(attemptsClient && course?.id && !canManage);

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
    setSelectedLines([]);
    setSelectedGroupId(null);
    setPrecedenceDraft(null);
    setBlocks(resetParsonsBlocks(config));
    setSelectedBlockId(null);
    setFeedback("");
    setAttempt(null);
  }, [activity]);

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

    attemptsClient
      .ensureAttempt(activity.id, course.id)
      .then(({ attempt }) => {
        if (cancelled) {
          return;
        }
        setAttempt(attempt);
        setBlocks(attempt.latestState.blocks);
        setSelectedBlockId(attempt.latestState.selectedBlockId ?? null);
        setFeedback(attempt.latestState.lastEvaluation ? formatFeedback(attempt.latestState.lastEvaluation) : "");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("parsons.attemptLoadError"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activity.id, attemptsClient, course?.id, isInstrumentedStudentSession, t]);

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
    event?: { type: "move" | "indent" | "reset" | "check"; payload?: Record<string, unknown> };
    result?: ParsonsAttemptEvaluation;
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
        complete: input.complete
      });
      setAttempt(result.attempt);
      return result.attempt;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parsons.attemptSaveError"));
      return null;
    }
  }

  async function saveParsonsProblem(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
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
      setBlocks(resetParsonsBlocks(savedConfig));
      setSelectedBlockId(null);
      setSaveMessage(t("parsons.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parsons.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function moveBlock(index: number, direction: -1 | 1) {
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
    const result = evaluateParsonsSolution(blocksRef.current, parseParsonsConfig(activity.config));
    setFeedback(formatFeedback(result));

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
      complete: result.isCorrect
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
      {saveMessage ? <p className="success-message">{saveMessage}</p> : null}

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
              <label htmlFor="activity-description">{t("parsons.activityDescription")}</label>
              <textarea id="activity-description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
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
            <div className="split parsons-authoring-grid">
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
              <label className="checkbox-row">
                <input checked={stripIndentation} type="checkbox" onChange={(event) => setStripIndentation(event.target.checked)} />
                <span>{t("parsons.stripIndentation")}</span>
              </label>
            </div>
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
            <div className="row">
              <button disabled={saving} type="submit">
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="section stack">
        <div>
          <p className="eyebrow">{t("parsons.studentEyebrow")}</p>
          <h2>{t("parsons.studentTitle")}</h2>
          <p className="muted">{prompt}</p>
          {course ? <p className="muted">{t("parsons.inCourse", { title: course.title })}</p> : null}
        </div>

        <div className="parsons-toolbar row">
          <button className="secondary" type="button" onClick={resetWorkspace}>
            {t("parsons.reset")}
          </button>
          <button type="button" onClick={checkSolution}>
            {t("parsons.check")}
          </button>
        </div>

        <p className="muted">{t("parsons.keyboardHint")}</p>

        {feedback ? <p className="parsons-feedback">{feedback}</p> : null}

        <div className="parsons-board">
          {blocks.map((block, index) => (
            <article
              aria-pressed={selectedBlockId === block.id}
              className={`parsons-block parsons-block-row ${selectedBlockId === block.id ? "is-selected" : ""}`}
              key={block.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedBlockId((current) => (current === block.id ? null : block.id))}
              onKeyDown={(event) => {
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
