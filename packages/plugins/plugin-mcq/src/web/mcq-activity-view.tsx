"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CodeEditor, codeLanguageOptions, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import {
  parseMcqSource,
  type McqChoice,
  type McqQuestion,
  type ParsedMcq
} from "../mcq";
import { MarkdownBlocksView } from "./markdown-blocks-view";

type ActivityLike = {
  id: string;
  title: string;
  description: string;
  config?: Record<string, unknown>;
  assignment?: {
    metadata?: Record<string, unknown>;
  };
};

type McqActivityViewProps = {
  activity: ActivityLike;
  canManage: boolean;
  onSave: (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<ActivityLike>;
  locale?: "en" | "fr" | "zh" | "ar";
  submissionClient?: {
    submit: (activityId: string, answers: StudentAnswerState) => Promise<{ submission: { answers: StudentAnswerState } }>;
  };
  aiGenerationClient?: {
    generate: (input: { description: string; defaultCodeLanguage: string; locale: "en" | "fr" | "zh" | "ar" }) => Promise<{ source: string; attempts: number }>;
  };
};

type StudentAnswerState = Record<string, string[]>;

type McqFormSnapshot = {
  title: string;
  description: string;
  source: string;
  defaultCodeLanguage: string;
  randomizeChoices: boolean;
};

const fallbackConfig = {
  source: "",
  defaultCodeLanguage: "python",
  randomizeChoices: false
};

const copyByLocale = {
  en: {
    authoringTitle: "Multiple choice questions authoring",
    authoringHelp: "Write the activity as text. Use ## headings for questions and task-list syntax like - [x] and - [ ] for the choices. A choice can contain a code block.",
    title: "Title",
    description: "Description",
    defaultCodeLanguage: "Default code language",
    randomizeChoices: "Randomize choices",
    randomizeChoicesHelp: "Show answer choices in a random order for students.",
    source: "Multiple choice questions source",
    parsingIssues: "Parsing issues",
    line: "Line",
    saving: "Saving...",
    save: "Save multiple choice questions",
    saved: "Multiple choice questions activity saved.",
    saveError: "Unable to save the multiple choice questions activity right now.",
    generate: "Generate source automatically",
    generating: "Generating...",
    generated: "Multiple choice questions source generated.",
    generateHelp: "Use the description above to generate a valid MCQ source.",
    generateDescriptionRequired: "Add a more detailed description before generating.",
    generateError: "Unable to generate valid multiple choice questions right now.",
    replaceGeneratedTitle: "Replace existing source?",
    replaceGeneratedMessage: "Generating a new source will replace the current multiple choice questions source.",
    keepCurrentSource: "Keep current source",
    replaceCurrentSource: "Replace source",
    studentPreview: "Student preview",
    question: "Question",
    checkAnswers: "Check answers",
    submitAnswers: "Submit",
    submitted: "Submitted.",
    submitError: "Unable to submit answers.",
    reset: "Reset",
    score: "Score",
    correct: "Correct.",
    incorrect: "Not quite. Review your choices and try again."
  },
  fr: {
    authoringTitle: "Edition des questions a choix multiples",
    authoringHelp: "Redigez l'activite sous forme de texte. Utilisez des titres ## pour les questions et la syntaxe de liste de taches comme - [x] et - [ ] pour les choix. Un choix peut contenir un bloc de code.",
    title: "Titre",
    description: "Description",
    defaultCodeLanguage: "Langage de code par defaut",
    randomizeChoices: "Melanger les choix",
    randomizeChoicesHelp: "Affiche les choix de reponse dans un ordre aleatoire pour les etudiants.",
    source: "Source des questions a choix multiples",
    parsingIssues: "Problemes d'analyse",
    line: "Ligne",
    saving: "Enregistrement...",
    save: "Enregistrer les questions a choix multiples",
    saved: "L'activite de questions a choix multiples a ete enregistree.",
    saveError: "Impossible d'enregistrer l'activite de questions a choix multiples pour le moment.",
    generate: "Generer l'enonce automatiquement",
    generating: "Generation...",
    generated: "Source des questions a choix multiples generee.",
    generateHelp: "Utilise la description ci-dessus pour generer une source QCM valide.",
    generateDescriptionRequired: "Ajoutez une description plus detaillee avant la generation.",
    generateError: "Impossible de generer des questions a choix multiples valides pour le moment.",
    replaceGeneratedTitle: "Remplacer la source existante?",
    replaceGeneratedMessage: "La generation d'une nouvelle source remplacera la source actuelle des questions a choix multiples.",
    keepCurrentSource: "Conserver la source",
    replaceCurrentSource: "Remplacer la source",
    studentPreview: "Apercu etudiant",
    question: "Question",
    checkAnswers: "Verifier les reponses",
    submitAnswers: "Soumettre",
    submitted: "Soumis.",
    submitError: "Impossible de soumettre les reponses.",
    reset: "Reinitialiser",
    score: "Score",
    correct: "Correct.",
    incorrect: "Pas tout a fait. Revoyez vos choix et reessayez."
  },
  zh: {
    authoringTitle: "选择题编辑",
    authoringHelp: "使用文本来编写活动。用 ## 标题表示题目，用 - [x] 和 - [ ] 这样的任务列表语法表示选项。",
    title: "标题",
    description: "说明",
    defaultCodeLanguage: "默认代码语言",
    randomizeChoices: "随机排列选项",
    randomizeChoicesHelp: "向学生随机显示答案选项。",
    source: "选择题源码",
    parsingIssues: "解析问题",
    line: "第",
    saving: "保存中...",
    save: "保存选择题",
    saved: "选择题活动已保存。",
    saveError: "暂时无法保存选择题活动。",
    generate: "自动生成题目",
    generating: "正在生成...",
    generated: "选择题源码已生成。",
    generateHelp: "根据上方说明生成有效的选择题源码。",
    generateDescriptionRequired: "请先添加更详细的说明。",
    generateError: "暂时无法生成有效的选择题。",
    replaceGeneratedTitle: "替换现有源码？",
    replaceGeneratedMessage: "生成新的源码会替换当前选择题源码。",
    keepCurrentSource: "保留当前源码",
    replaceCurrentSource: "替换源码",
    studentPreview: "学生预览",
    question: "问题",
    checkAnswers: "检查答案",
    submitAnswers: "提交",
    submitted: "已提交。",
    submitError: "暂时无法提交答案。",
    reset: "重置",
    score: "得分",
    correct: "正确。",
    incorrect: "还不完全正确。请检查选项后再试。"
  }
} as const;

export function McqActivityView({ activity, canManage, onSave, locale = "en", submissionClient, aiGenerationClient }: McqActivityViewProps) {
  const copyLocale = locale === "ar" ? "en" : locale;
  const copy = copyByLocale[copyLocale] ?? copyByLocale.en;
  const notifications = useNotifications();
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [source, setSource] = useState(String(activity.config?.source ?? fallbackConfig.source));
  const [defaultCodeLanguage, setDefaultCodeLanguage] = useState(String(activity.config?.defaultCodeLanguage ?? fallbackConfig.defaultCodeLanguage));
  const [randomizeChoices, setRandomizeChoices] = useState(Boolean(activity.config?.randomizeChoices ?? fallbackConfig.randomizeChoices));
  const [savedSnapshot, setSavedSnapshot] = useState<McqFormSnapshot>(() => snapshotFromActivity(activity));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showReplaceGenerationDialog, setShowReplaceGenerationDialog] = useState(false);
  const [error, setError] = useState("");
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswerState>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isSummativeStudentSession = !canManage && activity.assignment?.metadata?.assessmentMode === "summative" && Boolean(submissionClient);

  useEffect(() => {
    setTitle(activity.title);
    setDescription(activity.description);
    setSource(String(activity.config?.source ?? fallbackConfig.source));
    setDefaultCodeLanguage(String(activity.config?.defaultCodeLanguage ?? fallbackConfig.defaultCodeLanguage));
    setRandomizeChoices(Boolean(activity.config?.randomizeChoices ?? fallbackConfig.randomizeChoices));
    setSavedSnapshot(snapshotFromActivity(activity));
    setStudentAnswers({});
    setSubmitted(false);
    setError("");
    setShowReplaceGenerationDialog(false);
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

  const currentSnapshot = useMemo(
    () => ({
      title,
      description,
      source,
      defaultCodeLanguage,
      randomizeChoices
    }),
    [defaultCodeLanguage, description, randomizeChoices, source, title]
  );
  const hasUnsavedChanges = canManage && !snapshotsEqual(currentSnapshot, savedSnapshot);

  const discardChanges = useCallback(() => {
    setTitle(savedSnapshot.title);
    setDescription(savedSnapshot.description);
    setSource(savedSnapshot.source);
    setDefaultCodeLanguage(savedSnapshot.defaultCodeLanguage);
    setRandomizeChoices(savedSnapshot.randomizeChoices);
    setStudentAnswers({});
    setSubmitted(false);
    setError("");
    setShowReplaceGenerationDialog(false);
  }, [savedSnapshot]);

  const saveMcqChanges = useCallback(async () => {
    setSaving(true);
    setError("");

    try {
      await onSave({
        title,
        description,
        config: {
          source,
          defaultCodeLanguage,
          randomizeChoices
        }
      });
      setSavedSnapshot({
        title,
        description,
        source,
        defaultCodeLanguage,
        randomizeChoices
      });
      notifications.success(copy.saved);
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : copy.saveError);
      setError("");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [copy.saveError, copy.saved, defaultCodeLanguage, description, notifications, onSave, randomizeChoices, source, title]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedChanges,
        onSave: saveMcqChanges,
        onDiscard: discardChanges
      }),
      [discardChanges, hasUnsavedChanges, saveMcqChanges]
    )
  );

  async function saveMcq(event: FormEvent) {
    event.preventDefault();
    await saveMcqChanges();
  }

  function requestMcqGeneration() {
    if (!aiGenerationClient) {
      return;
    }
    if (description.trim().length < 10) {
      notifications.error(copy.generateDescriptionRequired);
      return;
    }
    if (source.trim().length > 0) {
      setShowReplaceGenerationDialog(true);
      return;
    }

    void generateMcqSource();
  }

  async function generateMcqSource() {
    if (!aiGenerationClient) {
      return;
    }

    setGenerating(true);
    setShowReplaceGenerationDialog(false);
    setError("");
    try {
      const result = await aiGenerationClient.generate({
        description,
        defaultCodeLanguage,
        locale
      });
      setSource(result.source);
      setStudentAnswers({});
      setSubmitted(false);
      notifications.success(result.attempts > 1 ? `${copy.generated} (${result.attempts})` : copy.generated);
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : copy.generateError);
    } finally {
      setGenerating(false);
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

  async function submitMcqAnswers() {
    if (!isSummativeStudentSession || !submissionClient) {
      setSubmitted(true);
      return;
    }
    setSubmitting(true);
    try {
      const result = await submissionClient.submit(activity.id, studentAnswers);
      setStudentAnswers(result.submission.answers);
      setSubmitted(true);
      notifications.success(copy.submitted);
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : copy.submitError);
    } finally {
      setSubmitting(false);
    }
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

        {aiGenerationClient ? (
          <div className="stack" style={{ gap: 8 }}>
            <button className="secondary" type="button" disabled={generating || description.trim().length < 10} onClick={requestMcqGeneration}>
              {generating ? copy.generating : copy.generate}
            </button>
            <p className="muted">{copy.generateHelp}</p>
          </div>
        ) : null}

        {showReplaceGenerationDialog ? (
          <div className="dialog-backdrop" role="presentation">
            <div aria-modal="true" className="dialog-panel" role="dialog" aria-labelledby="mcq-ai-replace-title">
              <div className="stack" style={{ gap: 8 }}>
                <p className="eyebrow">{copy.generate}</p>
                <h2 id="mcq-ai-replace-title">{copy.replaceGeneratedTitle}</h2>
                <p className="muted">{copy.replaceGeneratedMessage}</p>
              </div>
              <div className="dialog-actions">
                <button className="secondary" type="button" onClick={() => setShowReplaceGenerationDialog(false)}>
                  {copy.keepCurrentSource}
                </button>
                <button type="button" onClick={() => void generateMcqSource()}>
                  {copy.replaceCurrentSource}
                </button>
              </div>
            </div>
          </div>
        ) : null}

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

        <label style={{ alignItems: "flex-start", display: "flex", gap: 12 }}>
          <input
            checked={randomizeChoices}
            type="checkbox"
            style={{ flex: "0 0 auto", marginTop: 4, minHeight: 0, width: "auto" }}
            onChange={(event) => setRandomizeChoices(event.target.checked)}
          />
          <span className="stack" style={{ gap: 4 }}>
            <strong>{copy.randomizeChoices}</strong>
            <span className="muted">{copy.randomizeChoicesHelp}</span>
          </span>
        </label>

        <div className="mcq-authoring-grid">
          <div className="stack">
            <h3>{copy.source}</h3>
            <CodeEditor id="mcq-source" value={source} onChange={setSource} language="markdown" minHeight={620} />
          </div>

          <section className="stack mcq-authoring-preview">
            <h3>{copy.studentPreview}</h3>
            <McqStudentView
              parsedMcq={parsedMcq}
              studentAnswers={studentAnswers}
              submitted={submitted}
              showFeedback={submitted}
              score={score}
              onSubmit={() => setSubmitted(true)}
              onReset={() => {
                setStudentAnswers({});
                setSubmitted(false);
              }}
              onSingleChoice={updateSingleChoice}
              onMultipleChoice={updateMultipleChoice}
              questionLabel={copy.question}
              checkAnswersLabel={copy.checkAnswers}
              disabled={false}
              resetDisabled={false}
              resetLabel={copy.reset}
              scoreLabel={copy.score}
              correctLabel={copy.correct}
              incorrectLabel={copy.incorrect}
              randomizeChoices={randomizeChoices}
            />
          </section>
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
        <div className="row">
          <button type="submit" disabled={saving || parsedMcq.errors.length > 0 || parsedMcq.questions.length === 0}>
            {saving ? copy.saving : copy.save}
          </button>
        </div>

      </form>
    );
  }

  return (
    <section className="section stack">
      <McqStudentView
        parsedMcq={parsedMcq}
        studentAnswers={studentAnswers}
        submitted={submitted}
        showFeedback={!isSummativeStudentSession && submitted}
        score={score}
        onSubmit={() => void submitMcqAnswers()}
        onReset={() => {
          setStudentAnswers({});
          setSubmitted(false);
        }}
        onSingleChoice={updateSingleChoice}
        onMultipleChoice={updateMultipleChoice}
        questionLabel={copy.question}
        checkAnswersLabel={isSummativeStudentSession ? copy.submitAnswers : copy.checkAnswers}
        disabled={submitting || submitted}
        resetDisabled={isSummativeStudentSession && submitted}
        resetLabel={copy.reset}
        scoreLabel={copy.score}
        correctLabel={copy.correct}
        incorrectLabel={copy.incorrect}
        randomizeChoices={randomizeChoices}
      />
    </section>
  );
}

function McqStudentView({
  parsedMcq,
  studentAnswers,
  submitted,
  showFeedback,
  score,
  onSubmit,
  onReset,
  onSingleChoice,
  onMultipleChoice,
  questionLabel,
  checkAnswersLabel,
  disabled,
  resetDisabled,
  resetLabel,
  scoreLabel,
  correctLabel,
  incorrectLabel,
  randomizeChoices
}: {
  parsedMcq: ParsedMcq;
  studentAnswers: StudentAnswerState;
  submitted: boolean;
  showFeedback: boolean;
  score: { correct: number; total: number } | null;
  onSubmit: () => void;
  onReset: () => void;
  onSingleChoice: (question: McqQuestion, choiceId: string) => void;
  onMultipleChoice: (question: McqQuestion, choiceId: string, checked: boolean) => void;
  questionLabel: string;
  checkAnswersLabel: string;
  disabled: boolean;
  resetDisabled: boolean;
  resetLabel: string;
  scoreLabel: string;
  correctLabel: string;
  incorrectLabel: string;
  randomizeChoices: boolean;
}) {
  const questions = useMemo(
    () =>
      parsedMcq.questions.map((question) => ({
        ...question,
        choices: randomizeChoices ? shuffleChoices(question.choices) : question.choices
      })),
    [parsedMcq.questions, randomizeChoices]
  );

  return (
    <div className="stack">
      {parsedMcq.introBlocks.length ? <MarkdownBlocksView blocks={parsedMcq.introBlocks} /> : null}

      {questions.map((question, index) => {
        const selected = studentAnswers[question.id] ?? [];

        return (
          <McqQuestionCard
            key={question.id}
            question={question}
            index={index}
            selected={selected}
            submitted={submitted}
            showFeedback={showFeedback}
            questionLabel={questionLabel}
            correctLabel={correctLabel}
            incorrectLabel={incorrectLabel}
            onSingleChoice={onSingleChoice}
            onMultipleChoice={onMultipleChoice}
          />
        );
      })}

      {parsedMcq.questions.length ? (
        <div className="row">
          <button type="button" disabled={disabled} onClick={onSubmit}>
            {checkAnswersLabel}
          </button>
          <button className="secondary" type="button" disabled={resetDisabled} onClick={onReset}>
            {resetLabel}
          </button>
        </div>
      ) : null}

      {showFeedback && score ? (
        <p className="muted">
          {scoreLabel}: {score.correct} / {score.total}
        </p>
      ) : null}
    </div>
  );
}

function McqQuestionCard({
  question,
  index,
  selected,
  submitted,
  showFeedback,
  questionLabel,
  correctLabel,
  incorrectLabel,
  onSingleChoice,
  onMultipleChoice
}: {
  question: McqQuestion;
  index: number;
  selected: string[];
  submitted: boolean;
  showFeedback: boolean;
  questionLabel: string;
  correctLabel: string;
  incorrectLabel: string;
  onSingleChoice: (question: McqQuestion, choiceId: string) => void;
  onMultipleChoice: (question: McqQuestion, choiceId: string, checked: boolean) => void;
}) {
  const expected = question.choices.filter((choice) => choice.isCorrect).map((choice) => choice.id).sort();
  const actual = [...selected].sort();
  const isCorrect = showFeedback && expected.length === actual.length && expected.every((choiceId, position) => choiceId === actual[position]);

  return (
    <article className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 18 }}>
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

      {showFeedback ? (
        <p className={isCorrect ? "muted" : "error"}>{isCorrect ? correctLabel : incorrectLabel}</p>
      ) : null}
    </article>
  );
}

function shuffleChoices(choices: McqChoice[]) {
  const shuffled = [...choices];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function snapshotFromActivity(activity: ActivityLike): McqFormSnapshot {
  return {
    title: activity.title,
    description: activity.description,
    source: String(activity.config?.source ?? fallbackConfig.source),
    defaultCodeLanguage: String(activity.config?.defaultCodeLanguage ?? fallbackConfig.defaultCodeLanguage),
    randomizeChoices: Boolean(activity.config?.randomizeChoices ?? fallbackConfig.randomizeChoices)
  };
}

function snapshotsEqual(left: McqFormSnapshot, right: McqFormSnapshot) {
  return (
    left.title === right.title &&
    left.description === right.description &&
    left.source === right.source &&
    left.defaultCodeLanguage === right.defaultCodeLanguage &&
    left.randomizeChoices === right.randomizeChoices
  );
}

