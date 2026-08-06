"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CodeEditor, MarkdownRenderer, RichTextEditor, codeLanguageOptions, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
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
    getStatus?: (activityId: string) => Promise<{
      submission: { answers: StudentAnswerState } | null;
      grade?: { rawScore: number; rawMaxScore: number; normalizedScore?: number; normalizedMaxScore?: number } | null;
      availability: { attemptsRemaining: number | null; canStart: boolean; reason: string | null; gradesReleased?: boolean };
    }>;
    submit: (activityId: string, answers: StudentAnswerState) => Promise<{ submission: { answers: StudentAnswerState } }>;
  };
  onSubmitted?: () => void;
  studentViewMode?: "attempt" | "previous";
  onNewAttemptAvailabilityChange?: (canStartNewAttempt: boolean) => void;
  onPreviousSubmissionsAvailabilityChange?: (hasPreviousSubmissions: boolean) => void;
  showCorrectAnswers?: boolean;
  releasedMaxScore?: number;
  aiGenerationClient?: {
    generate: (input: {
      description: string;
      defaultCodeLanguage: string;
      instructions?: string;
      locale: "en" | "fr" | "zh" | "ar";
      questionCount: number;
    }) => Promise<{ source: string; attempts: number }>;
  };
};

type StudentAnswerState = Record<string, string[]>;

type McqFormSnapshot = {
  title: string;
  description: string;
  source: string;
  aiGenerationInstructions: string;
  aiQuestionCount: number;
  defaultCodeLanguage: string;
  randomizeChoices: boolean;
};

const fallbackConfig = {
  source: "",
  aiGenerationInstructions: "",
  aiQuestionCount: 5,
  defaultCodeLanguage: "none",
  randomizeChoices: false
};

const copyByLocale = {
  en: {
    authoringTitle: "Multiple choice questions authoring",
    authoringHelp: "Write the activity as text. Use ## headings for questions and task-list syntax like - [x] and - [ ] for the choices. A choice can contain a code block.",
    title: "Title",
    description: "Student prompt",
    defaultCodeLanguage: "Default code language",
    notProgrammingExercise: "Not a programming exercise",
    randomizeChoices: "Randomize choices",
    randomizeChoicesHelp: "Show answer choices in a random order for students.",
    source: "Multiple choice questions source",
    parsingIssues: "Parsing issues",
    line: "Line",
    saving: "Saving...",
    save: "Save multiple choice questions",
    saved: "Multiple choice questions activity saved.",
    saveError: "Unable to save the multiple choice questions activity right now.",
    generateSection: "Generate questions with AI",
    aiInstructions: "Instructions to AI model (optional)",
    questionCount: "Number of questions to generate",
    generate: "Generate Multiple Choice Questions",
    generating: "Generating...",
    generated: "Multiple choice questions source generated.",
    generateHelp: "The AI uses the student prompt, these private instructions, and the selected default language.",
    generateDescriptionRequired: "Add a more detailed description before generating.",
    generateError: "Unable to generate valid multiple choice questions right now.",
    replaceGeneratedTitle: "Replace existing source?",
    replaceGeneratedMessage: "Generating a new source will replace the current multiple choice questions source.",
    keepCurrentSource: "Keep current source",
    replaceCurrentSource: "Replace source",
    studentPreview: "Student preview",
    studentPreviewPlaceholder: "Student prompt will be shown here",
    question: "Question",
    checkAnswers: "Check answers",
    submitAnswers: "Submit",
    submitConfirmTitle: "Submit answers?",
    submitConfirmMessage: "This will submit your answers for grading.",
    submitConfirmRemaining: "You have {remaining} submission(s) left. After this submission, you will have {after} left.",
    submitConfirmUnlimited: "This activity allows unlimited submissions.",
    keepWorking: "Keep working",
    confirmSubmit: "Submit answers",
    latestSubmission: "Latest submission",
    latestGrade: "Latest grade",
    submitted: "Submitted.",
    submitError: "Unable to submit answers.",
    reset: "Reset",
    score: "Score",
    points: "Points",
    correct: "Correct.",
    incorrect: "Not quite. Review your choices and try again.",
    missedCorrectAnswer: "Missed correct answer."
  },
  fr: {
    authoringTitle: "Edition des questions a choix multiples",
    authoringHelp: "Redigez l'activite sous forme de texte. Utilisez des titres ## pour les questions et la syntaxe de liste de taches comme - [x] et - [ ] pour les choix. Un choix peut contenir un bloc de code.",
    title: "Titre",
    description: "Consigne pour les etudiants",
    defaultCodeLanguage: "Langage de code par defaut",
    notProgrammingExercise: "Pas un exercice de programmation",
    randomizeChoices: "Melanger les choix",
    randomizeChoicesHelp: "Affiche les choix de reponse dans un ordre aleatoire pour les etudiants.",
    source: "Source des questions a choix multiples",
    parsingIssues: "Problemes d'analyse",
    line: "Ligne",
    saving: "Enregistrement...",
    save: "Enregistrer les questions a choix multiples",
    saved: "L'activite de questions a choix multiples a ete enregistree.",
    saveError: "Impossible d'enregistrer l'activite de questions a choix multiples pour le moment.",
    generateSection: "Generer des questions avec l'IA",
    aiInstructions: "Instructions au modele d'IA (facultatif)",
    questionCount: "Nombre de questions a generer",
    generate: "Generer les questions a choix multiples",
    generating: "Generation...",
    generated: "Source des questions a choix multiples generee.",
    generateHelp: "L'IA utilise la consigne etudiante, ces instructions privees et le langage par defaut selectionne.",
    generateDescriptionRequired: "Ajoutez une description plus detaillee avant la generation.",
    generateError: "Impossible de generer des questions a choix multiples valides pour le moment.",
    replaceGeneratedTitle: "Remplacer la source existante?",
    replaceGeneratedMessage: "La generation d'une nouvelle source remplacera la source actuelle des questions a choix multiples.",
    keepCurrentSource: "Conserver la source",
    replaceCurrentSource: "Remplacer la source",
    studentPreview: "Apercu etudiant",
    studentPreviewPlaceholder: "La consigne etudiante sera affichee ici",
    question: "Question",
    checkAnswers: "Verifier les reponses",
    submitAnswers: "Soumettre",
    submitConfirmTitle: "Soumettre les reponses ?",
    submitConfirmMessage: "Vos reponses seront envoyees pour correction.",
    submitConfirmRemaining: "Il vous reste {remaining} soumission(s). Apres cette soumission, il vous en restera {after}.",
    submitConfirmUnlimited: "Cette activite autorise un nombre illimite de soumissions.",
    keepWorking: "Continuer",
    confirmSubmit: "Soumettre",
    latestSubmission: "Derniere soumission",
    latestGrade: "Derniere note",
    submitted: "Soumis.",
    submitError: "Impossible de soumettre les reponses.",
    reset: "Reinitialiser",
    score: "Score",
    points: "Points",
    correct: "Correct.",
    incorrect: "Pas tout a fait. Revoyez vos choix et reessayez.",
    missedCorrectAnswer: "Reponse correcte manquee."
  },
  zh: {
    authoringTitle: "选择题编辑",
    authoringHelp: "使用文本来编写活动。用 ## 标题表示题目，用 - [x] 和 - [ ] 这样的任务列表语法表示选项。",
    title: "标题",
    description: "学生提示",
    defaultCodeLanguage: "默认代码语言",
    notProgrammingExercise: "不是编程练习",
    randomizeChoices: "随机排列选项",
    randomizeChoicesHelp: "向学生随机显示答案选项。",
    source: "选择题源码",
    parsingIssues: "解析问题",
    line: "第",
    saving: "保存中...",
    save: "保存选择题",
    saved: "选择题活动已保存。",
    saveError: "暂时无法保存选择题活动。",
    generateSection: "使用 AI 生成题目",
    aiInstructions: "给 AI 模型的说明（可选）",
    questionCount: "要生成的题目数量",
    generate: "生成选择题",
    generating: "正在生成...",
    generated: "选择题源码已生成。",
    generateHelp: "AI 会使用学生提示、这些仅教师可见的说明和所选默认语言。",
    generateDescriptionRequired: "请先添加更详细的说明。",
    generateError: "暂时无法生成有效的选择题。",
    replaceGeneratedTitle: "替换现有源码？",
    replaceGeneratedMessage: "生成新的源码会替换当前选择题源码。",
    keepCurrentSource: "保留当前源码",
    replaceCurrentSource: "替换源码",
    studentPreview: "学生预览",
    studentPreviewPlaceholder: "学生提示将显示在这里",
    question: "问题",
    checkAnswers: "检查答案",
    submitAnswers: "提交",
    submitConfirmTitle: "提交答案？",
    submitConfirmMessage: "这会将你的答案提交评分。",
    submitConfirmRemaining: "你还剩 {remaining} 次提交。本次提交后将剩 {after} 次。",
    submitConfirmUnlimited: "此活动允许无限次提交。",
    keepWorking: "继续作答",
    confirmSubmit: "提交答案",
    latestSubmission: "最新提交",
    latestGrade: "最新成绩",
    submitted: "已提交。",
    submitError: "暂时无法提交答案。",
    reset: "重置",
    score: "得分",
    points: "得分",
    correct: "正确。",
    incorrect: "还不完全正确。请检查选项后再试。",
    missedCorrectAnswer: "漏选的正确答案。"
  }
} as const;

export function McqActivityView({
  activity,
  canManage,
  onSave,
  locale = "en",
  submissionClient,
  onSubmitted,
  studentViewMode = "attempt",
  onNewAttemptAvailabilityChange,
  onPreviousSubmissionsAvailabilityChange,
  showCorrectAnswers = false,
  releasedMaxScore,
  aiGenerationClient
}: McqActivityViewProps) {
  const copyLocale = locale === "ar" ? "en" : locale;
  const copy = copyByLocale[copyLocale] ?? copyByLocale.en;
  const mcqCodeLanguageOptions = useMemo(
    () => [{ value: "none", label: copy.notProgrammingExercise }, ...codeLanguageOptions],
    [copy.notProgrammingExercise]
  );
  const notifications = useNotifications();
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [source, setSource] = useState(String(activity.config?.source ?? fallbackConfig.source));
  const [generationCodeLanguage, setGenerationCodeLanguage] = useState(String(activity.config?.defaultCodeLanguage ?? fallbackConfig.defaultCodeLanguage));
  const [randomizeChoices, setRandomizeChoices] = useState(Boolean(activity.config?.randomizeChoices ?? fallbackConfig.randomizeChoices));
  const [savedSnapshot, setSavedSnapshot] = useState<McqFormSnapshot>(() => snapshotFromActivity(activity));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiInstructions, setAiInstructions] = useState(String(activity.config?.aiGenerationInstructions ?? fallbackConfig.aiGenerationInstructions));
  const [questionCount, setQuestionCount] = useState(normalizeQuestionCount(activity.config?.aiQuestionCount));
  const [showReplaceGenerationDialog, setShowReplaceGenerationDialog] = useState(false);
  const [showSubmitConfirmDialog, setShowSubmitConfirmDialog] = useState(false);
  const [submissionAvailability, setSubmissionAvailability] = useState<{ attemptsRemaining: number | null; canStart: boolean; reason: string | null; gradesReleased?: boolean } | null>(null);
  const [latestSubmissionReview, setLatestSubmissionReview] = useState<{
    answers: StudentAnswerState;
    grade: { rawScore: number; rawMaxScore: number; normalizedScore?: number; normalizedMaxScore?: number } | null;
  } | null>(null);
  const [loadingSubmissionStatus, setLoadingSubmissionStatus] = useState(false);
  const [error, setError] = useState("");
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswerState>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isSummativeStudentSession = !canManage && activity.assignment?.metadata?.assessmentMode === "summative" && Boolean(submissionClient);
  const activityConfigKey = useMemo(() => JSON.stringify(activity.config ?? {}), [activity.config]);

  useEffect(() => {
    setTitle(activity.title);
    setDescription(activity.description);
    setSource(String(activity.config?.source ?? fallbackConfig.source));
    setGenerationCodeLanguage(String(activity.config?.defaultCodeLanguage ?? fallbackConfig.defaultCodeLanguage));
    setRandomizeChoices(Boolean(activity.config?.randomizeChoices ?? fallbackConfig.randomizeChoices));
    setSavedSnapshot(snapshotFromActivity(activity));
    setStudentAnswers({});
    setSubmitted(false);
    setError("");
    setShowReplaceGenerationDialog(false);
    setShowSubmitConfirmDialog(false);
    setSubmissionAvailability(null);
    setLatestSubmissionReview(null);
    setLoadingSubmissionStatus(false);
    setAiInstructions(String(activity.config?.aiGenerationInstructions ?? fallbackConfig.aiGenerationInstructions));
    setQuestionCount(normalizeQuestionCount(activity.config?.aiQuestionCount));
  }, [activity.id, activity.title, activity.description, activityConfigKey]);

  const parsedMcq = useMemo(() => parseMcqSource(source, "none"), [source]);
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
      aiGenerationInstructions: aiInstructions,
      aiQuestionCount: questionCount,
      defaultCodeLanguage: generationCodeLanguage,
      randomizeChoices
    }),
    [aiInstructions, description, generationCodeLanguage, questionCount, randomizeChoices, source, title]
  );
  const hasUnsavedChanges = canManage && !snapshotsEqual(currentSnapshot, savedSnapshot);

  useEffect(() => {
    if (!isSummativeStudentSession || !submissionClient?.getStatus) {
      return;
    }

    let cancelled = false;
    setLoadingSubmissionStatus(true);
    submissionClient.getStatus(activity.id)
      .then((status) => {
        if (cancelled) {
          return;
        }
        setSubmissionAvailability(status.availability);
        onNewAttemptAvailabilityChange?.(status.availability.canStart);
        onPreviousSubmissionsAvailabilityChange?.(Boolean(status.submission));
        if (status.submission) {
          setLatestSubmissionReview({
            answers: status.submission.answers,
            grade: status.grade ?? null
          });
          if (status.availability.canStart === false) {
            setStudentAnswers(status.submission.answers);
            setSubmitted(true);
          }
        } else {
          setLatestSubmissionReview(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          notifications.error(err instanceof Error ? err.message : copy.submitError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSubmissionStatus(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activity.id,
    copy.submitError,
    isSummativeStudentSession,
    notifications,
    onNewAttemptAvailabilityChange,
    onPreviousSubmissionsAvailabilityChange,
    submissionClient
  ]);

  const discardChanges = useCallback(() => {
    setTitle(savedSnapshot.title);
    setDescription(savedSnapshot.description);
    setSource(savedSnapshot.source);
    setAiInstructions(savedSnapshot.aiGenerationInstructions);
    setQuestionCount(savedSnapshot.aiQuestionCount);
    setGenerationCodeLanguage(savedSnapshot.defaultCodeLanguage);
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
          aiGenerationInstructions: aiInstructions,
          aiQuestionCount: questionCount,
          defaultCodeLanguage: generationCodeLanguage,
          randomizeChoices
        }
      });
      setSavedSnapshot({
        title,
        description,
        source,
        aiGenerationInstructions: aiInstructions,
        aiQuestionCount: questionCount,
        defaultCodeLanguage: generationCodeLanguage,
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
  }, [aiInstructions, copy.saveError, copy.saved, description, generationCodeLanguage, notifications, onSave, questionCount, randomizeChoices, source, title]);

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
        defaultCodeLanguage: generationCodeLanguage,
        instructions: aiInstructions,
        locale,
        questionCount
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

  async function requestSubmitMcqAnswers() {
    if (!isSummativeStudentSession || !submissionClient) {
      setSubmitted(true);
      return;
    }
    try {
      const status = await submissionClient.getStatus?.(activity.id);
      setSubmissionAvailability(status?.availability ?? null);
      if (status?.availability.canStart === false) {
        notifications.error(status.availability.reason ?? copy.submitError);
        return;
      }
      setShowSubmitConfirmDialog(true);
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : copy.submitError);
    }
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
      setShowSubmitConfirmDialog(false);
      notifications.success(copy.submitted);
      onSubmitted?.();
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
          <RichTextEditor
            id="mcq-description"
            ariaLabel={copy.description}
            locale={locale}
            minHeight={150}
            value={description}
            onChange={setDescription}
          />
        </div>

        {aiGenerationClient ? (
          <details style={{ border: "1px solid rgba(13, 27, 71, 0.12)", borderRadius: 12, padding: "14px 16px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 800 }}>{copy.generateSection}</summary>
            <div className="stack" style={{ marginTop: 16 }}>
              <div className="field">
                <label htmlFor="mcq-ai-instructions">{copy.aiInstructions}</label>
                <textarea
                  id="mcq-ai-instructions"
                  maxLength={4000}
                  rows={4}
                  value={aiInstructions}
                  onChange={(event) => setAiInstructions(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="mcq-ai-question-count">{copy.questionCount}</label>
                <input
                  id="mcq-ai-question-count"
                  max={20}
                  min={1}
                  type="number"
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                />
              </div>
              <div className="field">
                <label htmlFor="mcq-ai-default-language">{copy.defaultCodeLanguage}</label>
                <select
                  id="mcq-ai-default-language"
                  value={generationCodeLanguage}
                  onChange={(event) => setGenerationCodeLanguage(event.target.value)}
                >
                  {mcqCodeLanguageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="muted">{copy.generateHelp}</p>
              <div className="row">
                <button type="button" disabled={generating || description.trim().length < 10} onClick={requestMcqGeneration}>
                  {generating ? copy.generating : copy.generate}
                </button>
              </div>
            </div>
          </details>
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
          <section className="stack mcq-authoring-preview-prompt">
            <h3>{copy.studentPreview}</h3>
            <div className="mcq-student-preview-placeholder">
              <strong>{copy.studentPreviewPlaceholder}</strong>
            </div>
          </section>

          <div className="stack mcq-authoring-source">
            <h3>{copy.source}</h3>
            <CodeEditor id="mcq-source" value={source} onChange={setSource} language="markdown" minHeight={620} />
          </div>

          <section className="stack mcq-authoring-preview">
            <h3 aria-hidden="true" className="mcq-preview-alignment-heading">{copy.source}</h3>
            <div className="mcq-preview-editor-inset">
              <McqStudentView
                studentPrompt=""
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
                pointsLabel={copy.points}
                correctLabel={copy.correct}
                incorrectLabel={copy.incorrect}
                missedCorrectAnswerLabel={copy.missedCorrectAnswer}
                randomizeChoices={randomizeChoices}
              />
            </div>
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
      {latestSubmissionReview && studentViewMode === "previous" ? (
        <section className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 18 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>{copy.latestSubmission}</h2>
            {latestSubmissionReview.grade ? (
              <span className="participant-status is-graded">
                {copy.latestGrade}:{" "}
                {formatPoints(formatDisplayGradeScore(latestSubmissionReview.grade, releasedMaxScore))} /{" "}
                {formatPoints(releasedMaxScore ?? latestSubmissionReview.grade.normalizedMaxScore ?? latestSubmissionReview.grade.rawMaxScore)}
              </span>
            ) : null}
          </div>
          <McqStudentView
            studentPrompt={description}
            parsedMcq={parsedMcq}
            studentAnswers={latestSubmissionReview.answers}
            submitted
            showFeedback
            score={null}
            onSubmit={() => undefined}
            onReset={() => undefined}
            onSingleChoice={() => undefined}
            onMultipleChoice={() => undefined}
            questionLabel={copy.question}
            checkAnswersLabel={copy.checkAnswers}
            disabled
            resetDisabled
            hideActions
            resetLabel={copy.reset}
            scoreLabel={copy.score}
            pointsLabel={copy.points}
            correctLabel={copy.correct}
            incorrectLabel={copy.incorrect}
            missedCorrectAnswerLabel={copy.missedCorrectAnswer}
            releasedMaxScore={releasedMaxScore ?? latestSubmissionReview.grade?.normalizedMaxScore}
            randomizeChoices={false}
          />
        </section>
      ) : null}
      {studentViewMode === "attempt" ? (
        <McqStudentView
          studentPrompt={description}
          parsedMcq={parsedMcq}
          studentAnswers={studentAnswers}
          submitted={submitted}
          showFeedback={(!isSummativeStudentSession && submitted) || (isSummativeStudentSession && submitted && showCorrectAnswers)}
          score={score}
          onSubmit={() => void requestSubmitMcqAnswers()}
          onReset={() => {
            setStudentAnswers({});
            setSubmitted(false);
          }}
          onSingleChoice={updateSingleChoice}
          onMultipleChoice={updateMultipleChoice}
          questionLabel={copy.question}
          checkAnswersLabel={isSummativeStudentSession ? copy.submitAnswers : copy.checkAnswers}
          disabled={loadingSubmissionStatus || submitting || submitted || (isSummativeStudentSession && submissionAvailability?.canStart === false)}
          resetDisabled={loadingSubmissionStatus || (isSummativeStudentSession && (submitted || submissionAvailability?.canStart === false))}
          resetLabel={copy.reset}
          scoreLabel={copy.score}
          pointsLabel={copy.points}
          correctLabel={copy.correct}
          incorrectLabel={copy.incorrect}
          missedCorrectAnswerLabel={copy.missedCorrectAnswer}
          releasedMaxScore={releasedMaxScore}
          randomizeChoices={randomizeChoices}
        />
      ) : null}
      {showSubmitConfirmDialog ? (
        <div className="dialog-backdrop" role="presentation">
          <div aria-modal="true" className="dialog-panel" role="dialog" aria-labelledby="mcq-submit-confirm-title">
            <div className="stack" style={{ gap: 8 }}>
              <p className="eyebrow">{copy.submitAnswers}</p>
              <h2 id="mcq-submit-confirm-title">{copy.submitConfirmTitle}</h2>
              <p className="muted">{copy.submitConfirmMessage}</p>
              <p className="muted">{formatSubmissionAvailability(copy, submissionAvailability)}</p>
            </div>
            <div className="dialog-actions">
              <button className="secondary" type="button" disabled={submitting} onClick={() => setShowSubmitConfirmDialog(false)}>
                {copy.keepWorking}
              </button>
              <button type="button" disabled={submitting || submissionAvailability?.canStart === false} onClick={() => void submitMcqAnswers()}>
                {submitting ? copy.saving : copy.confirmSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function McqStudentView({
  studentPrompt,
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
  hideActions = false,
  resetLabel,
  scoreLabel,
  pointsLabel,
  correctLabel,
  incorrectLabel,
  missedCorrectAnswerLabel,
  releasedMaxScore,
  randomizeChoices
}: {
  studentPrompt: string;
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
  hideActions?: boolean;
  resetLabel: string;
  scoreLabel: string;
  pointsLabel: string;
  correctLabel: string;
  incorrectLabel: string;
  missedCorrectAnswerLabel: string;
  releasedMaxScore?: number;
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
      {studentPrompt.trim() ? <MarkdownRenderer markdown={studentPrompt} /> : null}
      {parsedMcq.introBlocks.length ? <MarkdownBlocksView blocks={parsedMcq.introBlocks} /> : null}

      {questions.map((question, index) => {
        const selected = studentAnswers[question.id] ?? [];
        const questionMaxScore = releasedMaxScore && parsedMcq.questions.length ? releasedMaxScore / parsedMcq.questions.length : 1;

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
            missedCorrectAnswerLabel={missedCorrectAnswerLabel}
            pointsLabel={pointsLabel}
            questionMaxScore={questionMaxScore}
            onSingleChoice={onSingleChoice}
            onMultipleChoice={onMultipleChoice}
            disabled={disabled}
          />
        );
      })}

      {parsedMcq.questions.length && !hideActions ? (
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
  missedCorrectAnswerLabel,
  pointsLabel,
  questionMaxScore,
  onSingleChoice,
  onMultipleChoice,
  disabled
}: {
  question: McqQuestion;
  index: number;
  selected: string[];
  submitted: boolean;
  showFeedback: boolean;
  questionLabel: string;
  correctLabel: string;
  incorrectLabel: string;
  missedCorrectAnswerLabel: string;
  pointsLabel: string;
  questionMaxScore: number;
  onSingleChoice: (question: McqQuestion, choiceId: string) => void;
  onMultipleChoice: (question: McqQuestion, choiceId: string, checked: boolean) => void;
  disabled: boolean;
}) {
  const expected = question.choices.filter((choice) => choice.isCorrect).map((choice) => choice.id).sort();
  const pointUnit = expected.length ? questionMaxScore / expected.length : 0;
  const correctSelectedCount = selected.filter((choiceId) => expected.includes(choiceId)).length;
  const incorrectSelectedCount = selected.filter((choiceId) => !expected.includes(choiceId)).length;
  const questionScore = clampScore((correctSelectedCount - incorrectSelectedCount) * pointUnit, 0, questionMaxScore);

  return (
    <article className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 18 }}>
      <div style={{ alignItems: "flex-start", display: "flex", gap: 16, justifyContent: "space-between" }}>
        <div className="stack" style={{ flex: "1 1 auto", gap: 6, minWidth: 0 }}>
          <p className="eyebrow">{questionLabel} {index + 1}</p>
          <h3 style={{ margin: 0 }}>{question.title}</h3>
          <MarkdownBlocksView blocks={question.promptBlocks} />
        </div>
        {showFeedback ? (
          <span
            aria-label={`${pointsLabel}: ${formatPoints(questionScore)} / ${formatPoints(questionMaxScore)}`}
            style={{
              alignItems: "center",
              background: "rgba(13, 27, 71, 0.06)",
              border: "1px solid rgba(13, 27, 71, 0.12)",
              borderRadius: 999,
              color: "#0f1b46",
              display: "inline-flex",
              flex: "0 0 auto",
              fontSize: 15,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 800,
              minHeight: 34,
              padding: "6px 12px",
              whiteSpace: "nowrap"
            }}
          >
            {formatPoints(questionScore)} / {formatPoints(questionMaxScore)}
          </span>
        ) : null}
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {question.choices.map((choice) => {
          const checked = selected.includes(choice.id);
          const isCorrectChoice = choice.isCorrect;
          const isMissedCorrectChoice = showFeedback && isCorrectChoice && !checked;
          const isWrongSelectedChoice = showFeedback && checked && !isCorrectChoice;
          const isRightSelectedChoice = showFeedback && checked && isCorrectChoice;
          const pointImpact = showFeedback && (checked || isMissedCorrectChoice)
            ? isRightSelectedChoice
              ? pointUnit
              : -pointUnit
            : null;
          return (
            <label
              key={choice.id}
              style={{
                alignItems: "flex-start",
                background: isRightSelectedChoice
                  ? "rgba(34, 197, 94, 0.08)"
                  : isWrongSelectedChoice
                    ? "rgba(220, 38, 38, 0.06)"
                    : isMissedCorrectChoice
                      ? "rgba(251, 146, 60, 0.08)"
                      : undefined,
                border: isRightSelectedChoice
                  ? "1px solid rgba(22, 163, 74, 0.28)"
                  : isWrongSelectedChoice
                    ? "1px solid rgba(220, 38, 38, 0.24)"
                    : isMissedCorrectChoice
                      ? "1px solid rgba(251, 146, 60, 0.32)"
                      : "1px solid rgba(13, 27, 71, 0.12)",
                borderRadius: 10,
                cursor: disabled ? "default" : "pointer",
                display: "flex",
                gap: 12,
                justifyContent: "flex-start",
                padding: 12
              }}
              >
              {showFeedback ? (
                <AnswerStatusIcon
                  isCorrectChoice={isCorrectChoice}
                  isMissedCorrectChoice={isMissedCorrectChoice}
                  isSelected={checked}
                  correctLabel={correctLabel}
                  incorrectLabel={incorrectLabel}
                  missedCorrectAnswerLabel={missedCorrectAnswerLabel}
                />
              ) : null}
              <input
                checked={checked}
                disabled={disabled}
                name={question.id}
                type={question.mode === "single" ? "radio" : "checkbox"}
                style={{
                  flex: "0 0 auto",
                  margin: "0.15rem 0 0",
                  minHeight: 0,
                  padding: 0,
                  width: "auto"
                }}
                onChange={(event) => {
                  if (disabled) {
                    return;
                  }
                  if (question.mode === "single") {
                    onSingleChoice(question, choice.id);
                  } else {
                    onMultipleChoice(question, choice.id, event.target.checked);
                  }
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <MarkdownBlocksView blocks={choice.blocks} compact />
              </span>
              {pointImpact !== null ? (
                <strong
                  aria-label={`${pointsLabel}: ${formatSignedPoints(pointImpact)}`}
                  style={{
                    alignSelf: "center",
                    color: pointImpact >= 0 ? "#15803d" : "#b91c1c",
                    flex: "0 0 auto",
                    fontVariantNumeric: "tabular-nums"
                  }}
                >
                  {formatSignedPoints(pointImpact)}
                </strong>
              ) : null}
            </label>
          );
        })}
      </div>

    </article>
  );
}

function AnswerStatusIcon({
  isCorrectChoice,
  isMissedCorrectChoice,
  isSelected,
  correctLabel,
  incorrectLabel,
  missedCorrectAnswerLabel
}: {
  isCorrectChoice: boolean;
  isMissedCorrectChoice: boolean;
  isSelected: boolean;
  correctLabel: string;
  incorrectLabel: string;
  missedCorrectAnswerLabel: string;
}) {
  if (!isSelected && !isMissedCorrectChoice) {
    return null;
  }

  const variant = isMissedCorrectChoice ? "missed" : isCorrectChoice ? "correct" : "incorrect";
  const label = isMissedCorrectChoice ? missedCorrectAnswerLabel : isCorrectChoice ? correctLabel : incorrectLabel;
  const styles =
    variant === "correct"
      ? {
          background: "rgba(34, 197, 94, 0.12)",
          border: "1px solid rgba(22, 163, 74, 0.35)",
          color: "#15803d"
        }
      : variant === "missed"
        ? {
            background: "rgba(251, 146, 60, 0.12)",
            border: "1px solid rgba(251, 146, 60, 0.4)",
            color: "#c2410c"
          }
        : {
            background: "rgba(220, 38, 38, 0.1)",
            border: "1px solid rgba(220, 38, 38, 0.28)",
            color: "#b91c1c"
          };

  return (
    <span
      aria-label={label}
      title={label}
      style={{
        ...styles,
        alignItems: "center",
        borderRadius: 999,
        display: "inline-flex",
        flex: "0 0 auto",
        fontSize: 18,
        fontWeight: 800,
        height: 28,
        justifyContent: "center",
        lineHeight: 1,
        width: 28
      }}
    >
      {variant === "correct" ? "✓" : variant === "missed" ? "!" : "×"}
    </span>
  );
}

function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatSignedPoints(value: number) {
  const formatted = formatPoints(Math.abs(value));
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

function formatPoints(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatDisplayGradeScore(
  grade: { rawScore: number; rawMaxScore: number; normalizedScore?: number; normalizedMaxScore?: number },
  displayMaxScore?: number
) {
  if (displayMaxScore !== undefined && grade.rawMaxScore > 0) {
    return (grade.rawScore / grade.rawMaxScore) * displayMaxScore;
  }
  return grade.normalizedScore ?? grade.rawScore;
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
    aiGenerationInstructions: String(activity.config?.aiGenerationInstructions ?? fallbackConfig.aiGenerationInstructions),
    aiQuestionCount: normalizeQuestionCount(activity.config?.aiQuestionCount),
    defaultCodeLanguage: String(activity.config?.defaultCodeLanguage ?? fallbackConfig.defaultCodeLanguage),
    randomizeChoices: Boolean(activity.config?.randomizeChoices ?? fallbackConfig.randomizeChoices)
  };
}

function snapshotsEqual(left: McqFormSnapshot, right: McqFormSnapshot) {
  return (
    left.title === right.title &&
    left.description === right.description &&
    left.source === right.source &&
    left.aiGenerationInstructions === right.aiGenerationInstructions &&
    left.aiQuestionCount === right.aiQuestionCount &&
    left.defaultCodeLanguage === right.defaultCodeLanguage &&
    left.randomizeChoices === right.randomizeChoices
  );
}

function normalizeQuestionCount(value: unknown) {
  const numericValue = Number(value ?? fallbackConfig.aiQuestionCount);
  return Math.max(1, Math.min(20, Number.isFinite(numericValue) ? Math.round(numericValue) : fallbackConfig.aiQuestionCount));
}

function formatSubmissionAvailability(
  copy: (typeof copyByLocale)[keyof typeof copyByLocale],
  availability: { attemptsRemaining: number | null } | null
) {
  if (!availability || availability.attemptsRemaining === null) {
    return copy.submitConfirmUnlimited;
  }
  const remaining = availability.attemptsRemaining;
  return formatCopy(copy.submitConfirmRemaining, {
    remaining,
    after: Math.max(0, remaining - 1)
  });
}

function formatCopy(message: string, vars: Record<string, string | number>) {
  return message.replace(/\{(\w+)\}/g, (_match, key) => String(vars[key] ?? `{${key}}`));
}
