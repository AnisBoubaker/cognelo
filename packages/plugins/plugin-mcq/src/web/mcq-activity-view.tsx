"use client";

import katex from "katex";
import { type FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { CodeEditor, CodeRenderer, codeLanguageOptions } from "@cognelo/activity-ui";
import { parseMcqSource, renderInlineMarkdown, renderInlineTokens, type InlineToken, type ParsedMcq, type McqBlock, type McqQuestion } from "../mcq";

type ActivityLike = {
  id: string;
  title: string;
  description: string;
  config?: Record<string, unknown>;
};

type McqActivityViewProps = {
  activity: ActivityLike;
  canManage: boolean;
  onSave: (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<ActivityLike>;
  locale?: "en" | "fr" | "zh";
};

type StudentAnswerState = Record<string, string[]>;

const fallbackConfig = {
  source: "",
  defaultCodeLanguage: "python"
};

const copyByLocale = {
  en: {
    authoringTitle: "Multiple choice questions authoring",
    authoringHelp: "Write the activity as text. Use ## headings for questions and task-list syntax like - [x] and - [ ] for the choices.",
    title: "Title",
    description: "Description",
    defaultCodeLanguage: "Default code language",
    source: "Multiple choice questions source",
    parsingIssues: "Parsing issues",
    line: "Line",
    saving: "Saving...",
    save: "Save multiple choice questions",
    saved: "Multiple choice questions activity saved.",
    saveError: "Unable to save the multiple choice questions activity right now.",
    studentPreview: "Student preview",
    question: "Question"
  },
  fr: {
    authoringTitle: "Edition des questions a choix multiples",
    authoringHelp: "Redigez l'activite sous forme de texte. Utilisez des titres ## pour les questions et la syntaxe de liste de taches comme - [x] et - [ ] pour les choix.",
    title: "Titre",
    description: "Description",
    defaultCodeLanguage: "Langage de code par defaut",
    source: "Source des questions a choix multiples",
    parsingIssues: "Problemes d'analyse",
    line: "Ligne",
    saving: "Enregistrement...",
    save: "Enregistrer les questions a choix multiples",
    saved: "L'activite de questions a choix multiples a ete enregistree.",
    saveError: "Impossible d'enregistrer l'activite de questions a choix multiples pour le moment.",
    studentPreview: "Apercu etudiant",
    question: "Question"
  },
  zh: {
    authoringTitle: "选择题编辑",
    authoringHelp: "使用文本来编写活动。用 ## 标题表示题目，用 - [x] 和 - [ ] 这样的任务列表语法表示选项。",
    title: "标题",
    description: "说明",
    defaultCodeLanguage: "默认代码语言",
    source: "选择题源码",
    parsingIssues: "解析问题",
    line: "第",
    saving: "保存中...",
    save: "保存选择题",
    saved: "选择题活动已保存。",
    saveError: "暂时无法保存选择题活动。",
    studentPreview: "学生预览",
    question: "问题"
  }
} as const;

export function McqActivityView({ activity, canManage, onSave, locale = "en" }: McqActivityViewProps) {
  const copy = copyByLocale[locale] ?? copyByLocale.en;
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [source, setSource] = useState(String(activity.config?.source ?? fallbackConfig.source));
  const [defaultCodeLanguage, setDefaultCodeLanguage] = useState(String(activity.config?.defaultCodeLanguage ?? fallbackConfig.defaultCodeLanguage));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswerState>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setTitle(activity.title);
    setDescription(activity.description);
    setSource(String(activity.config?.source ?? fallbackConfig.source));
    setDefaultCodeLanguage(String(activity.config?.defaultCodeLanguage ?? fallbackConfig.defaultCodeLanguage));
    setStudentAnswers({});
    setSubmitted(false);
    setSaveMessage("");
    setError("");
  }, [activity]);

  const parsedMcq = useMemo(() => parseMcqSource(source, defaultCodeLanguage), [defaultCodeLanguage, source]);
  const score = useMemo(() => {
    if (!submitted) {
      return null;
    }

    let correct = 0;
    for (const question of parsedMcq.questions) {
      const expected = question.choices.filter((choice) => choice.isCorrect).map((choice) => choice.id).sort();
      const actual = [...(studentAnswers[question.id] ?? [])].sort();
      if (expected.length === actual.length && expected.every((choiceId, index) => choiceId === actual[index])) {
        correct += 1;
      }
    }

    return {
      correct,
      total: parsedMcq.questions.length
    };
  }, [parsedMcq.questions, studentAnswers, submitted]);

  async function saveMcq(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    setError("");

    try {
      await onSave({
        title,
        description,
        config: {
          source,
          defaultCodeLanguage
        }
      });
      setSaveMessage(copy.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  function updateSingleChoice(question: McqQuestion, choiceId: string) {
    setStudentAnswers((current) => ({
      ...current,
      [question.id]: [choiceId]
    }));
  }

  function updateMultipleChoice(question: McqQuestion, choiceId: string, checked: boolean) {
    setStudentAnswers((current) => {
      const selected = new Set(current[question.id] ?? []);
      if (checked) {
        selected.add(choiceId);
      } else {
        selected.delete(choiceId);
      }
      return {
        ...current,
        [question.id]: [...selected]
      };
    });
  }

  if (canManage) {
    return (
      <form className="section stack" onSubmit={saveMcq}>
        <div className="stack">
          <h2>{copy.authoringTitle}</h2>
          <p className="muted">{copy.authoringHelp}</p>
        </div>

        <div className="field">
          <label htmlFor="mcq-title">{copy.title}</label>
          <input id="mcq-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="mcq-description">{copy.description}</label>
          <textarea id="mcq-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="mcq-default-language">{copy.defaultCodeLanguage}</label>
          <select id="mcq-default-language" value={defaultCodeLanguage} onChange={(event) => setDefaultCodeLanguage(event.target.value)}>
            {codeLanguageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="stack">
          <span>{copy.source}</span>
          <CodeEditor id="mcq-source" value={source} onChange={setSource} language="markdown" minHeight={420} />
        </div>

        {parsedMcq.errors.length ? (
          <section className="stack" style={{ border: "1px solid rgba(210, 61, 71, 0.25)", borderRadius: 10, padding: 16 }}>
            <h3>{copy.parsingIssues}</h3>
            <ul className="stack" style={{ gap: 8, margin: 0, paddingLeft: 20 }}>
              {parsedMcq.errors.map((issue, index) => (
                <li key={`${issue.line}-${index}`}>{copy.line} {issue.line}: {issue.message}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {saveMessage ? <p className="muted">{saveMessage}</p> : null}

        <div className="row">
          <button type="submit" disabled={saving || parsedMcq.errors.length > 0 || parsedMcq.questions.length === 0}>
            {saving ? copy.saving : copy.save}
          </button>
        </div>

        <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
          <h3>{copy.studentPreview}</h3>
          <McqStudentView
            parsedMcq={parsedMcq}
            studentAnswers={studentAnswers}
            submitted={submitted}
            score={score}
            onSubmit={() => setSubmitted(true)}
            onReset={() => {
              setStudentAnswers({});
              setSubmitted(false);
            }}
            onSingleChoice={updateSingleChoice}
            onMultipleChoice={updateMultipleChoice}
            questionLabel={copy.question}
          />
        </section>
      </form>
    );
  }

  return (
    <section className="section stack">
      <McqStudentView
        parsedMcq={parsedMcq}
        studentAnswers={studentAnswers}
        submitted={submitted}
        score={score}
        onSubmit={() => setSubmitted(true)}
        onReset={() => {
          setStudentAnswers({});
          setSubmitted(false);
        }}
        onSingleChoice={updateSingleChoice}
        onMultipleChoice={updateMultipleChoice}
        questionLabel={copy.question}
      />
    </section>
  );
}

function McqStudentView({
  parsedMcq,
  studentAnswers,
  submitted,
  score,
  onSubmit,
  onReset,
  onSingleChoice,
  onMultipleChoice,
  questionLabel
}: {
  parsedMcq: ParsedMcq;
  studentAnswers: StudentAnswerState;
  submitted: boolean;
  score: { correct: number; total: number } | null;
  onSubmit: () => void;
  onReset: () => void;
  onSingleChoice: (question: McqQuestion, choiceId: string) => void;
  onMultipleChoice: (question: McqQuestion, choiceId: string, checked: boolean) => void;
  questionLabel: string;
}) {
  return (
    <div className="stack">
      {parsedMcq.introBlocks.length ? <MarkdownBlocksView blocks={parsedMcq.introBlocks} /> : null}

      {parsedMcq.questions.map((question, index) => {
        const selected = studentAnswers[question.id] ?? [];
        const expected = question.choices.filter((choice) => choice.isCorrect).map((choice) => choice.id).sort();
        const actual = [...selected].sort();
        const isCorrect = submitted && expected.length === actual.length && expected.every((choiceId, position) => choiceId === actual[position]);

        return (
          <article key={question.id} className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 18 }}>
            <div className="stack" style={{ gap: 6 }}>
              <p className="eyebrow">{questionLabel} {index + 1}</p>
              <h3 style={{ margin: 0 }}>{question.title}</h3>
            </div>

            <MarkdownBlocksView blocks={question.promptBlocks} />

            <div className="stack" style={{ gap: 12 }}>
              {question.choices.map((choice) => {
                const checked = selected.includes(choice.id);
                return (
                  <label
                    key={choice.id}
                    style={{
                      alignItems: "flex-start",
                      border: "1px solid rgba(13, 27, 71, 0.12)",
                      borderRadius: 10,
                      cursor: "pointer",
                      display: "flex",
                      gap: 12,
                      justifyContent: "flex-start",
                      padding: 12
                    }}
                  >
                    <input
                      checked={checked}
                      name={question.id}
                      type={question.mode === "single" ? "radio" : "checkbox"}
                      style={{
                        flex: "0 0 auto",
                        margin: "0.15rem 0 0",
                        minHeight: 0,
                        padding: 0,
                        width: "auto"
                      }}
                      onChange={(event) =>
                        question.mode === "single"
                          ? onSingleChoice(question, choice.id)
                          : onMultipleChoice(question, choice.id, event.target.checked)
                      }
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <MarkdownBlocksView blocks={choice.blocks} compact />
                    </span>
                  </label>
                );
              })}
            </div>

            {submitted ? (
              <p className={isCorrect ? "muted" : "error"}>{isCorrect ? "Correct." : "Not quite. Review your choices and try again."}</p>
            ) : null}
          </article>
        );
      })}

      {parsedMcq.questions.length ? (
        <div className="row">
          <button type="button" onClick={onSubmit}>
            Check answers
          </button>
          <button className="secondary" type="button" onClick={onReset}>
            Reset
          </button>
        </div>
      ) : null}

      {submitted && score ? (
        <p className="muted">
          Score: {score.correct} / {score.total}
        </p>
      ) : null}
    </div>
  );
}

function MarkdownBlocksView({ blocks, compact = false }: { blocks: McqBlock[]; compact?: boolean }) {
  return (
    <div className="stack" style={{ gap: compact ? 8 : 12 }}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          if (block.level <= 2) {
            return <h3 key={index} style={compact ? { margin: 0 } : undefined}>{block.text}</h3>;
          }
          if (block.level === 3) {
            return <h4 key={index} style={compact ? { margin: 0 } : undefined}>{block.text}</h4>;
          }
          return <h5 key={index} style={compact ? { margin: 0 } : undefined}>{block.text}</h5>;
        }

        if (block.type === "paragraph") {
          return (
            <p key={index} style={compact ? { margin: 0 } : undefined}>
              {renderInlineTokens(renderInlineMarkdown(block.text), renderInlineToken)}
            </p>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={index} style={{ margin: 0, paddingLeft: 22 }}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineTokens(renderInlineMarkdown(item), renderInlineToken)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "math") {
          return <MathView key={index} expression={block.expression} displayMode={block.display} compact={compact} />;
        }

        return <CodeRenderer key={index} code={block.code} language={block.language} showLineNumbers />;
      })}
    </div>
  );
}

function renderInlineToken(
  token: InlineToken,
  index: number
) {
  if (token.type === "text") {
    return <Fragment key={index}>{token.text}</Fragment>;
  }

  if (token.type === "code") {
    return (
      <code key={index} style={{ background: "rgba(13, 27, 71, 0.06)", borderRadius: 6, padding: "0.1rem 0.35rem" }}>
        {token.text}
      </code>
    );
  }

  if (token.type === "math") {
    return <MathView key={index} expression={token.expression} displayMode={false} />;
  }

  if (token.type === "strong") {
    return <strong key={index}>{renderInlineTokens(token.children, renderInlineToken)}</strong>;
  }

  return <em key={index}>{renderInlineTokens(token.children, renderInlineToken)}</em>;
}

function MathView({ expression, displayMode, compact = false }: { expression: string; displayMode: boolean; compact?: boolean }) {
  const html = katex.renderToString(expression, {
    displayMode,
    strict: "ignore",
    throwOnError: false
  });

  if (displayMode) {
    return <div dangerouslySetInnerHTML={{ __html: html }} style={compact ? { margin: 0 } : undefined} />;
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
