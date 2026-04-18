"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CodeEditor } from "@/components/code-editor";
import { CodeRenderer, codeLanguageOptions, normalizeCodeLanguage } from "@/components/code-renderer";
import { api, Activity, Course } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  evaluateParsonsSolution,
  parseParsonsConfig,
  resetParsonsBlocks,
  type ParsonsBlock
} from "@/lib/parsons";

export default function ActivityPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const { courseId, activityId } = params;
  const { user } = useAuth();
  const { t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [solution, setSolution] = useState("");
  const [language, setLanguage] = useState("python");
  const [stripIndentation, setStripIndentation] = useState(false);
  const [blocks, setBlocks] = useState<ParsonsBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = user?.roles.includes("admin") || user?.roles.includes("teacher");
  const isParsonsProblem = activity?.activityType.key === "parsons-problem";

  async function refresh() {
    const [courseResult, activityResult] = await Promise.all([api.course(courseId), api.activity(courseId, activityId)]);
    const nextActivity = activityResult.activity;
    const nextConfig = parseParsonsConfig(nextActivity.config);

    setCourse(courseResult.course);
    setActivity(nextActivity);
    setTitle(nextActivity.title);
    setDescription(nextActivity.description);
    setPrompt(nextConfig.prompt);
    setSolution(nextConfig.solution);
    setLanguage(normalizeCodeLanguage(nextConfig.language));
    setStripIndentation(nextConfig.stripIndentation);
    setBlocks(resetParsonsBlocks(nextConfig));
    setSelectedBlockId(null);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : t("activityPage.loadError")));
  }, [activityId, courseId, t]);

  async function saveParsonsProblem(event: FormEvent) {
    event.preventDefault();
    if (!activity) {
      return;
    }

    setSaving(true);
    setSaveMessage("");
    setError("");
    try {
      const result = await api.updateActivity(courseId, activity.id, {
        title,
        description,
        config: {
          prompt,
          solution,
          language,
          stripIndentation
        }
      });
      setActivity(result.activity);
      setBlocks(resetParsonsBlocks(parseParsonsConfig(result.activity.config)));
      setSelectedBlockId(null);
      setSaveMessage(t("parsons.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parsons.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function moveSelectedBlock(direction: -1 | 1) {
    if (!selectedBlockId) {
      return;
    }
    const index = blocks.findIndex((block) => block.id === selectedBlockId);
    if (index === -1) {
      return;
    }
    moveBlock(index, direction);
  }

  function adjustIndent(index: number, direction: -1 | 1) {
    setBlocks((current) =>
      current.map((block, currentIndex) =>
        currentIndex === index
          ? { ...block, currentIndent: Math.max(0, Math.min(6, block.currentIndent + direction)) }
          : block
      )
    );
  }

  function adjustSelectedIndent(direction: -1 | 1) {
    if (!selectedBlockId) {
      return;
    }
    const index = blocks.findIndex((block) => block.id === selectedBlockId);
    if (index === -1) {
      return;
    }
    adjustIndent(index, direction);
  }

  function resetWorkspace() {
    if (!activity) {
      return;
    }
    const config = parseParsonsConfig(activity.config);
    setBlocks(resetParsonsBlocks(config));
    setSelectedBlockId(null);
    setFeedback("");
  }

  function checkSolution() {
    const result = evaluateParsonsSolution(blocks);
    if (result.isCorrect) {
      setFeedback(t("parsons.correct"));
      return;
    }

    const parts = [];
    if (!result.orderCorrect) {
      parts.push(t("parsons.orderFeedback", { count: result.misplacedBlocks }));
    }
    if (!result.indentationCorrect && stripIndentation) {
      parts.push(t("parsons.indentFeedback", { count: result.incorrectIndents }));
    }
    setFeedback(parts.join(" "));
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
    <AppShell>
      <main className="page stack">
        <section className="hero-panel stack">
          <div className="hero-meta">
            <p className="eyebrow">{t("parsons.eyebrow")}</p>
            <h1>{activity?.title ?? t("parsons.title")}</h1>
            <p className="muted">{course ? t("parsons.inCourse", { title: course.title }) : t("common.loading")}</p>
          </div>
          <div className="row">
            <Link className="button secondary" href={`/courses/${courseId}`}>
              {t("parsons.backToCourse")}
            </Link>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}
        {saveMessage ? <p className="success-message">{saveMessage}</p> : null}

        {activity && isParsonsProblem ? (
          <>
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
                    <textarea
                      id="activity-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
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
                      minHeight={260}
                      value={solution}
                      onChange={setSolution}
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
                      <input
                        checked={stripIndentation}
                        type="checkbox"
                        onChange={(event) => setStripIndentation(event.target.checked)}
                      />
                      <span>{t("parsons.stripIndentation")}</span>
                    </label>
                  </div>
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
        ) : activity ? (
          <section className="section stack">
            <h2>{t("parsons.unsupportedTitle")}</h2>
            <p className="muted">{t("parsons.unsupportedText")}</p>
          </section>
        ) : (
          <p>{t("common.loading")}</p>
        )}
      </main>
    </AppShell>
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
      <path
        d={paths[direction]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
