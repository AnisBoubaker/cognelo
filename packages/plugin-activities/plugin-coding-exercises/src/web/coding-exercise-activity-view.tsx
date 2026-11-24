"use client";
import { defaultCodingFileName, codingFiles, codingFilePrivate, codingFileNameSchema, codingFileBlankTemplate, referenceCodingFiles, formatCodingSourceFiles, type CodingFile, type CodingSourceFile, type CodingFilePrivate } from "../coding-files";
import { CodingFileTabs } from "./coding-file-tabs";
import { CodingFilesView } from "./coding-files-view";
import { CodingProjectEditor } from "./coding-project-editor";
import { codingTemplateHasTestCode, codingTemplateLayoutIssues, placeCodingTemplateMarker } from "../template-layout";
import type { AuthoringBlankRange } from "./code-blanks-authoring-model";
import { assembleCodingBlankSource, codingBlankAnswer, codingBlankIds, codingBlankResponseState, readCodingBlankResponse, type CodingBlankAnswers } from "../code-blanks";
import { CodeBlanksAuthoring } from "./code-blanks-authoring";
import { CodeBlanksEditor } from "./code-blanks-editor";
import { HelpLabel, SideNavigation, MonacoModelGroup, MonacoModelScope, useDialogs } from "@cognelo/activity-ui";
import { CodingExerciseGradingGeneral } from "./coding-exercise-grading-general";

import { DialogCloseButton, DialogHeader, getDialogCloseLabel } from "@cognelo/activity-ui";

import { ActionIcon, ConfirmationDialog, useBodyScrollLock, useApplicationTime, formatZonedDateTime } from "@cognelo/activity-ui";

import { type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ActivityExecutionStateHost, TimedActivityAutoSubmit } from "@cognelo/activity-sdk";
import { CodeEditor, ContextMenu, EditActionBar, KnowledgeGenerationModeField, MarkdownRenderer, ProgressDialog, RichTextEditor, getEditActionBarCopy, useActivityKnowledgeGeneration, useNotifications, useUnsavedChangesGuard, type ActivityKnowledgeGenerationRequest, type GeneratedKnowledgeSelection } from "@cognelo/activity-ui";
import {
  balanceCodingExerciseAiRubricCriterionWeights,
  buildCodingExerciseStudentTemplateProjectionFromSource,
  buildCodingExerciseStudentTemplateSource,
  buildCodingExerciseTemplateSource,
  createCodingExerciseAiRubricCriterionId,
  codingExerciseDefaultHiddenTestCount,
  codingExerciseDefaultVisibleTestCount,
  codingExerciseMaxGeneratedTestCount,
  codingExerciseMaxHiddenTestCount,
  codingExerciseTestInsertionToken,
  codingExerciseTemplateInsertionToken,
  getCodingExerciseMaxTestRuns,
  getCodingExerciseAiFeedbackValidationMessages,
  mergeCodingExerciseGeneratedSolutionPrivateConfig,
  normalizeCodingExerciseSampleTests,
  parseCodingExercisePrivateConfig,
  splitCodingExerciseTemplateSource,
  type CodingExerciseConfig,
  type CodingPracticeRunAllowance,
  type CodingExerciseOutputMatchMode,
  type CodingExercisePrivateConfig
} from "../coding-exercises";
import {
  getCodingExerciseActivityConfig,
  getCodingExerciseInitialStudentSource, getCodingExerciseStudentFiles
} from "./coding-exercise-student-source";
import { formatCodingExercisesMessage, normalizeCodingExercisesLocale, type CodingExercisesLocale } from "./messages";
import { applyGeneratedCodingExerciseTests, type TestGenerationMode } from "./coding-exercise-generated-tests";

type ActivityLike = {
  id: string;
  title: string;
  description: string;
  config?: Record<string, unknown>;
  assignment?: {
    id?: string;
    metadata?: Record<string, unknown>;
  };
};

type HiddenTest = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  testCode: string;
  outputMatchMode: CodingExerciseOutputMatchMode;
  containsLinesOrderMatters: boolean;
  isEnabled: boolean;
  weight: number;
  orderIndex?: number;
};

type SampleTest = CodingExerciseConfig["sampleTests"][number];
type RubricCriterion = CodingExercisePrivateConfig["aiFeedback"]["criteria"][number];

type CodingExerciseSnapshot = {
  title: string;
  description: string;
  config: CodingExerciseConfig;
  hiddenTests: HiddenTest[];
  referenceSolution: string;
  privateConfig: CodingExercisePrivateConfig;
};

type CodingExecution = {
  id: string;
  kind: "run" | "submit";
  status: "pending" | "completed" | "failed";
  sourceCode: string;
  files?: CodingSourceFile[];
  stdin: string;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  message?: string | null;
  outputTruncated?: boolean;
  timeSeconds?: string | null;
  memoryKb?: number | null;
  judge0StatusLabel?: string | null;
  resultSummary?: Record<string, unknown>;
  createdAt: string;
};

type CodingAttemptHistory = {
  submission: CodingExecution;
  runs: CodingExecution[];
  aiFeedback?: { feedback?: CodingExerciseAiFeedback } | null;
};

type CodingAttemptAvailability = {
  attemptsRemaining: number | null;
  canStart: boolean;
  reason: string | null;
};

type CodingExerciseAiFeedback = {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  criteria?: Array<{ id?: string; title?: string; scorePercent?: number; feedback?: string }>;
  deterministicScore?: number;
  aiScore?: number;
  combinedScore?: number;
};

type ReferenceValidationTestResult = {
  id: string;
  name: string;
  passed: boolean;
  weight: number;
  statusId?: number | null;
  statusLabel?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  message?: string | null;
  timeSeconds?: string | null;
  memoryKb?: number | null;
};

type ReferenceValidationGroup = {
  testCount?: number;
  passedCount?: number;
  tests?: ReferenceValidationTestResult[];
};

type CodingExerciseValidationReceipt = {
  validationSummary: Record<string, unknown>;
  expiresAt: string;
  signature: string;
};

type ProgrammingLanguageOption = {
  key: string;
  label: string;
};

type CodingExerciseClient = {
  listProgrammingLanguages?: () => Promise<{ languages: ProgrammingLanguageOption[] }>;
  listHiddenTests: (
    courseId: string,
    activityId: string
  ) => Promise<{
    tests: HiddenTest[];
    referenceSolution: { sourceCode: string; privateConfig: CodingExercisePrivateConfig; validationSummary: Record<string, unknown> } | null;
  }>;
  saveHiddenTests: (
    courseId: string,
    activityId: string,
    input: {
      tests: HiddenTest[];
      sampleTests: SampleTest[];
      referenceSolution: string;
      privateConfig: CodingExercisePrivateConfig;
      activityConfig?: Record<string, unknown>;
      validateOnly?: boolean;
      validationReceipt?: CodingExerciseValidationReceipt;
      confirmActiveStudents?: boolean;
    }
  ) => Promise<{
    tests: HiddenTest[];
    referenceSolution: { sourceCode: string; privateConfig: CodingExercisePrivateConfig; validationSummary: Record<string, unknown> } | null;
    validationReceipt?: CodingExerciseValidationReceipt;
  }>;
  runCode: (
    courseId: string,
    activityId: string,
    input: {
      sourceCode: string;
      files?: CodingSourceFile[];
      blankAnswers?: CodingBlankAnswers;
      blankTemplate?: string;
      stdin?: string;
      expectedOutput?: string;
      testCode?: string;
      outputMatchMode?: CodingExerciseOutputMatchMode;
      containsLinesOrderMatters?: boolean;
      compareOutput?: boolean;
    }
  ) => Promise<{ execution: CodingExecution; practiceRuns?: CodingPracticeRunAllowance }>;
  listRuns: (courseId: string, activityId: string) => Promise<{ executions: CodingExecution[]; practiceRuns?: CodingPracticeRunAllowance }>;
  submitCode: (
    courseId: string,
    activityId: string,
    input: { sourceCode: string; files?: CodingSourceFile[]; blankAnswers?: CodingBlankAnswers; blankTemplate?: string }
  ) => Promise<{
    execution: CodingExecution;
    availability: CodingAttemptAvailability;
    aiFeedback?: { feedback?: CodingExerciseAiFeedback } | null;
    aiFeedbackError?: string | null;
  }>;
  listSubmissions: (courseId: string, activityId: string) => Promise<{ executions: CodingExecution[]; practiceRuns?: CodingPracticeRunAllowance }>;
  listHistory?: (
    courseId: string,
    activityId: string
  ) => Promise<{
    currentRuns: CodingExecution[];
    attempts: CodingAttemptHistory[];
    availability: CodingAttemptAvailability;
  }>;
};

type CodingExerciseAiGenerationClient = {
  generatePrompt: (input: { description: string; language: string; locale: CodingExercisesLocale; knowledge: ActivityKnowledgeGenerationRequest }) => Promise<{ prompt: string; attempts: number; knowledgeConceptSelections?: GeneratedKnowledgeSelection[] }>;
  generateSolution: (input: {
    description: string;
    prompt: string;
    language: string;
    locale: CodingExercisesLocale;
    knowledge: ActivityKnowledgeGenerationRequest;
  }) => Promise<
    | {
        status?: "ok" | "warning";
        warningMessage?: string;
        starterCode: string;
        referenceSolution: string;
        templateSource: string;
        templateVisibleLineNumbers: number[];
        attempts: number;
        knowledgeConceptSelections?: GeneratedKnowledgeSelection[];
      }
    | {
        status: "error";
        message: string;
        attempts: number;
      }
  >;
  generateTests: (input: {
    description: string;
    prompt: string;
    language: string;
    locale: CodingExercisesLocale;
    referenceSolution: string;
    templateSource: string;
    templateVisibleLineNumbers: number[];
    visibleTestCount: number;
    hiddenTestCount: number;
    projectFiles?: CodingExerciseConfig["files"];
    projectReferences?: CodingExercisePrivateConfig["fileSources"];
    existingTests?: { sampleTests: SampleTest[]; hiddenTests: HiddenTest[] };
    knowledge: ActivityKnowledgeGenerationRequest;
  }) => Promise<
    | {
        status?: "ok" | "warning";
        warningMessage?: string;
        sampleTests: SampleTest[];
        hiddenTests: Array<Omit<HiddenTest, "orderIndex" | "metadata" | "createdAt" | "updatedAt">>;
        validationSummary: Record<string, unknown>;
        attempts: number;
        knowledgeConceptSelections?: GeneratedKnowledgeSelection[];
      }
    | {
        status: "error";
        message: string;
        attempts: number;
      }
  >;
  generateRubric: (input: {
    guidance: string;
    title: string;
    description: string;
    prompt: string;
    referenceSolution: string;
    language: string;
    locale: CodingExercisesLocale;
    knowledge: ActivityKnowledgeGenerationRequest;
  }, signal?: AbortSignal) => Promise<{ criteria: RubricCriterion[]; attempts: number }>;
  saveRubricGuidance: (guidance: string) => Promise<{ guidance: string }>;
};

type CodingExerciseActivityViewProps = {
  activity: ActivityLike;
  canManage: boolean;
  course?: { id?: string; title: string } | null;
  onSave: (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<ActivityLike>;
  codingClient?: CodingExerciseClient;
  aiGenerationClient?: CodingExerciseAiGenerationClient;
  locale?: string;
  authoringGradingPortalTarget?: HTMLElement | null;
  authoringSolutionPortalTarget?: HTMLElement | null;
  executionStateHost?: ActivityExecutionStateHost<Record<string, unknown>>;
  deferSubmission?: boolean;
  readOnly?: boolean;
  studentViewMode?: "attempt" | "previous";
  onNewAttemptAvailabilityChange?: (canStartNewAttempt: boolean) => void;
  onPreviousSubmissionsAvailabilityChange?: (hasPreviousSubmissions: boolean) => void;
  onSubmitted?: () => void;
  timedAutoSubmit?: TimedActivityAutoSubmit;
};

const personalizedTestId = "__personalized_test__";
const workspaceDividerWidth = 12;
const minimumEditorWidth = 360;
const minimumTestRunnerWidth = 280;

export function CodingExerciseActivityView({
  activity,
  canManage,
  course,
  onSave,
  codingClient,
  aiGenerationClient,
  locale,
  authoringGradingPortalTarget,
  authoringSolutionPortalTarget,
  executionStateHost,
  deferSubmission = false,
  readOnly = false,
  studentViewMode = "attempt",
  onNewAttemptAvailabilityChange,
  onPreviousSubmissionsAvailabilityChange,
  onSubmitted,
  timedAutoSubmit
}: CodingExerciseActivityViewProps) {
  const pluginLocale = normalizeCodingExercisesLocale(locale);
  const actionCopy = getEditActionBarCopy(pluginLocale);
  const t = useCallback((key: Parameters<typeof formatCodingExercisesMessage>[1], values?: Record<string, string | number>) =>
    formatCodingExercisesMessage(pluginLocale, key, values), [pluginLocale]);
  const notifications = useNotifications();
  const dialogs = useDialogs();
  const knowledgeGeneration = useActivityKnowledgeGeneration();
  const aiGenerationDraftRef = useRef<{
    prompt: string;
    referenceSolution: string;
    privateConfig: CodingExercisePrivateConfig;
    language: string;
  } | null>(null);
  const authoringFileHistories = useRef(new Map<string, Map<number, AuthoringBlankRange[]>>());
  useEffect(() => () => { authoringFileHistories.current.clear(); }, [activity.id]);
  const previousActivityIdRef = useRef(activity.id);
  const studentViewModeRef = useRef(studentViewMode);
  studentViewModeRef.current = studentViewMode;
  const lastTimedAutoSubmitRequestRef = useRef(0);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [config, setConfig] = useState<CodingExerciseConfig>(() => getCodingExerciseActivityConfig(activity.config));
  const [programmingLanguages, setProgrammingLanguages] = useState<ProgrammingLanguageOption[]>([]);
  const [hiddenTests, setHiddenTests] = useState<HiddenTest[]>([]);
  const [referenceSolution, setReferenceSolution] = useState("");
  const [privateConfig, setPrivateConfig] = useState<CodingExercisePrivateConfig>(() => parseCodingExercisePrivateConfig({}));
  const [savedSnapshot, setSavedSnapshot] = useState<CodingExerciseSnapshot>(() =>
        buildCodingExerciseSnapshot({
          title: activity.title,
          description: activity.description,
          config: getCodingExerciseActivityConfig(activity.config),
          hiddenTests: [],
      referenceSolution: "",
      privateConfig: parseCodingExercisePrivateConfig({})
    })
  );
  const [authoringLoaded, setAuthoringLoaded] = useState(!canManage);
  const [authoringReload, setAuthoringReload] = useState(0);
  const [authoringLoadFailed, setAuthoringLoadFailed] = useState(false);
  const [referenceValidationSummary, setReferenceValidationSummary] = useState<Record<string, unknown> | null>(null);
  const [expandedSampleTestIds, setExpandedSampleTestIds] = useState<string[]>([]);
  const [expandedHiddenTestIds, setExpandedHiddenTestIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingSolution, setGeneratingSolution] = useState(false);
  const [generatingTests, setGeneratingTests] = useState(false);
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const rubricGenerationRequest = useRef<AbortController | null>(null);
  const rubricGuidanceSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const rubricGenerationScope = useRef<object>({});
  useEffect(() => () => {
    rubricGenerationScope.current = {};
    rubricGenerationRequest.current?.abort();
    rubricGenerationRequest.current = null;
  }, [activity.id]);
  const [rubricGenerationDialogOpen, setRubricGenerationDialogOpen] = useState(false);
  const [rubricGuidanceDraft, setRubricGuidanceDraft] = useState("");
  const rubricGuidanceId = useId();
  useBodyScrollLock(rubricGenerationDialogOpen);
  const [gradingSection, setGradingSection] = useState<"general" | "rubric" | "tests">("general");
  const [replacementDialog, setReplacementDialog] = useState<"prompt" | "solution" | null>(null);
  const [testGenerationDialogOpen, setTestGenerationDialogOpen] = useState(false);
  const [testGenerationMode, setTestGenerationMode] = useState<TestGenerationMode>("add");
  const [visibleTestGenerationCount, setVisibleTestGenerationCount] = useState(codingExerciseDefaultVisibleTestCount);
  const [hiddenTestGenerationCount, setHiddenTestGenerationCount] = useState(codingExerciseDefaultHiddenTestCount);
  const [error, setError] = useState("");
  const [editorCode, setEditorCode] = useState(() => getCodingExerciseInitialStudentSource(activity.config));
  const [restoredBlankTemplate, setRestoredBlankTemplate] = useState<string | null>(null);
  const [blankAnswers, setBlankAnswers] = useState<CodingBlankAnswers>({});
  const [sourceFiles, setSourceFiles] = useState<CodingSourceFile[]>(() => getCodingExerciseStudentFiles(getCodingExerciseActivityConfig(activity.config)));
  const [selectedFileId, setSelectedFileId] = useState("main");
  const [fileEditorSection, setFileEditorSection] = useState<"starter" | "reference" | "template">("reference");
  const isBlanks = config.responseMode === "blanks";
  const activeEditorSection = isBlanks && fileEditorSection === "reference" ? "starter" : fileEditorSection;
  const fileDefinitions = readOnly && sourceFiles.length ? sourceFiles.map(file => ({ ...file, starterCode: "", studentTemplateSource: file.studentTemplateSource ?? "{{ STUDENT_CODE }}" })) : codingFiles(config);
  const activeFile = fileDefinitions.find(file => file.id === selectedFileId) ?? fileDefinitions[0];
  const activeSourceFile = sourceFiles.find(file => file.id === activeFile.id);
  const activeFilePrivate = codingFilePrivate(privateConfig, activeFile.id, config.files ? "" : referenceSolution);
  const blankNumberOffset = fileDefinitions.slice(0, fileDefinitions.indexOf(activeFile)).reduce((count, file) => count + codingBlankIds(file.blankTemplate ?? "").length, 0);
  const projectReferenceSource = config.files ? formatCodingSourceFiles(referenceCodingFiles(config, privateConfig, referenceSolution)) : referenceSolution;
  const maxPracticeRuns = getCodingExerciseMaxTestRuns(config);
  const practiceRunLoadError = t("loadPracticeRunsError");
  const showPracticeRuns = maxPracticeRuns !== 0;
  const [practiceRuns, setPracticeRuns] = useState<CodingPracticeRunAllowance | null>(null);
  const [practiceRunError, setPracticeRunError] = useState("");
  const [practiceRunReload, setPracticeRunReload] = useState(0);
  const [confirmingRun, setConfirmingRun] = useState(false);
  const runRequestPending = useRef<object | null>(null);
  const previewRunCount = useRef(0);
  const isPreview = executionStateHost?.context.kind === "student_preview";
  const [sampleInput, setSampleInput] = useState("");
  const [sampleExpectedOutput, setSampleExpectedOutput] = useState("");
  const [sampleTestCode, setSampleTestCode] = useState("");
  const [sampleOutputMatchMode, setSampleOutputMatchMode] = useState<CodingExerciseOutputMatchMode>("exact");
  const [sampleContainsLinesOrderMatters, setSampleContainsLinesOrderMatters] = useState(false);
  const [selectedSampleTestId, setSelectedSampleTestId] = useState("");
  const [personalizedInput, setPersonalizedInput] = useState("");
  const [workspaceEditorWidth, setWorkspaceEditorWidth] = useState<number | null>(null);
  const [isWorkspaceFullScreen, setIsWorkspaceFullScreen] = useState(false);
  const [runExecution, setRunExecution] = useState<CodingExecution | null>(null);
  const [submitExecution, setSubmitExecution] = useState<CodingExecution | null>(null);
  const [recentRuns, setRecentRuns] = useState<CodingExecution[]>([]);
  const [previousAttempts, setPreviousAttempts] = useState<CodingAttemptHistory[]>([]);
  const [submissionConfirmation, setSubmissionConfirmation] = useState<{
    execution: CodingExecution;
    availability: CodingAttemptAvailability;
    aiFeedback?: { feedback?: CodingExerciseAiFeedback } | null;
    aiFeedbackError?: string | null;
  } | null>(null);
  const [workingAction, setWorkingAction] = useState<"run" | "submit" | null>(null);
  const [loadedExecutionKey, setLoadedExecutionKey] = useState<string | null>(null);
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);
  const [draftReload, setDraftReload] = useState(0);
  const [codeResetVersion, setCodeResetVersion] = useState(0);
  const studentWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const activityConfigKey = useMemo(() => JSON.stringify(activity.config ?? {}), [activity.config]);
  const executionContext = executionStateHost?.context;
  const executionDocumentKey = executionContext?.kind === "test_item"
    ? `${executionContext.parentAttemptId}:${executionContext.testItemId}`
    : executionContext?.kind === "standalone" ? `${executionContext.groupActivityId}:${executionContext.activityAttemptId ?? "draft"}`
      : executionContext?.kind === "student_preview" ? executionContext.previewSessionId : activity.id;
  const executionKey = JSON.stringify([activity.id, activityConfigKey, executionDocumentKey, readOnly]);
  useEffect(() => {
    setWorkingAction(null);
    return () => { runRequestPending.current = null; };
  }, [activity.id, executionDocumentKey]);
  const executionStateLoaded = canManage || !executionStateHost || loadedExecutionKey === executionKey;
  const sampleValidationTests = getReferenceValidationTests(referenceValidationSummary, "sampleTests");
  const hiddenValidationTests = getReferenceValidationTests(referenceValidationSummary, "hiddenTests");
  const templateProjection = buildCodingExerciseStudentTemplateProjectionFromSource(
    activeSourceFile?.studentTemplateSource ?? activeFile.studentTemplateSource ?? buildCodingExerciseTemplateSource("", "")
  );
  const visibleSampleTests = normalizeCodingExerciseSampleTests(config.sampleTests);
  const isPersonalizedTest = selectedSampleTestId === personalizedTestId;
  const aiFeedbackValidationMessages = getCodingExerciseAiFeedbackValidationMessages(privateConfig.aiFeedback);
  const codingExerciseLanguageOptions = config.language && !programmingLanguages.some((language) => language.key === config.language)
    ? [{ key: config.language, label: config.language }, ...programmingLanguages]
    : programmingLanguages;
  const loadLanguagesErrorMessage = t("loadLanguagesError");

  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("coding-exercise-spinner-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "coding-exercise-spinner-style";
    style.textContent = "@keyframes coding-exercise-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  useEffect(() => {
    const isNewActivity = previousActivityIdRef.current !== activity.id;
    const nextConfig = getCodingExerciseActivityConfig(JSON.parse(activityConfigKey) as Record<string, unknown>);
    const sampleTests = normalizeCodingExerciseSampleTests(nextConfig.sampleTests);
    setTitle(activity.title);
    setDescription(activity.description);
    setConfig(nextConfig);
    if (!canManage) {
      setSavedSnapshot(
        buildCodingExerciseSnapshot({
          title: activity.title,
          description: activity.description,
          config: nextConfig,
          hiddenTests: [],
          referenceSolution: "",
          privateConfig: parseCodingExercisePrivateConfig({})
        })
      );
    }
    if (isNewActivity || canManage) {
      setEditorCode(getCodingExerciseInitialStudentSource(nextConfig));
      setSourceFiles(getCodingExerciseStudentFiles(nextConfig));
      setSelectedFileId("main");
      setBlankAnswers({});
    }
    setSelectedSampleTestId(sampleTests[0]?.id ?? personalizedTestId);
    setPersonalizedInput("");
    setWorkspaceEditorWidth(null);
    setIsWorkspaceFullScreen(false);
    setSampleInput(sampleTests[0]?.input ?? "");
    setSampleExpectedOutput(sampleTests[0]?.output ?? "");
    setSampleTestCode(sampleTests[0]?.testCode ?? "");
    setSampleOutputMatchMode(sampleTests[0]?.outputMatchMode ?? "exact");
    setSampleContainsLinesOrderMatters(sampleTests[0]?.containsLinesOrderMatters ?? false);
    setRunExecution(null);
    setSubmitExecution(null);
    setSubmissionConfirmation(null);
    if (isNewActivity) {
      setGeneratingRubric(false);
      setRubricGenerationDialogOpen(false);
      setHiddenTests([]);
      setReferenceSolution("");
      setPrivateConfig(parseCodingExercisePrivateConfig({}));
      setReferenceValidationSummary(null);
      setExpandedSampleTestIds([]);
      setExpandedHiddenTestIds([]);
      setRecentRuns([]);
      setPreviousAttempts([]);
      aiGenerationDraftRef.current = null;
    }
    setError("");
    setReplacementDialog(null);
    previousActivityIdRef.current = activity.id;
  }, [activity.id, activity.title, activity.description, activityConfigKey, canManage]);

  useEffect(() => {
    const workspace = studentWorkspaceRef.current;
    if (!workspace || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      setWorkspaceEditorWidth((current) => {
        if (current === null) return null;
        const { min, max } = getStudentWorkspaceEditorLimits(workspace);
        return Math.min(max, Math.max(min, current));
      });
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [canManage]);

  useEffect(() => {
    if (!isWorkspaceFullScreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsWorkspaceFullScreen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isWorkspaceFullScreen]);

  useEffect(() => {
    if (canManage || !executionStateHost) {
      return;
    }
    let cancelled = false;
    setLoadedExecutionKey(null);
    setDraftLoadFailed(false);
    setError("");
    const initialSourceCode = getCodingExerciseInitialStudentSource(
      JSON.parse(activityConfigKey) as Record<string, unknown>
    );
    executionStateHost.load()
      .then((saved) => {
        const nextConfig = getCodingExerciseActivityConfig(JSON.parse(activityConfigKey));
        const restored = readCodingBlankResponse(saved);
        const displayTemplate = readOnly && restored ? restored.blankTemplate : nextConfig.blankTemplate ?? "";
        const files = getCodingExerciseStudentFiles(nextConfig, saved, readOnly);
        const allTemplates = nextConfig.files ? files.map(file => file.blankTemplate ?? "").join("\n") : displayTemplate;
        const answers = nextConfig.responseMode === "blanks" ? Object.fromEntries(codingBlankIds(allTemplates).map(id => [id, codingBlankAnswer(restored?.blankAnswers ?? {}, id)])) : {};
        const sourceCode = nextConfig.responseMode === "blanks"
          ? Object.values(answers).some(value => value.trim()) ? nextConfig.files ? formatCodingSourceFiles(files) : codingBlankResponseState(displayTemplate, answers).sourceCode : ""
          : nextConfig.files || files.length ? formatCodingSourceFiles(files) : typeof saved?.sourceCode === "string" ? saved.sourceCode : initialSourceCode;
        if (cancelled) return;
        setSourceFiles(files);
        setRestoredBlankTemplate(displayTemplate);
        setBlankAnswers(answers);
        setEditorCode(sourceCode);
        if (!cancelled) setLoadedExecutionKey(executionKey);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("loadHistoryError"));
          setDraftLoadFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, [activity.id, activityConfigKey, canManage, executionStateHost, readOnly, executionKey, draftReload]);

  useEffect(() => {
    if (!canManage || !codingClient?.listProgrammingLanguages) return;
    let cancelled = false;
    codingClient.listProgrammingLanguages()
      .then((result) => {
        if (!cancelled) setProgrammingLanguages(result.languages);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : loadLanguagesErrorMessage);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, codingClient, loadLanguagesErrorMessage]);

  useEffect(() => {
    if (!canManage || !course?.id || !codingClient) {
      setAuthoringLoaded(true);
      return;
    }
    let cancelled = false;
    setAuthoringLoaded(false);
    setAuthoringLoadFailed(false);
    codingClient
      .listHiddenTests(course.id, activity.id)
      .then((result) => {
        if (cancelled) return;
        setHiddenTests(result.tests);
        setReferenceSolution(result.referenceSolution?.sourceCode ?? "");
        setPrivateConfig(parseCodingExercisePrivateConfig(result.referenceSolution?.privateConfig ?? {}));
        aiGenerationDraftRef.current = null;
        setSavedSnapshot(
          buildCodingExerciseSnapshot({
            title,
            description,
            config,
            hiddenTests: result.tests,
            referenceSolution: result.referenceSolution?.sourceCode ?? "",
            privateConfig: parseCodingExercisePrivateConfig(result.referenceSolution?.privateConfig ?? {})
          })
        );
        setReferenceValidationSummary(result.referenceSolution?.validationSummary ?? null);
        setError("");
        setAuthoringLoaded(true);
      })
      .catch((err) => { if (!cancelled) { setAuthoringLoadFailed(true); setError(err instanceof Error ? err.message : t("loadHiddenTestsError")); } });
    return () => { cancelled = true; };
  }, [activity.id, canManage, course?.id, authoringReload]);

  useEffect(() => {
    if (canManage || deferSubmission || !course?.id || !codingClient?.listHistory) {
      return;
    }

    let cancelled = false;
    codingClient.listHistory(course.id, activity.id)
      .then((history) => {
        if (cancelled) return;
        setRecentRuns(history.currentRuns);
        setPreviousAttempts(history.attempts);
        onNewAttemptAvailabilityChange?.(!readOnly && history.availability.canStart);
        onPreviousSubmissionsAvailabilityChange?.(history.attempts.length > 0);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("loadHistoryError"));
      });
    return () => {
      cancelled = true;
    };
  }, [activity.id, canManage, codingClient, course?.id, deferSubmission, onNewAttemptAvailabilityChange, onPreviousSubmissionsAvailabilityChange, readOnly]);

  useEffect(() => {
    if (canManage || readOnly || studentViewMode === "previous") return;
    setPracticeRunError("");
    if (maxPracticeRuns === null || maxPracticeRuns === 0) {
      setPracticeRuns({ limit: maxPracticeRuns, used: 0, remaining: maxPracticeRuns });
      return;
    }
    if (!course?.id || !codingClient) return;
    let cancelled = false;
    setPracticeRuns(null);
    void (async () => {
      if (isPreview && executionStateHost) {
        const saved = await executionStateHost.load();
        previewRunCount.current = typeof saved?.previewPracticeRunsUsed === "number" ? saved.previewPracticeRunsUsed : 0;
        return { limit: maxPracticeRuns, used: previewRunCount.current, remaining: Math.max(0, maxPracticeRuns - previewRunCount.current) };
      }
      const result = await codingClient.listRuns(course.id!, activity.id);
      if (!result.practiceRuns) throw new Error(practiceRunLoadError);
      return result.practiceRuns;
    })().then(value => { if (!cancelled) setPracticeRuns(value); })
      .catch(err => { if (!cancelled) setPracticeRunError(err instanceof Error ? err.message : practiceRunLoadError); });
    return () => { cancelled = true; };
  }, [activity.id, canManage, readOnly, studentViewMode, maxPracticeRuns, codingClient, course?.id, executionStateHost, isPreview, practiceRunReload, practiceRunLoadError]);

  async function refreshPracticeRuns() {
    if (maxPracticeRuns === null || maxPracticeRuns === 0 || !course?.id || !codingClient) return;
    const result = await codingClient.listRuns(course.id, activity.id);
    if (result.practiceRuns) setPracticeRuns(result.practiceRuns);
  }

  function updateSampleTest(index: number, field: keyof CodingExerciseConfig["sampleTests"][number], value: string | boolean) {
    setConfig((current) => {
      const next = [...normalizeCodingExerciseSampleTests(current.sampleTests)];
      const item = next[index];
      if (!item) {
        return current;
      }
      next[index] = { ...item, [field]: value };
      return { ...current, sampleTests: next };
    });
  }

  function addSampleTest() {
    const nextId = `sample-${normalizeCodingExerciseSampleTests(config.sampleTests).length + 1}`;
    setConfig((current) => ({
      ...current,
      sampleTests: [
        ...normalizeCodingExerciseSampleTests(current.sampleTests),
        {
          id: nextId,
          input: "",
          output: "",
          testCode: "",
          title: "",
          outputMatchMode: "exact",
          containsLinesOrderMatters: false
        }
      ]
    }));
    setExpandedSampleTestIds((current) => [...current, nextId]);
  }

  function removeSampleTest(index: number) {
    setConfig((current) => ({
      ...current,
      sampleTests: normalizeCodingExerciseSampleTests(current.sampleTests).filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function updateHiddenTest(index: number, field: keyof HiddenTest, value: string | boolean | number) {
    setHiddenTests((current) =>
      current.map((test, currentIndex) => (currentIndex === index ? { ...test, [field]: value } : test))
    );
  }

  function addHiddenTest() {
    const nextId = `hidden-test-${hiddenTests.length + 1}`;
    setHiddenTests((current) => [
      ...current,
      {
        id: nextId,
        name: `Hidden test ${current.length + 1}`,
        stdin: "",
        expectedOutput: "",
        testCode: "",
        outputMatchMode: "exact",
        containsLinesOrderMatters: false,
        isEnabled: true,
        weight: 1,
        orderIndex: current.length
      }
    ]);
    setExpandedHiddenTestIds((current) => [...current, nextId]);
  }

  function applySampleTest(testId: string) {
    if (testId === personalizedTestId) {
      setSelectedSampleTestId(testId);
      setSampleInput(personalizedInput);
      setSampleExpectedOutput("");
      setSampleTestCode("");
      setSampleOutputMatchMode("exact");
      setSampleContainsLinesOrderMatters(false);
      setRunExecution(null);
      return;
    }
    const selectedTest = normalizeCodingExerciseSampleTests(config.sampleTests).find((test) => test.id === testId);
    setSelectedSampleTestId(testId);
    setSampleInput(selectedTest?.input ?? "");
    setSampleExpectedOutput(selectedTest?.output ?? "");
    setSampleTestCode(selectedTest?.testCode ?? "");
    setSampleOutputMatchMode(selectedTest?.outputMatchMode ?? "exact");
    setSampleContainsLinesOrderMatters(selectedTest?.containsLinesOrderMatters ?? false);
    setRunExecution(null);
  }

  function updateRunInput(value: string) {
    setSampleInput(value);
    if (selectedSampleTestId === personalizedTestId) {
      setPersonalizedInput(value);
    }
  }

  function resizeStudentWorkspace(event: ReactPointerEvent<HTMLDivElement>) {
    const workspace = studentWorkspaceRef.current;
    if (!workspace) return;
    const bounds = workspace.getBoundingClientRect();
    const { min, max } = getStudentWorkspaceEditorLimits(workspace);
    const nextWidth = event.clientX - bounds.left;
    setWorkspaceEditorWidth(Math.min(max, Math.max(min, nextWidth)));
  }

  function removeHiddenTest(index: number) {
    setHiddenTests((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function toggleTemplateVisibleLine(lineIndex: number) {
    aiGenerationDraftRef.current = null;
    const visible = activeFilePrivate.templateVisibleLineNumbers;
    updateAuthorFilePrivate({ templateVisibleLineNumbers: visible.includes(lineIndex)
      ? visible.filter(value => value !== lineIndex) : [...visible, lineIndex].sort((left, right) => left - right) });
  }

  function blankAuthoringHistory(id: string) {
    const key = `${activity.id}:${id}`;
    let history = authoringFileHistories.current.get(key);
    if (!history) { history = new Map(); authoringFileHistories.current.set(key, history); }
    return history;
  }
  function updateAuthorFile(id: string, patch: Partial<CodingFile>) {
    setConfig(current => {
      if (!current.files) return { ...current, ...patch };
      const files = current.files.map(file => file.id === id ? { ...file, ...patch } : file);
      return { ...current, files, starterCode: files[0].starterCode, blankTemplate: files[0].blankTemplate, studentTemplateSource: files[0].studentTemplateSource };
    });
  }
  function updateAuthorFilePrivate(patch: Partial<CodingFilePrivate>) {
    aiGenerationDraftRef.current = null;
    const { referenceSolution: nextReference, ...templatePatch } = patch;
    if (!config.files) {
      if (nextReference !== undefined) setReferenceSolution(nextReference);
      setPrivateConfig(current => ({ ...current, ...templatePatch }));
      return;
    }
    setPrivateConfig(current => ({ ...current,
      fileSources: { ...current.fileSources, [activeFile.id]: { ...codingFilePrivate(current, activeFile.id), ...patch } },
      ...(activeFile.id === config.files![0].id ? templatePatch : {}) }));
  }
  function initializePrivateFiles() {
    if (config.files) return;
    const first = codingFiles(config)[0];
    setPrivateConfig(current => ({ ...current, fileSources: { ...current.fileSources,
      [first.id]: codingFilePrivate(current, first.id, referenceSolution) } }));
  }
  function placeTemplateMarker(token: string) {
    const editor = document.getElementById(`coding-template-${activeFile.id}`) as HTMLTextAreaElement | null;
    const source = activeFilePrivate.templateSource;
    const placed = placeCodingTemplateMarker(source, token, editor?.selectionStart ?? source.length, editor?.selectionEnd ?? source.length);
    if (config.files && token === codingExerciseTestInsertionToken) {
      const definitions = config.files;
      setPrivateConfig(current => {
        const fileSources = Object.fromEntries(definitions.map(file => {
          const currentFile = codingFilePrivate(current, file.id);
          return [file.id, { ...currentFile, templateSource: file.id === activeFile.id ? placed.source : currentFile.templateSource.replaceAll(token, "") }];
        }));
        return { ...current, fileSources, templateSource: fileSources[definitions[0].id].templateSource };
      });
    } else updateAuthorFilePrivate({ templateSource: placed.source });
    requestAnimationFrame(() => { editor?.focus(); editor?.setSelectionRange(placed.cursor, placed.cursor); });
  }
  function validFileName(name: string, excluding?: string) {
    if (!codingFileNameSchema.safeParse(name).success || codingFiles(config).some(file => file.id !== excluding && file.name.toLowerCase() === name.toLowerCase())) {
      notifications.error(t("invalidFileName")); return false;
    }
    return true;
  }
  function addFile(name: string) {
    if (!validFileName(name) || codingFiles(config).length >= 20) return false;
    initializePrivateFiles();
    const id = `file-${crypto.randomUUID()}`;
    const file: CodingFile = { id, name, starterCode: "", ...(isBlanks ? { blankTemplate: "" } : {}), studentTemplateSource: "{{ STUDENT_CODE }}" };
    setConfig(current => ({ ...current, files: [...codingFiles(current), file] }));
    setPrivateConfig(current => ({ ...current, fileSources: { ...current.fileSources,
      [id]: { referenceSolution: "", templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] } } }));
    setSelectedFileId(id); return true;
  }
  function renameFile(id: string, name: string) {
    if (!validFileName(name, id)) return false;
    initializePrivateFiles();
    setConfig(current => ({ ...current, files: codingFiles(current).map(file => file.id === id ? { ...file, name } : file) }));
    return true;
  }
  async function removeFile(id: string) {
    const file = codingFiles(config).find(file => file.id === id);
    if (!file || !await dialogs.confirm({ message: t("removeFileConfirm", { name: file.name }), confirmVariant: "danger" })) return;
    setConfig(current => ({ ...current, files: current.files?.filter(file => file.id !== id) }));
    setPrivateConfig(current => ({ ...current, fileSources: Object.fromEntries(Object.entries(current.fileSources ?? {}).filter(([key]) => key !== id)),
      blankReferenceAnswers: Object.fromEntries(Object.entries(current.blankReferenceAnswers ?? {}).filter(([key]) => !codingBlankIds(file.blankTemplate ?? "").includes(key))) }));
    setSelectedFileId(codingFiles(config)[0].id);
  }

  function toggleSampleTest(testId: string) {
    setExpandedSampleTestIds((current) =>
      current.includes(testId) ? current.filter((value) => value !== testId) : [...current, testId]
    );
  }

  function toggleHiddenTest(testId: string) {
    setExpandedHiddenTestIds((current) =>
      current.includes(testId) ? current.filter((value) => value !== testId) : [...current, testId]
    );
  }

  const currentSnapshot = useMemo(
    () =>
      buildCodingExerciseSnapshot({
        title,
        description,
        config,
        hiddenTests,
        referenceSolution,
        privateConfig
      }),
    [config, description, hiddenTests, privateConfig, referenceSolution, title]
  );
  const hasUnsavedChanges = canManage && !codingExerciseSnapshotsEqual(currentSnapshot, savedSnapshot);

  const discardChanges = useCallback(() => {
    setTitle(savedSnapshot.title);
    setDescription(savedSnapshot.description);
    setConfig(savedSnapshot.config);
    setHiddenTests(savedSnapshot.hiddenTests);
    setReferenceSolution(savedSnapshot.referenceSolution);
    setPrivateConfig(savedSnapshot.privateConfig);
    setReplacementDialog(null);
    setError("");
  }, [savedSnapshot]);

  const saveCodingExercise = useCallback(async (options?: { rethrow?: boolean }) => {
    setSaving(true);
    setError("");

    try {
      if (!config.language) {
        throw new Error(t("languageRequired"));
      }
      const aiFeedbackValidationMessage = getCodingExerciseAiFeedbackValidationMessages(privateConfig.aiFeedback)[0];
      if (aiFeedbackValidationMessage) {
        throw new Error(aiFeedbackValidationMessage);
      }
      const normalizedPrivateConfig = parseCodingExercisePrivateConfig({ ...getPersistedPrivateConfig(privateConfig),
        ...(config.files ? { fileSources: Object.fromEntries(config.files.map((file, index) => [file.id,
          privateConfig.fileSources?.[file.id] ?? { referenceSolution: isBlanks ? assembleCodingBlankSource(file.blankTemplate ?? "", privateConfig.blankReferenceAnswers ?? {}) : index === 0 ? referenceSolution : "",
            templateSource: index === 0 ? privateConfig.templateSource || "{{ STUDENT_CODE }}" : "{{ STUDENT_CODE }}",
            templateVisibleLineNumbers: index === 0 ? privateConfig.templateVisibleLineNumbers : [] }])) } : {}) });

      const templateIssues = codingTemplateLayoutIssues(config, normalizedPrivateConfig);
      if (templateIssues.length) throw new Error(templateIssues[0]);

      if (
        !codingTemplateHasTestCode(config, normalizedPrivateConfig) && [
          ...normalizeCodingExerciseSampleTests(config.sampleTests),
          ...hiddenTests
        ].some(test => test.testCode?.trim())
      ) {
        throw new Error(t("templateTestCodeMissingMarker"));
      }

      const persistedActivityConfig: CodingExerciseConfig = {
        prompt: config.prompt,
        language: config.language,
        executionMode: "template",
        ...(config.responseMode ? { responseMode: config.responseMode } : {}),
        ...(isBlanks ? { blankTemplate: config.blankTemplate ?? "" } : {}),
        ...(config.maxTestRuns !== undefined ? { maxTestRuns: config.maxTestRuns } : {}),
        ...(privateConfig.aiFeedback.testsEnabled !== undefined ? { testsEnabled: privateConfig.aiFeedback.testsEnabled } : {}),
        ...(config.files ? { files: config.files.map(file => ({ ...file, starterCode: isBlanks ? "" : file.starterCode,
          studentTemplateSource: buildCodingExerciseStudentTemplateSource(codingFilePrivate(normalizedPrivateConfig, file.id).templateSource,
            codingFilePrivate(normalizedPrivateConfig, file.id).templateVisibleLineNumbers, config.language) })) } : {}),
        starterCode: isBlanks ? "" : config.starterCode,
        studentTemplateSource: buildCodingExerciseStudentTemplateSource(
          normalizedPrivateConfig.templateSource,
          normalizedPrivateConfig.templateVisibleLineNumbers,
          config.language
        ),
        sampleTests: normalizeCodingExerciseSampleTests(config.sampleTests),
        maxEditorSeconds: config.maxEditorSeconds
      };
      if (isBlanks && !codingBlankIds(codingFileBlankTemplate(config)).length) throw new Error(t("blankTemplateInvalid"));
      const savedReferenceSolution = config.files ? projectReferenceSource : isBlanks
        ? assembleCodingBlankSource(config.blankTemplate ?? "", privateConfig.blankReferenceAnswers ?? {}) : referenceSolution;
      const hiddenTestsInput = {
        tests: hiddenTests.map((test, index) => ({
          ...test,
          orderIndex: index
        })),
        sampleTests: normalizeCodingExerciseSampleTests(config.sampleTests),
        referenceSolution: savedReferenceSolution,
        privateConfig: normalizedPrivateConfig,
        activityConfig: persistedActivityConfig
      };

      let validationReceipt: CodingExerciseValidationReceipt | undefined;
      if (canManage && course?.id && codingClient) {
        const validationResult = await codingClient.saveHiddenTests(course.id, activity.id, {
          ...hiddenTestsInput,
          validateOnly: true
        });
        setReferenceValidationSummary(validationResult.referenceSolution?.validationSummary ?? null);
        validationReceipt = validationResult.validationReceipt;
      }

      const savedActivity = await onSave({
        title,
        description,
        config: persistedActivityConfig
      });

      if (canManage && course?.id && codingClient) {
        const result = await codingClient.saveHiddenTests(course.id, activity.id, {
          ...hiddenTestsInput,
          validationReceipt,
          confirmActiveStudents: (savedActivity as ActivityLike & { liveChangeConfirmed?: boolean }).liveChangeConfirmed
        });
        setHiddenTests(result.tests);
        setReferenceSolution(result.referenceSolution?.sourceCode ?? "");
        setPrivateConfig(parseCodingExercisePrivateConfig(result.referenceSolution?.privateConfig ?? {}));
        setConfig(persistedActivityConfig);
        setSavedSnapshot(
          buildCodingExerciseSnapshot({
            title,
            description,
            config: persistedActivityConfig,
            hiddenTests: result.tests,
            referenceSolution: result.referenceSolution?.sourceCode ?? "",
            privateConfig: parseCodingExercisePrivateConfig(result.referenceSolution?.privateConfig ?? {})
          })
        );
        setReferenceValidationSummary(result.referenceSolution?.validationSummary ?? null);
      } else {
        setConfig(persistedActivityConfig);
        setSavedSnapshot({ ...currentSnapshot, config: persistedActivityConfig });
      }

      notifications.success(t("saved"));
      setError("");
    } catch (err) {
      if (isApiErrorLike(err) && err.code === "ACTION_CANCELLED") {
        if (options?.rethrow) throw err;
        return;
      }
      if (isApiErrorLike(err) && err.code === "REFERENCE_SOLUTION_VALIDATION_FAILED") {
        const details = normalizeObject(err.details);
        const validationSummary = normalizeObject(details?.validationSummary);
        if (validationSummary) {
          setReferenceValidationSummary(validationSummary);
        }
        notifications.error(formatReferenceValidationFailureMessage(details, pluginLocale));
        setError("");
        if (options?.rethrow) {
          throw err;
        }
        return;
      }
      notifications.error(err instanceof Error ? err.message : t("saveError"));
      setError("");
      if (options?.rethrow) {
        throw err;
      }
    } finally {
      setSaving(false);
    }
  }, [activity.id, canManage, codingClient, config, course?.id, currentSnapshot, description, hiddenTests, isBlanks, notifications, onSave, privateConfig, referenceSolution, projectReferenceSource, pluginLocale, t, title]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedChanges,
        onSave: () => saveCodingExercise({ rethrow: true }),
        onDiscard: discardChanges
      }),
      [discardChanges, hasUnsavedChanges, saveCodingExercise]
    )
  );

  async function saveActivityAndHiddenTests(event: FormEvent) {
    event.preventDefault();
    await saveCodingExercise();
  }

  function requestPromptGeneration() {
    if (!aiGenerationClient) {
      return;
    }
    if (!config.language) {
      notifications.error(t("languageRequired"));
      return;
    }
    if (description.trim().length < 10) {
      notifications.error(t("generatePromptDescriptionRequired"));
      return;
    }
    if (config.prompt.trim()) {
      setReplacementDialog("prompt");
      return;
    }
    void generatePrompt();
  }

  async function generatePrompt() {
    if (!aiGenerationClient || !config.language) {
      return;
    }

    setGeneratingPrompt(true);
    setReplacementDialog(null);
    setError("");
    try {
      const result = await aiGenerationClient.generatePrompt({
        description,
        language: config.language,
        locale: pluginLocale,
        knowledge: knowledgeGeneration.request
      });
      setConfig((current) => ({ ...current, prompt: result.prompt }));
      knowledgeGeneration.applySelections(result.knowledgeConceptSelections);
      notifications.success(result.attempts > 1 ? `${t("generatedPrompt")} (${result.attempts})` : t("generatedPrompt"));
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("generatePromptError"));
    } finally {
      setGeneratingPrompt(false);
    }
  }

  function requestSolutionGeneration() {
    if (!aiGenerationClient) {
      return;
    }
    if (!config.language) {
      notifications.error(t("languageRequired"));
      return;
    }
    if (config.prompt.trim().length < 10) {
      notifications.error(t("generateSolutionPromptRequired"));
      return;
    }
    if (hasExistingGeneratedSolutionContent(config, privateConfig, projectReferenceSource)) {
      setReplacementDialog("solution");
      return;
    }
    void generateSolution();
  }

  async function generateSolution() {
    if (!aiGenerationClient || !config.language || (config.files?.length ?? 0) > 1) {
      return;
    }

    setGeneratingSolution(true);
    setReplacementDialog(null);
    setError("");
    try {
      const result = await aiGenerationClient.generateSolution({
        description,
        prompt: config.prompt,
        language: config.language,
        locale: pluginLocale,
        knowledge: knowledgeGeneration.request
      });
      if (result.status === "error") {
        notifications.error(result.message);
        return;
      }
      setConfig((current) => ({
        ...current,
        starterCode: result.starterCode,
        studentTemplateSource: result.templateSource,
        ...(current.files ? { files: current.files.map((file, index) => index === 0 ? { ...file, starterCode: result.starterCode, studentTemplateSource: result.templateSource } : file) } : {})
      }));
      setReferenceSolution(result.referenceSolution);
      const generatedPrivateConfig = mergeCodingExerciseGeneratedSolutionPrivateConfig(privateConfig, result);
      if (config.files) generatedPrivateConfig.fileSources = { ...privateConfig.fileSources, [config.files[0].id]: { referenceSolution: result.referenceSolution, templateSource: result.templateSource, templateVisibleLineNumbers: result.templateVisibleLineNumbers } };
      setPrivateConfig(generatedPrivateConfig);
      aiGenerationDraftRef.current = {
        prompt: config.prompt,
        referenceSolution: result.referenceSolution,
        privateConfig: generatedPrivateConfig,
        language: config.language
      };
      setReferenceValidationSummary(null);
      knowledgeGeneration.applySelections(result.knowledgeConceptSelections);
      if (result.status === "warning" && result.warningMessage) {
        notifications.warning(result.warningMessage);
      }
      notifications.success(result.attempts > 1 ? `${t("generatedSolution")} (${result.attempts})` : t("generatedSolution"));
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("generateSolutionError"));
    } finally {
      setGeneratingSolution(false);
    }
  }

  function requestTestsGeneration() {
    if (!aiGenerationClient) {
      return;
    }
    if (!config.language) {
      notifications.error(t("languageRequired"));
      return;
    }
    const draft = aiGenerationDraftRef.current;
    const promptForGeneration = config.prompt.trim() ? config.prompt : draft?.prompt ?? "";
    const referenceSolutionForGeneration = projectReferenceSource.trim() ? projectReferenceSource : draft?.referenceSolution ?? "";
    if (promptForGeneration.trim().length < 10) {
      notifications.error(t("generateTestsPromptRequired"));
      return;
    }
    if (!referenceSolutionForGeneration.trim()) {
      notifications.error(t("generateTestsReferenceRequired"));
      return;
    }
    openTestGenerationCountDialog();
  }

  function openTestGenerationCountDialog() {
    setTestGenerationMode("add");
    setVisibleTestGenerationCount(Math.min(codingExerciseDefaultVisibleTestCount, codingExerciseMaxGeneratedTestCount - visibleSampleTests.length));
    setHiddenTestGenerationCount(Math.min(codingExerciseDefaultHiddenTestCount, codingExerciseMaxHiddenTestCount - hiddenTests.length));
    setReplacementDialog(null);
    setTestGenerationDialogOpen(true);
  }

  async function generateTests(input: {
    mode: TestGenerationMode;
    visibleTestCount: number;
    hiddenTestCount: number;
  }) {
    if (!aiGenerationClient || !config.language || !testGenerationCountsValid) {
      return;
    }

    const { visibleTestCount, hiddenTestCount } = input;
    setGeneratingTests(true);
    setReplacementDialog(null);
    setTestGenerationDialogOpen(false);
    setError("");
    try {
      const draft = aiGenerationDraftRef.current;
      const promptForGeneration = config.prompt.trim() ? config.prompt : draft?.prompt ?? "";
      const referenceSolutionForGeneration = projectReferenceSource.trim() ? projectReferenceSource : draft?.referenceSolution ?? "";
      const privateConfigForGeneration = draft?.referenceSolution === referenceSolutionForGeneration ? draft.privateConfig : privateConfig;
      const persistedPrivateConfig = getPersistedPrivateConfig(privateConfigForGeneration);
      const result = await aiGenerationClient.generateTests({
        description,
        prompt: promptForGeneration,
        language: config.language,
        locale: pluginLocale,
        referenceSolution: referenceSolutionForGeneration,
        templateSource: persistedPrivateConfig.templateSource,
        templateVisibleLineNumbers: persistedPrivateConfig.templateVisibleLineNumbers,
        ...(config.files ? { projectFiles: config.files, projectReferences: Object.fromEntries(referenceCodingFiles(config, persistedPrivateConfig, referenceSolutionForGeneration).map(file => [file.id, { ...codingFilePrivate(persistedPrivateConfig, file.id), referenceSolution: file.sourceCode }])) } : {}),
        visibleTestCount,
        hiddenTestCount,
        ...(input.mode === "add" ? { existingTests: { sampleTests: visibleSampleTests, hiddenTests } } : {}),
        knowledge: knowledgeGeneration.request
      });
      if (result.status === "error") {
        notifications.error(result.message);
        return;
      }
      const generated = applyGeneratedCodingExerciseTests({
        mode: input.mode,
        currentSampleTests: visibleSampleTests,
        currentHiddenTests: hiddenTests,
        sampleTests: normalizeCodingExerciseSampleTests(result.sampleTests),
        hiddenTests: result.hiddenTests.map((test) => ({
          ...test,
          outputMatchMode: "contains_lines" as const,
          containsLinesOrderMatters: false
        })),
        validationSummary: result.validationSummary
      });
      setConfig((current) => ({ ...current, sampleTests: generated.sampleTests }));
      setHiddenTests(generated.hiddenTests);
      setReferenceValidationSummary(generated.validationSummary);
      setExpandedSampleTestIds((current) => [
        ...(input.mode === "add" ? current : []), ...generated.addedSampleTests.map((test) => test.id)
      ]);
      setExpandedHiddenTestIds((current) => [
        ...(input.mode === "add" ? current : []), ...generated.addedHiddenTests.map((test) => test.id)
      ]);
      knowledgeGeneration.applySelections(result.knowledgeConceptSelections);
      if (result.status === "warning" && result.warningMessage) {
        notifications.warning(result.warningMessage);
      }
      if (result.sampleTests.length < visibleTestCount || result.hiddenTests.length < hiddenTestCount) {
        notifications.warning(t("generatedTestsPartial", {
          visible: result.sampleTests.length, requestedVisible: visibleTestCount,
          hidden: result.hiddenTests.length, requestedHidden: hiddenTestCount
        }));
      } else {
        notifications.success(result.attempts > 1 ? `${t("generatedTests")} (${result.attempts})` : t("generatedTests"));
      }
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("generateTestsError"));
    } finally {
      setGeneratingTests(false);
    }
  }

  function requestRubricGeneration() {
    if (!aiGenerationClient) {
      return;
    }
    if (!config.language) {
      notifications.error(t("languageRequired"));
      return;
    }
    if (!title.trim() || config.prompt.trim().length < 10 || !projectReferenceSource.trim()) {
      notifications.error(t("generateRubricRequirements"));
      return;
    }
    setRubricGuidanceDraft(privateConfig.rubricGenerationGuidance ?? "");
    setRubricGenerationDialogOpen(true);
  }

  function cancelRubricGeneration() {
    rubricGenerationRequest.current?.abort();
    rubricGenerationRequest.current = null;
    setGeneratingRubric(false);
    setRubricGenerationDialogOpen(false);
  }

  async function generateRubric() {
    if (!aiGenerationClient || !config.language || rubricGenerationRequest.current) return;
    const controller = new AbortController();
    const scope = rubricGenerationScope.current;
    rubricGenerationRequest.current = controller;
    const isCurrent = () => rubricGenerationRequest.current === controller && !controller.signal.aborted
      && rubricGenerationScope.current === scope;
    setGeneratingRubric(true);
    setError("");
    try {
      // Confirmed preference writes finish in order, even when generation is cancelled.
      // They never replace rubric criteria or other unsaved authoring fields.
      const saveGuidance = rubricGuidanceSaveQueue.current.then(async () => {
        if (!isCurrent()) return undefined;
        const { guidance } = await aiGenerationClient.saveRubricGuidance(rubricGuidanceDraft.trim());
        if (rubricGenerationScope.current === scope) {
          setPrivateConfig(current => ({ ...current, rubricGenerationGuidance: guidance }));
          setSavedSnapshot(current => ({ ...current, privateConfig: { ...current.privateConfig, rubricGenerationGuidance: guidance } }));
        }
        return guidance;
      });
      rubricGuidanceSaveQueue.current = saveGuidance.then(() => undefined, () => undefined);
      const guidance = await saveGuidance;
      if (!isCurrent() || guidance === undefined) return;
      setRubricGenerationDialogOpen(false);
      const result = await aiGenerationClient.generateRubric({
        guidance,
        title,
        description,
        prompt: config.prompt,
        referenceSolution: projectReferenceSource,
        language: config.language,
        locale: pluginLocale,
        knowledge: knowledgeGeneration.request
      }, controller.signal);
      if (!isCurrent()) return;
      setPrivateConfig(current => ({
        ...current,
        aiFeedback: { ...current.aiFeedback, criteria: result.criteria }
      }));
      notifications.success(result.attempts > 1 ? `${t("generatedRubric")} (${result.attempts})` : t("generatedRubric"));
    } catch (err) {
      if (isCurrent()) notifications.error(err instanceof Error ? err.message : t("generateRubricError"));
    } finally {
      if (rubricGenerationRequest.current === controller) {
        rubricGenerationRequest.current = null;
        setGeneratingRubric(false);
      }
    }
  }

  async function runCode() {
    if (!course?.id || !codingClient || !config.language || !editorCode.trim()) {
      return;
    }
    if (runRequestPending.current || !showPracticeRuns || (maxPracticeRuns !== null && (!practiceRuns || practiceRuns.remaining === 0))) return;
    const runRequest = {};
    runRequestPending.current = runRequest;
    try {
      if (maxPracticeRuns !== null) {
        setConfirmingRun(true);
        const confirmed = await dialogs.confirm({ title: t("confirmTestRunTitle"),
          message: t("confirmTestRunMessage", { remaining: practiceRuns!.remaining!, after: Math.max(0, practiceRuns!.remaining! - 1) }),
          confirmLabel: t("runTest"), cancelLabel: actionCopy.cancel });
        if (runRequestPending.current !== runRequest) return;
        setConfirmingRun(false);
        if (!confirmed) { runRequestPending.current = null; return; }
      }
    } catch (err) {
      if (runRequestPending.current === runRequest) { runRequestPending.current = null; setConfirmingRun(false); setError(err instanceof Error ? err.message : t("runError")); }
      return;
    }
    setWorkingAction("run");
    setError("");
    setRunExecution(null);
    try {
      const isPersonalizedTest = selectedSampleTestId === personalizedTestId;
      const result = await codingClient.runCode(course.id, activity.id, {
        sourceCode: editorCode,
        ...(config.files ? { files: sourceFiles } : {}),
        ...(isBlanks ? { blankAnswers, blankTemplate: config.blankTemplate ?? "" } : {}),
        stdin: sampleInput,
        expectedOutput: isPersonalizedTest ? "" : sampleExpectedOutput,
        testCode: isPersonalizedTest ? "" : sampleTestCode,
        outputMatchMode: isPersonalizedTest ? "exact" : sampleOutputMatchMode,
        containsLinesOrderMatters: isPersonalizedTest ? false : sampleContainsLinesOrderMatters,
        compareOutput: !isPersonalizedTest
      });
      if (runRequestPending.current !== runRequest) return;
      if (result.practiceRuns) setPracticeRuns(result.practiceRuns);
      else if (maxPracticeRuns !== null) {
        const used = (practiceRuns?.used ?? 0) + 1;
        setPracticeRuns({ limit: maxPracticeRuns, used, remaining: Math.max(0, maxPracticeRuns - used) });
        if (isPreview && executionStateHost) {
          previewRunCount.current = used;
          await executionStateHost.save({ sourceCode: editorCode,
            ...(config.files ? { files: sourceFiles } : {}),
            ...(isBlanks ? { blankAnswers, blankTemplate: config.blankTemplate ?? "" } : {}), previewPracticeRunsUsed: used });
        }
      }
      setRunExecution(result.execution);
      setRecentRuns((current) => [result.execution, ...current]);
    } catch (err) {
      if (runRequestPending.current !== runRequest) return;
      setError(err instanceof Error ? err.message : t("runError"));
      if (!isPreview) await refreshPracticeRuns().catch(() => undefined);
    } finally {
      if (runRequestPending.current === runRequest) { runRequestPending.current = null; setWorkingAction(null); }
    }
  }

  async function submitCode(): Promise<boolean> {
    if (!course?.id || !codingClient || !config.language || !editorCode.trim()) {
      return false;
    }
    runRequestPending.current = null;
    setConfirmingRun(false);
    setWorkingAction("submit");
    setError("");
    try {
      const result = await codingClient.submitCode(course.id, activity.id, {
        sourceCode: editorCode,
        ...(config.files ? { files: sourceFiles } : {}),
        ...(isBlanks ? { blankAnswers, blankTemplate: config.blankTemplate ?? "" } : {})
      });
      await executionStateHost?.clear?.().catch(() => undefined);
      setSubmitExecution(result.execution);
      setEditorCode(getCodingExerciseInitialStudentSource(config));
      setSourceFiles(getCodingExerciseStudentFiles(config));
      setBlankAnswers({});
      setCodeResetVersion((version) => version + 1);
      setRunExecution(null);
      setPreviousAttempts((current) => [
        { submission: result.execution, runs: [...recentRuns].reverse(), aiFeedback: result.aiFeedback ?? null },
        ...current
      ]);
      setRecentRuns([]);
      previewRunCount.current = 0;
      if (result.availability.canStart) {
        if (isPreview) setPracticeRuns({ limit: maxPracticeRuns, used: 0, remaining: maxPracticeRuns });
        else await refreshPracticeRuns().catch(() => undefined);
      }
      setIsWorkspaceFullScreen(false);
      setSubmissionConfirmation(result);
      onPreviousSubmissionsAvailabilityChange?.(true);
      if (result.availability.canStart) {
        onNewAttemptAvailabilityChange?.(!readOnly);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitError"));
      return false;
    } finally {
      setWorkingAction(null);
    }
  }

  useEffect(() => {
    const requestId = timedAutoSubmit?.requestId ?? 0;
    if (!requestId || requestId === lastTimedAutoSubmitRequestRef.current || canManage || readOnly || studentViewMode !== "attempt") return;
    lastTimedAutoSubmitRequestRef.current = requestId;
    void submitCode()
      .then((didSubmit) => timedAutoSubmit?.onSettled(didSubmit))
      .catch(() => timedAutoSubmit?.onSettled(false));
  }, [canManage, readOnly, studentViewMode, timedAutoSubmit]);

  function updateStudentCode(sourceCode: string) {
    const files = config.files ? sourceFiles.map(file => file.id === activeFile.id ? { ...file, sourceCode } : file) : [];
    const combined = config.files ? formatCodingSourceFiles(files) : sourceCode;
    setSourceFiles(files);
    setEditorCode(combined);
    setSubmitExecution(null);
    if (executionStateHost && executionStateLoaded && !readOnly) {
      void executionStateHost.save({ sourceCode: combined, ...(config.files ? { files } : {}), ...(isPreview ? { previewPracticeRunsUsed: previewRunCount.current } : {}) }).catch((err) => {
        setError(err instanceof Error ? err.message : t("submitError"));
      });
    }
  }

  function updateStudentBlanks(answers: CodingBlankAnswers) {
    let state;
    try {
      if (config.files) {
        const files = codingFiles(config).map(file => ({ id: file.id, name: file.name, blankTemplate: file.blankTemplate ?? "", studentTemplateSource: file.studentTemplateSource,
          sourceCode: assembleCodingBlankSource(file.blankTemplate ?? "", answers) }));
        state = { sourceCode: Object.values(answers).some(value => value.trim()) ? formatCodingSourceFiles(files) : "", files,
          blankAnswers: answers, blankTemplate: codingFiles(config)[0].blankTemplate ?? "" };
      } else state = codingBlankResponseState(config.blankTemplate ?? "", answers);
    }
    catch (err) { setError(err instanceof Error ? err.message : t("submitError")); return; }
    setBlankAnswers(answers);
    if ("files" in state) setSourceFiles(state.files);
    setEditorCode(state.sourceCode);
    setSubmitExecution(null);
    if (executionStateHost && executionStateLoaded && !readOnly) {
      void executionStateHost.save({ ...state, ...(isPreview ? { previewPracticeRunsUsed: previewRunCount.current } : {}) }).catch(err => setError(err instanceof Error ? err.message : t("submitError")));
    }
  }

  function acknowledgeSubmission() {
    const canStartAnotherAttempt = submissionConfirmation?.availability.canStart !== false;
    setSubmissionConfirmation(null);
    if (!canStartAnotherAttempt) {
      onNewAttemptAvailabilityChange?.(false);
      onSubmitted?.();
    }
  }

  function getReplacementDialogEyebrow() {
    return t(replacementDialog === "prompt" ? "generatePrompt" : "generateSolution");
  }

  function getReplacementDialogTitle() {
    return t(replacementDialog === "prompt" ? "replacePromptTitle" : "replaceSolutionTitle");
  }

  function getReplacementDialogMessage() {
    return t(replacementDialog === "prompt" ? "replacePromptMessage" : "replaceSolutionMessage");
  }

  function getKeepReplacementLabel() {
    return t(replacementDialog === "prompt" ? "keepCurrentPrompt" : "keepCurrentSolution");
  }

  function getReplaceReplacementLabel() {
    return t(replacementDialog === "prompt" ? "replaceCurrentPrompt" : "replaceCurrentSolution");
  }

  function confirmReplacementGeneration() {
    if (replacementDialog === "prompt") {
      void generatePrompt();
      return;
    }
    if (replacementDialog === "solution") {
      void generateSolution();
      return;
    }
  }

  function renderAuthoringGrading(content: ReactNode) {
    if (authoringGradingPortalTarget === undefined) return content;
    return authoringGradingPortalTarget ? createPortal(content, authoringGradingPortalTarget) : null;
  }
  function renderAuthoringSolution(content: ReactNode) {
    if (authoringSolutionPortalTarget === undefined) return content;
    return authoringSolutionPortalTarget ? createPortal(content, authoringSolutionPortalTarget) : null;
  }

  const visibleTestGenerationLimit = testGenerationMode === "add"
    ? codingExerciseMaxGeneratedTestCount - visibleSampleTests.length
    : codingExerciseMaxGeneratedTestCount;
  const hiddenTestGenerationLimit = testGenerationMode === "add"
    ? Math.min(codingExerciseMaxGeneratedTestCount, codingExerciseMaxHiddenTestCount - hiddenTests.length)
    : codingExerciseMaxGeneratedTestCount;
  const testGenerationCountsValid = [visibleTestGenerationCount, hiddenTestGenerationCount].every(
    (count) => Number.isInteger(count) && count >= 0
  ) && visibleTestGenerationCount <= visibleTestGenerationLimit
    && hiddenTestGenerationCount <= hiddenTestGenerationLimit
    && visibleTestGenerationCount + hiddenTestGenerationCount > 0;
  const longRunningTitle = generatingPrompt
    ? t("generatingPrompt")
    : generatingSolution
      ? t("generatingSolution")
      : generatingTests
        ? t("generatingTests")
        : generatingRubric
          ? t("generatingRubric")
          : workingAction === "run"
            ? t("running")
            : workingAction === "submit"
              ? t("submitting")
              : saving
                ? t("saving")
                : null;

  return (
    <MonacoModelScope key={`${activity.id}:${canManage}:${executionDocumentKey}:${studentViewMode}:${codeResetVersion}`} inherit>
    <section className="section stack">
      {canManage ? (!authoringLoaded ? <section className="inline-panel stack">
        <p className={authoringLoadFailed ? "error-text" : "muted"}>{authoringLoadFailed ? error : t("loadingFiles")}</p>
        {authoringLoadFailed ? <button type="button" className="secondary" onClick={() => setAuthoringReload(value => value + 1)}><ActionIcon name="refresh" />{t("retryFiles")}</button> : null}
      </section> : (
        <form className="stack" onSubmit={saveActivityAndHiddenTests}>
          <h2>{t("authoringTitle")}</h2>

          <div className="field">
            <label htmlFor="coding-title">{t("title")}</label>
            <input id="coding-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="coding-language">{t("language")}</label>
            <select
              id="coding-language"
              value={config.language}
              onChange={(event) => {
                const nextLanguage = event.target.value;
                aiGenerationDraftRef.current = null;
                setReplacementDialog(null);
                setTestGenerationDialogOpen(false);
                setRubricGenerationDialogOpen(false);
                setReferenceValidationSummary(null);
                setConfig((current) => ({ ...current, language: nextLanguage,
                  ...(current.files ? { files: current.files.map((file, index) => index === 0 && file.name === defaultCodingFileName(current.language) ? { ...file, name: defaultCodingFileName(nextLanguage) } : file) } : {}) }));
              }}
            >
              <option value="">{t("chooseLanguage")}</option>
              {codingExerciseLanguageOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            {!config.language ? <p className="muted">{t("languageRequired")}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="coding-response-mode">{t("answerFormat")}</label>
            <select id="coding-response-mode" value={config.responseMode ?? "code"}
              onChange={event => { const responseMode = event.target.value as "code" | "blanks";
                setConfig(current => ({ ...current, responseMode,
                  ...(responseMode === "blanks" ? { blankTemplate: current.blankTemplate ?? current.starterCode } : {}),
                  ...(current.files ? { files: current.files.map(file => ({ ...file,
                    ...(responseMode === "blanks" ? { blankTemplate: file.blankTemplate ?? file.starterCode } : {}) })) } : {}) })); }}>
              <option value="code">{t("writeCode")}</option>
              <option value="blanks">{t("fillCodeBlanks")}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="coding-description">{t("description")}</label>
            <textarea
              id="coding-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {aiGenerationClient ? (
            <div className="stack" style={{ gap: 8 }}>
            <KnowledgeGenerationModeField locale={pluginLocale} />
            <button
              className="secondary"
              type="button"
              disabled={!config.language || generatingPrompt || description.trim().length < 10}
              onClick={requestPromptGeneration}
            >
              <ActionIcon name="generate" />
              {generatingPrompt ? t("generatingPrompt") : t("generatePrompt")}
            </button>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="coding-prompt">{t("prompt")}</label>
            <RichTextEditor
              id="coding-prompt"
              ariaLabel={t("prompt")}
              locale={pluginLocale}
              minHeight={180}
              value={config.prompt}
              onChange={(prompt) => {
                aiGenerationDraftRef.current = null;
                setConfig((current) => ({ ...current, prompt }));
              }}
            />
          </div>

          {renderAuthoringSolution(<div className="section stack">
          {aiGenerationClient ? (
            <button
              className="secondary"
              type="button"
              title={config.files && config.files.length > 1 ? t("projectSolutionManual") : undefined}
              disabled={isBlanks || (config.files?.length ?? 0) > 1 || !config.language || generatingSolution || config.prompt.trim().length < 10}
              onClick={requestSolutionGeneration}
            >
              <ActionIcon name="generate" />
              {generatingSolution ? t("generatingSolution") : t("generateSolution")}
            </button>
          ) : null}

          {rubricGenerationDialogOpen && typeof document !== "undefined" ? createPortal(
            <ConfirmationDialog
              open
              title={t("generateRubric")}
              message={<div className="stack">
                <div className="field">
                  <HelpLabel help={<>{t("rubricGuidanceHelp")}</>}><label htmlFor={rubricGuidanceId}>{t("rubricGuidanceLabel")}</label></HelpLabel>
                  <textarea id={rubricGuidanceId} autoFocus rows={5} maxLength={8000}
                    value={rubricGuidanceDraft} onChange={(event) => setRubricGuidanceDraft(event.target.value)} />

                </div>
                {privateConfig.aiFeedback.criteria.length ? <p>{t("replaceRubricMessage")}</p> : null}
              </div>}
              confirmLabel={t(privateConfig.aiFeedback.criteria.length ? "replaceCurrentRubric" : "generateRubric")}
              confirmIcon="generate"
              cancelLabel={t("cancelTestGeneration")}
              isConfirming={generatingRubric}
              onCancel={() => setRubricGenerationDialogOpen(false)}
              onConfirm={() => void generateRubric()}
            />, document.body
          ) : null}

          {replacementDialog && typeof document !== "undefined" ? createPortal(
            <div className="dialog-backdrop" role="presentation">
              <div
                aria-modal="true"
                className="dialog-panel"
                role="dialog"
                aria-labelledby={`coding-generation-replace-${replacementDialog}`}
              >
                <DialogHeader closeLabel={getDialogCloseLabel(locale)} onClose={() => setReplacementDialog(null)}>
                  <p className="eyebrow">{getReplacementDialogEyebrow()}</p>
                  <h2 id={`coding-generation-replace-${replacementDialog}`}>{getReplacementDialogTitle()}</h2></DialogHeader>
                  <p className="muted">{getReplacementDialogMessage()}</p>

                <div className="dialog-actions">
                  <button className="secondary" type="button" onClick={() => setReplacementDialog(null)}>
                    <ActionIcon name="close" />
                    {getKeepReplacementLabel()}
                  </button>
                  <button type="button" onClick={confirmReplacementGeneration}>
                    <ActionIcon name="sync" />
                    {getReplaceReplacementLabel()}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          ) : null}

          {testGenerationDialogOpen && typeof document !== "undefined" ? createPortal(
            <div className="dialog-backdrop" role="presentation">
              <div
                aria-describedby="coding-generation-tests-description"
                aria-labelledby="coding-generation-tests-title"
                aria-modal="true"
                className="dialog-panel"
                role="dialog"
              >
                <DialogHeader closeLabel={getDialogCloseLabel(locale)} onClose={() => setTestGenerationDialogOpen(false)}>
                  <p className="eyebrow">{t("generateTests")}</p>
                  <HelpLabel help={<>{t("generateTestsDialogMessage")}</>}><h2 id="coding-generation-tests-title">{t("generateTestsDialogTitle")}</h2></HelpLabel></DialogHeader>
                  <span className="sr-only" id="coding-generation-tests-description">{t("generateTestsDialogMessage")}</span>

                <div className="field">
                  <HelpLabel help={<>
                    {t(testGenerationMode === "add" ? "addTestsMessage" : "replaceTestsMessage")}
                  </>}><label htmlFor="coding-generation-test-mode">{t("testGenerationMode")}</label></HelpLabel>
                  <select
                    id="coding-generation-test-mode"
                    aria-describedby="coding-generation-test-mode-help"
                    value={testGenerationMode}
                    onChange={(event) => setTestGenerationMode(event.target.value as TestGenerationMode)}
                  >
                    <option value="add">{t("addGeneratedTests")}</option>
                    <option value="replace">{t("replaceGeneratedTests")}</option>
                  </select>
                  <span className="sr-only" id="coding-generation-test-mode-help">
                    {t(testGenerationMode === "add" ? "addTestsMessage" : "replaceTestsMessage")}
                  </span>
                </div>
                <div className="form-grid two-columns">
                  <div className="field">
                    <label htmlFor="coding-generation-visible-test-count">{t("visibleTestCount")}</label>
                    <input
                      id="coding-generation-visible-test-count"
                      max={visibleTestGenerationLimit}
                      min={0}
                      step={1}
                      type="number"
                      value={visibleTestGenerationCount}
                      onChange={(event) => setVisibleTestGenerationCount(Number(event.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="coding-generation-hidden-test-count">{t("hiddenTestCount")}</label>
                    <input
                      id="coding-generation-hidden-test-count"
                      max={hiddenTestGenerationLimit}
                      min={0}
                      step={1}
                      type="number"
                      value={hiddenTestGenerationCount}
                      onChange={(event) => setHiddenTestGenerationCount(Number(event.target.value))}
                    />
                  </div>
                </div>
                <p className="muted">{t("testCountLimit")}</p>
                {testGenerationMode === "add" ? (
                  <p className="muted">{t("testGenerationCapacity", {
                    visible: visibleTestGenerationLimit, hidden: hiddenTestGenerationLimit
                  })}</p>
                ) : null}
                <div className="dialog-actions">
                  <button className="secondary" type="button" onClick={() => setTestGenerationDialogOpen(false)}>
                    <ActionIcon name="close" />
                    {t("cancelTestGeneration")}
                  </button>
                  <button
                    disabled={!config.language || !testGenerationCountsValid}
                    type="button"
                    onClick={() => void generateTests({
                      mode: testGenerationMode,
                      visibleTestCount: visibleTestGenerationCount,
                      hiddenTestCount: hiddenTestGenerationCount
                    })}
                  >
                    <ActionIcon name="generate" />
                    {t("confirmTestGeneration")}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          ) : null}

          <CodingFileTabs files={codingFiles(config)} selected={activeFile.id} onSelect={setSelectedFileId}
            onAdd={addFile} onRename={renameFile} onRemove={id => { void removeFile(id); }} locale={pluginLocale} />
          <div className="settings-layout coding-file-editor-layout">
            <SideNavigation ariaLabel={t("fileEditorSections")} items={[
              ...(!isBlanks ? [{ id: "reference", label: t("referenceSolution"), isActive: activeEditorSection === "reference" }] : []),
              { id: "starter", label: isBlanks ? t("blankTemplate") : t("starterCode"), isActive: activeEditorSection === "starter" },
              { id: "template", label: t("templateSource"), isActive: activeEditorSection === "template" }
            ]} tabs={{ idPrefix: "coding-file-editor", panelId: "coding-file-editor-panel", onSelect: id => setFileEditorSection(id as "starter" | "reference" | "template") }} />
            <div className="coding-file-editor-panels" id="coding-file-editor-panel" role="tabpanel" aria-labelledby={`coding-file-editor-${activeEditorSection}`}>
          <div hidden={activeEditorSection !== "starter"}>
          {isBlanks ? <CodeBlanksAuthoring key={activeFile.id} documentId={`coding-blank-template-${activeFile.id}`} template={activeFile.blankTemplate ?? ""}
            history={blankAuthoringHistory(activeFile.id)} numberOffset={blankNumberOffset} answers={privateConfig.blankReferenceAnswers ?? {}} language={config.language} locale={pluginLocale}
            onChange={(blankTemplate, answers) => {
              updateAuthorFile(activeFile.id, { blankTemplate });
              const oldIds = codingBlankIds(activeFile.blankTemplate ?? "");
              const refs = Object.fromEntries(codingBlankIds(blankTemplate).map(id => [id, codingBlankAnswer(answers, id)]));
              setPrivateConfig(current => ({ ...current, blankReferenceAnswers: { ...Object.fromEntries(Object.entries(current.blankReferenceAnswers ?? {}).filter(([id]) => !oldIds.includes(id))), ...refs } }));
              if (!config.files) setReferenceSolution(assembleCodingBlankSource(blankTemplate, refs));
            }} /> : <div className="stack">
            <label className="editor-section-label">{t("starterCode")}</label>
            <CodeEditor key={`starter:${activeFile.id}`} id={`coding-starter-${activeFile.id}`} ariaLabel={t("starterCode")} value={activeFile.starterCode}
              onChange={value => updateAuthorFile(activeFile.id, { starterCode: value })} language={config.language} minHeight={220} />
          </div>}
          </div>

          {!isBlanks ? <div className="stack" hidden={activeEditorSection !== "reference"}>
            <HelpLabel help={<>{t("referenceSolutionHelp")}</>}><label className="editor-section-label">{t("referenceSolution")}</label></HelpLabel>

            <CodeEditor
              key={`reference:${activeFile.id}`} id={`coding-reference-${activeFile.id}`} ariaLabel={t("referenceSolution")}
              value={activeFilePrivate.referenceSolution}
              disabled={isBlanks}
              onChange={(value) => {
                aiGenerationDraftRef.current = null;
                updateAuthorFilePrivate({ referenceSolution: value });
              }}
              language={config.language}
              minHeight={220}
            />
            {referenceValidationSummary ? (
              <p className="muted" style={{ margin: 0 }}>
                {t("lastValidationSummary", {
                  passedCount: String(referenceValidationSummary.passedCount ?? 0),
                  testCount: String(referenceValidationSummary.testCount ?? 0)
                })}
              </p>
            ) : null}
          </div> : null}

          <div className="stack" hidden={activeEditorSection !== "template"}>
            <HelpLabel help={<><p>{t("templateSourceHelp")}</p><p>{t("templateVisibleLinesHelp")}</p></>}><label className="editor-section-label">{t("templateSource")}</label></HelpLabel>
            <div className="row">
              <button type="button" className="secondary" onMouseDown={event => event.preventDefault()} onClick={() => placeTemplateMarker(codingExerciseTemplateInsertionToken)}><ActionIcon name="add" />{t("placeStudentCode")}</button>
              <button type="button" className="secondary" onMouseDown={event => event.preventDefault()} onClick={() => placeTemplateMarker(codingExerciseTestInsertionToken)}><ActionIcon name="add" />{t("placeTestCode")}</button>
            </div>

            <CodeEditor
              key={`template:${activeFile.id}`} id={`coding-template-${activeFile.id}`} ariaLabel={t("templateSource")}
              value={activeFilePrivate.templateSource}
              onChange={(value) => {
                aiGenerationDraftRef.current = null;
                const nextTemplate = config.files ? value : value || buildCodingExerciseTemplateSource("", "");
                updateAuthorFilePrivate({ templateSource: nextTemplate,
                  templateVisibleLineNumbers: activeFilePrivate.templateVisibleLineNumbers.filter(line => line < nextTemplate.split("\n").length) });
              }}
              language={config.language}
              getLineClassName={(lineIndex) =>
                activeFilePrivate.templateVisibleLineNumbers.includes(lineIndex)
                  ? "coding-exercise-template-line is-visible"
                  : "coding-exercise-template-line"
              }
              leftRail={renderTemplateVisibilityRail(
                activeFilePrivate.templateSource.split("\n"),
                activeFilePrivate.templateVisibleLineNumbers,
                toggleTemplateVisibleLine,
                t
              )}
              leftRailWidth={20}
              minHeight={260}
            />
          </div>
            </div>
          </div>

          {authoringSolutionPortalTarget !== undefined ? <EditActionBar
            isDirty={hasUnsavedChanges} isSaving={saving}
            saveDisabled={!authoringLoaded || !config.language || aiFeedbackValidationMessages.length > 0}
            savedLabel={actionCopy.saved} unsavedLabel={actionCopy.unsaved} saveLabel={t("saveCodingExercise")}
            savingLabel={t("saving")} cancelLabel={actionCopy.cancel} onCancel={discardChanges} onSave={saveCodingExercise}
          /> : null}
          </div>)}

          {renderAuthoringGrading(<div className="stack">
            <div>
              <HelpLabel help={<>{t("gradingHelp")}</>}><h2>{t("gradingTitle")}</h2></HelpLabel>

            </div>
            <div className="settings-layout coding-exercise-grading-layout">
              <SideNavigation ariaLabel={t("gradingSections")} items={[
                { id: "general", label: t("gradingGeneralTab"), isActive: gradingSection === "general" },
                ...(privateConfig.aiFeedback.gradingEnabled || privateConfig.aiFeedback.enabled
                  ? [{ id: "rubric", label: t("rubricSectionTab"), isActive: gradingSection === "rubric" }] : []),
                ...(privateConfig.aiFeedback.testsEnabled !== false
                  ? [{ id: "tests", label: t("testCasesSectionTab"), isActive: gradingSection === "tests" }] : [])
              ]} tabs={{ idPrefix: "coding-exercise-grading-tab", panelId: "coding-exercise-grading-panel",
                onSelect: id => setGradingSection(id as "general" | "rubric" | "tests") }} />
              <div className="stack coding-exercise-grading-panels" id="coding-exercise-grading-panel" role="tabpanel"
                aria-labelledby={`coding-exercise-grading-tab-${gradingSection}`}>

              <div className="stack" id="coding-exercise-general-panel" hidden={gradingSection !== "general"}>
                <CodingExerciseGradingGeneral config={config} feedback={privateConfig.aiFeedback} locale={pluginLocale}
                  onConfigChange={value => setConfig(current => ({ ...current, ...value }))}
                  onFeedbackChange={value => setPrivateConfig(current => ({ ...current, aiFeedback: value }))}
                  validationMessages={aiFeedbackValidationMessages} />
              </div>
              <div
                className="stack"
                hidden={gradingSection !== "rubric" || (!privateConfig.aiFeedback.gradingEnabled && !privateConfig.aiFeedback.enabled)}
                id="coding-exercise-rubric-panel"
              >
            <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
              <div>
                <HelpLabel help={<>{t("rubricHelp")}</>}><h3>{t("rubricTitle")}</h3></HelpLabel>

              </div>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <h4>{t("rubricCriteria")}</h4>
                <div className="row">
                  {aiGenerationClient ? (
                    <button
                      className="button secondary"
                      disabled={!config.language || generatingRubric || !title.trim() || config.prompt.trim().length < 10 || !projectReferenceSource.trim()}
                      title={!config.language
                        ? t("languageRequired")
                        : !title.trim() || config.prompt.trim().length < 10 || !projectReferenceSource.trim()
                          ? t("generateRubricRequirements")
                          : undefined}
                      type="button"
                      onClick={requestRubricGeneration}
                    >
                      <ActionIcon name="generate" />
                      {generatingRubric ? t("generatingRubric") : t("generateRubric")}
                    </button>
                  ) : null}
                  <button
                    className="button secondary"
                    disabled={privateConfig.aiFeedback.criteria.length >= 20}
                    type="button"
                    onClick={() => setPrivateConfig((current) => ({
                      ...current,
                      aiFeedback: {
                        ...current.aiFeedback,
                        criteria: balanceCodingExerciseAiRubricCriterionWeights([...current.aiFeedback.criteria, {
                          id: createCodingExerciseAiRubricCriterionId(current.aiFeedback.criteria),
                          title: "",
                          description: "",
                          weightPercent: 1
                        }])
                      }
                    }))}
                  >
                    <ActionIcon name="add" />
                    {t("addCriterion")}
                  </button>
                </div>
              </div>
              {privateConfig.aiFeedback.criteria.map((criterion, index) => (
                <section className="stack" key={`${criterion.id}-${index}`} style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 16 }}>
                  <div className="form-grid two-columns">
                    <div className="field">
                      <div className="row coding-exercise-criterion-title-row">
                        <label htmlFor={`coding-rubric-criterion-title-${index}`}>{t("criterionTitle")}</label>
                        <button
                          aria-label={t("removeCriterion")}
                          className="button danger coding-exercise-criterion-remove"
                          title={t("removeCriterion")}
                          type="button"
                          onClick={() => setPrivateConfig((current) => ({
                            ...current,
                            aiFeedback: {
                              ...current.aiFeedback,
                              criteria: balanceCodingExerciseAiRubricCriterionWeights(
                                current.aiFeedback.criteria.filter((_, itemIndex) => itemIndex !== index)
                              )
                            }
                          }))}
                        ><ActionIcon name="minus" /></button>
                      </div>
                      <input id={`coding-rubric-criterion-title-${index}`} maxLength={160} required value={criterion.title} onChange={(event) => setPrivateConfig((current) => ({
                        ...current,
                        aiFeedback: { ...current.aiFeedback, criteria: current.aiFeedback.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value, id: item.id || `criterion-${index + 1}` } : item) }
                      }))} />
                    </div>
                    <div className="field">
                      <label>{t("criterionWeight")}</label>
                      <input min={1} max={100} required type="number" value={criterion.weightPercent} onChange={(event) => setPrivateConfig((current) => ({
                        ...current,
                        aiFeedback: { ...current.aiFeedback, criteria: current.aiFeedback.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, weightPercent: Number(event.target.value) } : item) }
                      }))} />
                    </div>
                  </div>
                  <div className="field">
                    <label>{t("criterionDescription")}</label>
                    <textarea maxLength={2000} required rows={3} value={criterion.description} onChange={(event) => setPrivateConfig((current) => ({
                      ...current,
                      aiFeedback: { ...current.aiFeedback, criteria: current.aiFeedback.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) }
                    }))} />
                  </div>
                </section>
              ))}
            </section>

              </div>
              <div
                className="stack"
                hidden={gradingSection !== "tests" || privateConfig.aiFeedback.testsEnabled === false}
                id="coding-exercise-tests-panel"
              >

          {aiGenerationClient ? (
            <button
              className="secondary"
              type="button"
              disabled={!config.language || generatingTests || config.prompt.trim().length < 10 || !projectReferenceSource.trim()}
              onClick={requestTestsGeneration}
            >
              <ActionIcon name="generate" />
              {generatingTests ? t("generatingTests") : t("generateTests")}
            </button>
          ) : null}

          <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h3>{t("visibleSampleTests")}</h3>
              <button
                type="button"
                className="button secondary"
                disabled={!config.language || normalizeCodingExerciseSampleTests(config.sampleTests).length >= codingExerciseMaxGeneratedTestCount}
                onClick={addSampleTest}
              >
                <ActionIcon name="add" />
                {t("addSampleTest")}
              </button>
            </div>
            {normalizeCodingExerciseSampleTests(config.sampleTests).map((test, index) => (
              <section key={test.id} className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 16 }}>
                <button
                  type="button"
                  onClick={() => toggleSampleTest(test.id)}
                  style={collapsibleHeaderStyle}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span>{expandedSampleTestIds.includes(test.id) ? "▾" : "▸"}</span>
                    <span>{getSampleTestSummary(test)}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ValidationBadge result={sampleValidationTests.get(test.id)} locale={pluginLocale} loading={saving} />
                  </span>
                </button>
                {expandedSampleTestIds.includes(test.id) ? (
                  <>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="button secondary" onClick={() => removeSampleTest(index)}>
                        <ActionIcon name="remove" />
                        {t("remove")}
                      </button>
                    </div>
                    <div className="field">
                      <label>{t("testTitle")}</label>
                      <input value={test.title} onChange={(event) => updateSampleTest(index, "title", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>{t("input")}</label>
                      <textarea rows={3} value={test.input} onChange={(event) => updateSampleTest(index, "input", event.target.value)} />
                    </div>
                    <div className="field">
                      <HelpLabel help={<>{test.outputMatchMode === "contains_lines"
                          ? t("outputMatchContainsLinesHelp")
                          : test.outputMatchMode === "regex"
                            ? t("outputMatchRegexHelp")
                            : t("outputMatchExactHelp")}</>}><label htmlFor={`sample-output-match-mode-${index}`}>{t("outputMatchMode")}</label></HelpLabel>
                      <select
                        id={`sample-output-match-mode-${index}`}
                        value={test.outputMatchMode}
                        onChange={(event) => updateSampleTest(index, "outputMatchMode", event.target.value)}
                      >
                        <option value="exact">{t("outputMatchExact")}</option>
                        <option value="contains_lines">{t("outputMatchContainsLines")}</option>
                        <option value="regex">{t("outputMatchRegex")}</option>
                      </select>

                    </div>
                    {test.outputMatchMode === "contains_lines" ? (
                      <label className="row" style={{ alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={test.containsLinesOrderMatters}
                          style={{ height: 16, margin: 0, width: 16 }}
                          onChange={(event) => updateSampleTest(index, "containsLinesOrderMatters", event.target.checked)}
                        />
                        <span>{t("containsLinesRequireOrder")}</span>
                      </label>
                    ) : null}
                    <div className="field">
                      <label>{t("expectedOutput")}</label>
                      <textarea rows={3} value={test.output} onChange={(event) => updateSampleTest(index, "output", event.target.value)} />
                    </div>
                    <div className="stack">
                      <HelpLabel help={<>{t("testHarnessCodeHelp")}</>}><label className="editor-section-label">{t("testHarnessCode")}</label></HelpLabel>

                      <CodeEditor
                        value={test.testCode}
                        onChange={(value) => updateSampleTest(index, "testCode", value)}
                        language={config.language}
                        minHeight={160}
                      />
                    </div>
                    {renderHiddenTestValidation(test.id, sampleValidationTests.get(test.id), pluginLocale)}
                  </>
                ) : null}
              </section>
            ))}
          </section>

          <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <HelpLabel help={<>{t("hiddenTestsHelp")}</>}><h3>{t("hiddenTests")}</h3></HelpLabel>
              <button type="button" className="button secondary" disabled={!config.language} onClick={addHiddenTest}>
                <ActionIcon name="add" />
                {t("addHiddenTest")}
              </button>
            </div>

            {hiddenTests.map((test, index) => (
              <section key={test.id} className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 16 }}>
                <button
                  type="button"
                  onClick={() => toggleHiddenTest(test.id)}
                  style={collapsibleHeaderStyle}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span>{expandedHiddenTestIds.includes(test.id) ? "▾" : "▸"}</span>
                    <span>{test.name}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ValidationBadge
                      result={test.isEnabled ? hiddenValidationTests.get(test.id) : undefined}
                      locale={pluginLocale}
                      loading={saving && test.isEnabled}
                    />
                  </span>
                </button>
                {expandedHiddenTestIds.includes(test.id) ? (
                  <>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="button secondary" onClick={() => removeHiddenTest(index)}>
                        <ActionIcon name="remove" />
                        {t("remove")}
                      </button>
                    </div>
                    <div className="field">
                      <label>{t("name")}</label>
                      <input value={test.name} onChange={(event) => updateHiddenTest(index, "name", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>{t("stableId")}</label>
                      <input value={test.id} onChange={(event) => updateHiddenTest(index, "id", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>{t("input")}</label>
                      <textarea rows={3} value={test.stdin} onChange={(event) => updateHiddenTest(index, "stdin", event.target.value)} />
                    </div>
                    <div className="field">
                      <HelpLabel help={<>{test.outputMatchMode === "contains_lines"
                          ? t("outputMatchContainsLinesHelp")
                          : test.outputMatchMode === "regex"
                            ? t("outputMatchRegexHelp")
                            : t("outputMatchExactHelp")}</>}><label htmlFor={`hidden-output-match-mode-${index}`}>{t("outputMatchMode")}</label></HelpLabel>
                      <select
                        id={`hidden-output-match-mode-${index}`}
                        value={test.outputMatchMode}
                        onChange={(event) => updateHiddenTest(index, "outputMatchMode", event.target.value)}
                      >
                        <option value="exact">{t("outputMatchExact")}</option>
                        <option value="contains_lines">{t("outputMatchContainsLines")}</option>
                        <option value="regex">{t("outputMatchRegex")}</option>
                      </select>

                    </div>
                    {test.outputMatchMode === "contains_lines" ? (
                      <label className="row" style={{ alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={test.containsLinesOrderMatters}
                          style={{ height: 16, margin: 0, width: 16 }}
                          onChange={(event) => updateHiddenTest(index, "containsLinesOrderMatters", event.target.checked)}
                        />
                        <span>{t("containsLinesRequireOrder")}</span>
                      </label>
                    ) : null}
                    <div className="field">
                      <label>{t("expectedOutput")}</label>
                      <textarea
                        rows={3}
                        value={test.expectedOutput}
                        onChange={(event) => updateHiddenTest(index, "expectedOutput", event.target.value)}
                      />
                    </div>
                    <div className="stack">
                      <HelpLabel help={<>{t("testHarnessCodeHelp")}</>}><label className="editor-section-label">{t("testHarnessCode")}</label></HelpLabel>

                      <CodeEditor
                        value={test.testCode}
                        onChange={(value) => updateHiddenTest(index, "testCode", value)}
                        language={config.language}
                        minHeight={160}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        alignItems: "start"
                      }}
                    >
                      <div className="field">
                        <label htmlFor={`hidden-test-enabled-${index}`}>{t("enabled")}</label>
                        <div
                          style={{
                            alignItems: "center",
                            display: "flex",
                            minHeight: 42
                          }}
                        >
                          <input
                            id={`hidden-test-enabled-${index}`}
                            type="checkbox"
                            checked={test.isEnabled}
                            onChange={(event) => updateHiddenTest(index, "isEnabled", event.target.checked)}
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor={`hidden-test-weight-${index}`}>{t("weight")}</label>
                        <input
                          id={`hidden-test-weight-${index}`}
                          type="number"
                          min={1}
                          max={100}
                          value={test.weight}
                          onChange={(event) => updateHiddenTest(index, "weight", Number(event.target.value || "1"))}
                          style={{ maxWidth: 120 }}
                        />
                      </div>
                    </div>
                    {renderHiddenTestValidation(test.id, hiddenValidationTests.get(test.id), pluginLocale)}
                  </>
                ) : null}
              </section>
            ))}
          </section>
              </div>
              </div>
            </div>
          {authoringGradingPortalTarget !== undefined ? (
            <>
              {error ? <p className="error">{error}</p> : null}
              <EditActionBar
                isDirty={hasUnsavedChanges}
                isSaving={saving}
                saveDisabled={!authoringLoaded || !config.language || aiFeedbackValidationMessages.length > 0}
                savedLabel={actionCopy.saved}
                unsavedLabel={actionCopy.unsaved}
                saveLabel={t("saveCodingExercise")}
                savingLabel={t("saving")}
                cancelLabel={actionCopy.cancel}
                onCancel={discardChanges}
                onSave={saveCodingExercise}
              />
            </>
          ) : null}
          </div>)}

          {error ? <p className="error">{error}</p> : null}
          <EditActionBar
            isDirty={hasUnsavedChanges}
            isSaving={saving}
            saveDisabled={!authoringLoaded || !config.language || aiFeedbackValidationMessages.length > 0}
            savedLabel={actionCopy.saved}
            unsavedLabel={actionCopy.unsaved}
            saveLabel={t("saveCodingExercise")}
            savingLabel={t("saving")}
            cancelLabel={actionCopy.cancel}
            onCancel={discardChanges}
            onSave={saveCodingExercise}
          />
        </form>
      )) : (
        <div className="stack">
          {studentViewMode === "previous" ? (
            <CodingAttemptHistoryList attempts={previousAttempts} language={config.language} locale={pluginLocale} />
          ) : (
            <>
              <MarkdownRenderer className={`coding-exercise-student-prompt${isBlanks ? " is-code-blanks" : ""}`} markdown={config.prompt} />
              <div
                aria-label={isWorkspaceFullScreen ? t("fullScreen") : isBlanks ? t("codeBlankAnswerArea") : undefined}
                aria-modal={isWorkspaceFullScreen || undefined}
                className={`coding-exercise-workspace-shell${isBlanks ? " is-code-blanks" : ""}${isWorkspaceFullScreen ? " is-full-screen" : ""}`}
                role={isWorkspaceFullScreen ? "dialog" : isBlanks ? "region" : undefined}
              >
                <div className="coding-exercise-workspace-toolbar">
                  {isBlanks ? <h2 className="coding-blank-answer-heading">{t("codeBlankAnswerArea")}</h2> : null}
                  {isWorkspaceFullScreen ? <DialogCloseButton label={t("exitFullScreen")} onClose={() => setIsWorkspaceFullScreen(false)} /> : <button
                    className="secondary"
                    type="button"
                    onClick={() => setIsWorkspaceFullScreen((current) => !current)}
                  >
                    <ActionIcon name="expand" />
                    {t("fullScreen")}
                  </button>}
                </div>

                <div
                  className={`coding-exercise-student-workspace${deferSubmission ? "" : " has-actions"}${showPracticeRuns ? "" : " without-test-runner"}`}
                  ref={studentWorkspaceRef}
                  style={
                    {
                      "--coding-exercise-editor-width": workspaceEditorWidth === null ? "2fr" : `${workspaceEditorWidth}px`
                    } as CSSProperties
                  }
                >
                  <MonacoModelGroup id={`sources:${activity.id}`}>
                  <div className="coding-exercise-editor-pane">
                    {fileDefinitions.length > 1 ? <CodingFileTabs files={fileDefinitions} selected={activeFile.id} onSelect={setSelectedFileId} locale={pluginLocale} /> : null}
                    {isBlanks ? (executionStateLoaded ? <CodeBlanksEditor key={`${executionDocumentKey}:${activeFile.id}:${codeResetVersion}`}
                      template={sourceFiles.length || config.files ? activeSourceFile?.blankTemplate ?? activeFile.blankTemplate ?? "" : readOnly && restoredBlankTemplate !== null ? restoredBlankTemplate : config.blankTemplate ?? ""} numberOffset={blankNumberOffset} answers={blankAnswers} onChange={updateStudentBlanks}
                      prefix={templateProjection.readOnlyPrefix} suffix={templateProjection.readOnlySuffix}
                      readOnly={readOnly || !!config.files && !activeFile.studentTemplateSource.includes(codingExerciseTemplateInsertionToken)} locale={pluginLocale} language={config.language} /> : <p>{t("loadingAnswer")}</p>) : <CodingProjectEditor
                      files={config.files || sourceFiles.length ? sourceFiles : [{ id: activeFile.id, name: `coding-exercise-student-${activity.id}-${activeFile.id}`, sourceCode: editorCode, studentTemplateSource: config.studentTemplateSource }]}
                      key={`${executionDocumentKey}:${activeFile.id}:${codeResetVersion}`}
                      id={config.files || sourceFiles.length ? activeFile.name : `coding-exercise-student-${activity.id}-${activeFile.id}`}
                      ariaLabel={activity.title || t("starterCode")}
                      value={config.files || sourceFiles.length ? activeSourceFile?.sourceCode ?? "" : editorCode}
                      onChange={updateStudentCode}
                      language={config.language}
                      height="100%"
                      minHeight={isWorkspaceFullScreen ? 0 : 520}
                      readOnly={readOnly || !executionStateLoaded || !!config.files && !activeFile.studentTemplateSource.includes(codingExerciseTemplateInsertionToken)}
                      loading={!executionStateLoaded}
                      loadingLabel={t("loadingAnswer")}
                      readOnlyPrefix={templateProjection.readOnlyPrefix}
                      readOnlySuffix={templateProjection.readOnlySuffix}
                    />}
                    {draftLoadFailed ? <button type="button" className="secondary" onClick={() => setDraftReload((value) => value + 1)}><ActionIcon name="refresh" /> {t("retryLoadAnswer")}</button> : null}
                  </div>
                  </MonacoModelGroup>

                  {!deferSubmission ? (
                    <div className="row coding-exercise-editor-actions" style={{ alignItems: "center" }}>
                      <button type="button" onClick={submitCode} disabled={!config.language || !executionStateLoaded || readOnly || workingAction === "submit" || !editorCode.trim()}>
                        <ActionIcon name="submit" />
                        {workingAction === "submit" ? t("submitting") : t("submitForGrading")}
                      </button>
                      {submitExecution && submitExecution.status !== "pending" && canShowExecutionOutcome(submitExecution) ? (
                        <OutcomeMark passed={submitExecution.status === "completed"} locale={pluginLocale} />
                      ) : null}
                    </div>
                  ) : null}

                  {showPracticeRuns ? <><div
                    className="coding-exercise-workspace-divider"
                    role="separator"
                    aria-label={t("resizeWorkspace")}
                    aria-orientation="vertical"
                    aria-valuemin={getStudentWorkspaceEditorLimits(studentWorkspaceRef.current).min}
                    aria-valuemax={getStudentWorkspaceEditorLimits(studentWorkspaceRef.current).max}
                    aria-valuenow={Math.round(
                      workspaceEditorWidth ?? getStudentWorkspaceDefaultEditorWidth(studentWorkspaceRef.current)
                    )}
                    tabIndex={0}
                    onDoubleClick={() => setWorkspaceEditorWidth(null)}
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      resizeStudentWorkspace(event);
                    }}
                    onPointerMove={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        resizeStudentWorkspace(event);
                      }
                    }}
                    onKeyDown={(event) => {
                      const { min, max } = getStudentWorkspaceEditorLimits(studentWorkspaceRef.current);
                      const current = workspaceEditorWidth ?? getStudentWorkspaceDefaultEditorWidth(studentWorkspaceRef.current);
                      if (event.key === "ArrowLeft") setWorkspaceEditorWidth(Math.max(min, current - 24));
                      else if (event.key === "ArrowRight") setWorkspaceEditorWidth(Math.min(max, current + 24));
                      else if (event.key === "Home") setWorkspaceEditorWidth(min);
                      else if (event.key === "End") setWorkspaceEditorWidth(max);
                      else return;
                      event.preventDefault();
                    }}
                  />

                  <section
                    className="stack coding-exercise-test-runner"
                    style={{
                      border: "1px solid rgba(13, 27, 71, 0.1)",
                      borderRadius: 12,
                      minWidth: 0,
                      padding: 18
                    }}
                  >
                    {maxPracticeRuns !== null && !readOnly ? <div>
                      <p role="status">{practiceRuns ? t("practiceRunsRemaining", { remaining: practiceRuns.remaining ?? 0, total: maxPracticeRuns }) : t("loadingPracticeRuns")}</p>
                      {practiceRunError ? <div className="error">{practiceRunError}<button type="button" className="secondary" onClick={() => setPracticeRunReload(value => value + 1)}><ActionIcon name="refresh" />{t("retryPracticeRuns")}</button></div> : null}
                    </div> : null}

                  <TestSelector
                    id="coding-visible-sample"
                    label={t("testSelection")}
                    value={selectedSampleTestId}
                    options={[
                      ...visibleSampleTests.map((test) => ({ value: test.id, label: getSampleTestSummary(test) })),
                      { value: personalizedTestId, label: t("personalizedTest") }
                    ]}
                    onChange={applySampleTest}
                  />

                  {isPersonalizedTest ? (
                    <div className="field">
                      <label htmlFor="coding-sample-input">{t("inputOnePerLine")}</label>
                      <textarea
                        id="coding-sample-input"
                        rows={5}
                        value={sampleInput}
                        onChange={(event) => updateRunInput(event.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="coding-exercise-test-information">
                      <div
                        className="coding-exercise-test-information-item"
                        role="group"
                        aria-labelledby="coding-sample-input-label"
                      >
                        <strong id="coding-sample-input-label">{t("inputOnePerLine")}</strong>
                        <pre>{sampleInput || t("noRunInput")}</pre>
                      </div>
                      <div
                        className="coding-exercise-test-information-item"
                        role="group"
                        aria-labelledby="coding-sample-expected-output-label"
                      >
                        <div className="coding-exercise-test-information-heading">
                          <strong id="coding-sample-expected-output-label">{t("expectedOutput")}</strong>
                          <span className="coding-exercise-test-match-mode">
                            {sampleOutputMatchMode === "contains_lines"
                              ? t("outputMatchContainsLines")
                              : sampleOutputMatchMode === "regex"
                                ? t("outputMatchRegex")
                                : t("outputMatchExactlyThis")}
                          </span>
                        </div>
                        <pre>{sampleExpectedOutput || "—"}</pre>
                        {sampleOutputMatchMode === "contains_lines" ? (
                          <p className="muted coding-exercise-test-order-note">
                            {sampleContainsLinesOrderMatters
                              ? t("containsLinesRequireOrder")
                              : t("containsLinesAnyOrder")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <button type="button" onClick={runCode} disabled={!config.language || !executionStateLoaded || readOnly || workingAction === "run" || confirmingRun || !editorCode.trim() || (maxPracticeRuns !== null && (!practiceRuns || practiceRuns.remaining === 0))}>
                    <ActionIcon name="run" />
                    {workingAction === "run" ? t("running") : t("runTest")}
                  </button>

                  <div className="field coding-exercise-test-output">
                    <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                      <label id="coding-test-output-label">{t("testOutput")}</label>
                      {!isPersonalizedTest && runExecution && runExecution.status !== "pending" ? (
                        <OutcomeMark passed={runExecution.status === "completed"} locale={pluginLocale} />
                      ) : null}
                    </div>
                    <pre
                      aria-labelledby="coding-test-output-label"
                      className="coding-exercise-output-text"
                      style={{
                        background: "rgba(13, 27, 71, 0.035)",
                        border: "1px solid rgba(13, 27, 71, 0.08)",
                        borderRadius: 8,
                        boxSizing: "border-box",
                        margin: 0,
                        minHeight: 128,
                        overflow: "auto",
                        padding: 12,
                        whiteSpace: "pre-wrap"
                      }}
                    >
                      {runExecution ? getExecutionDisplayOutput(runExecution, pluginLocale) : ""}
                    </pre>
                    {runExecution?.outputTruncated ? <p className="muted">{t("outputTruncated")}</p> : null}
                  </div>

                    {error ? <p className="error">{error}</p> : null}
                  </section> </> : null}
                </div>
              </div>

              {showPracticeRuns ? <CodingRunHistory key={activity.id} executions={recentRuns} locale={pluginLocale} /> : null}
              {!showPracticeRuns && error ? <p className="error" role="alert">{error}</p> : null}
            </>
          )}
          {submissionConfirmation ? (
            <div className="dialog-backdrop" role="presentation">
              <div
                aria-modal="true"
                className="dialog-panel"
                role="dialog"
                aria-labelledby="coding-submission-confirmation-title"
              >
                <div className="stack" style={{ gap: 10 }}>
                  <DialogHeader closeLabel={getDialogCloseLabel(locale)} onClose={acknowledgeSubmission}>
                    <h2 id="coding-submission-confirmation-title" style={{ margin: 0 }}>
                      {t("submissionCompleteTitle")}
                    </h2>
                    {canShowExecutionOutcome(submissionConfirmation.execution) ? <OutcomeMark
                      passed={submissionConfirmation.execution.status === "completed"}
                      locale={pluginLocale}
                    /> : null}
                  </DialogHeader>
                  <p className="muted">{t("submissionRecordedMessage")}</p>
                  {submissionConfirmation.aiFeedback?.feedback ? (
                    <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 16 }}>
                      <h3>{t("aiFeedbackResult")}</h3>
                      <p>{submissionConfirmation.aiFeedback.feedback.summary}</p>
                      {submissionConfirmation.aiFeedback.feedback.strengths?.length ? (
                        <div>
                          <strong>{t("aiFeedbackStrengths")}</strong>
                          <ul>{submissionConfirmation.aiFeedback.feedback.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </div>
                      ) : null}
                      {submissionConfirmation.aiFeedback.feedback.improvements?.length ? (
                        <div>
                          <strong>{t("aiFeedbackImprovements")}</strong>
                          <ul>{submissionConfirmation.aiFeedback.feedback.improvements.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </div>
                      ) : null}
                    </section>
                  ) : submissionConfirmation.aiFeedbackError ? (
                    <p className="error-text">{t("aiFeedbackGenerationFailed")}</p>
                  ) : null}
                  {submissionConfirmation.availability.attemptsRemaining === null ? null : submissionConfirmation.availability.canStart ? (
                    <p className="muted">
                      {t("submissionAttemptsRemaining", {
                        count: submissionConfirmation.availability.attemptsRemaining
                      })}
                    </p>
                  ) : (
                    <p className="muted">{t("submissionNoAttemptsRemaining")}</p>
                  )}
                </div>
                <div className="dialog-actions">
                  <button type="button" onClick={acknowledgeSubmission}>
                    <ActionIcon name="check" />
                    {t("confirmOk")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
      {typeof document !== "undefined" ? createPortal(<ProgressDialog
        open={Boolean(longRunningTitle)}
        eyebrow={activity.title}
        title={longRunningTitle ?? t("saving")}
        progressLabel={longRunningTitle ?? t("saving")}
        cancelLabel={t("cancelTestGeneration")}
        onCancel={generatingRubric ? cancelRubricGeneration : undefined}
      />, document.body) : null}
    </section>
    </MonacoModelScope>
  );
}

function CodingRunHistory({ executions, locale }: { executions: CodingExecution[]; locale: CodingExercisesLocale }) {
  const { timeZone } = useApplicationTime();
  const historyId = useId();
  const [expandedForRunId, setExpandedForRunId] = useState<string | null>(null);
  const latest = executions[0];
  if (!latest) return null;
  const previousRuns = executions.slice(1);
  const expanded = expandedForRunId === latest.id;

  return <section className="stack coding-exercise-run-history">
    <h3>{formatCodingExercisesMessage(locale, "latestRun")}</h3>
    <ExecutionCard execution={latest} title={formatZonedDateTime(new Date(latest.createdAt), timeZone, locale, { dateStyle: "medium", timeStyle: "medium" })} compact locale={locale} />
    {previousRuns.length ? <>
      <button
        type="button"
        className="coding-exercise-history-toggle"
        aria-expanded={expanded}
        aria-controls={historyId}
        onClick={() => setExpandedForRunId(expanded ? null : latest.id)}
      ><ActionIcon name={expanded ? "up" : "history"} /> {formatCodingExercisesMessage(locale, expanded ? "hidePreviousRuns" : "showPreviousRuns", { count: previousRuns.length })}</button>
      <div id={historyId} hidden={!expanded}>
        {expanded ? <div className="stack">
          {previousRuns.map((execution) => <ExecutionCard key={execution.id} execution={execution} title={formatZonedDateTime(new Date(execution.createdAt), timeZone, locale, { dateStyle: "medium", timeStyle: "medium" })} compact locale={locale} />)}
        </div> : null}
      </div>
    </> : null}
  </section>;
}

function CodingAttemptHistoryList({
  attempts,
  language,
  locale
}: {
  attempts: CodingAttemptHistory[];
  language: string;
  locale: CodingExercisesLocale;
}) {
  const { timeZone } = useApplicationTime();
  return (
    <section className="stack coding-exercise-attempt-history">
      {attempts.map((attempt, index) => {
        const attemptNumber = attempts.length - index;
        return (
          <details className="coding-exercise-attempt-accordion" key={attempt.submission.id}>
            <summary>
              <span>{formatCodingExercisesMessage(locale, "attemptNumber", { number: attemptNumber })}</span>
              <time dateTime={attempt.submission.createdAt}>
                {formatZonedDateTime(new Date(attempt.submission.createdAt), timeZone, locale, { dateStyle: "medium", timeStyle: "medium" })}
              </time>
              {attempt.submission.status === "pending" ? (
                <span className="muted">{formatCodingExercisesMessage(locale, "statusPending")}</span>
              ) : canShowExecutionOutcome(attempt.submission) ? (
                <OutcomeMark passed={attempt.submission.status === "completed"} locale={locale} />
              ) : null}
            </summary>
            <div className="stack coding-exercise-attempt-content">
              <div className="stack stack-tight">
                <strong>{formatCodingExercisesMessage(locale, "submittedSolution")}</strong>
                <CodingFilesView files={attempt.submission.files} sourceCode={attempt.submission.sourceCode} language={language} locale={locale} />
              </div>
              <ExecutionCard
                execution={attempt.submission}
                title={formatCodingExercisesMessage(locale, "submissionResult")}
                locale={locale}
              />
              {attempt.aiFeedback?.feedback ? (
                <CodingAttemptFeedback feedback={attempt.aiFeedback.feedback} locale={locale} />
              ) : null}
              <div className="stack stack-tight">
                <strong>{formatCodingExercisesMessage(locale, "attemptRuns")}</strong>
                {attempt.runs.length ? (
                  attempt.runs.map((execution, runIndex) => (
                    <ExecutionCard
                      key={execution.id}
                      execution={execution}
                      title={formatCodingExercisesMessage(locale, "runNumber", { number: runIndex + 1 })}
                      compact
                      locale={locale}
                    />
                  ))
                ) : (
                  <p className="muted">{formatCodingExercisesMessage(locale, "noAttemptRuns")}</p>
                )}
              </div>
            </div>
          </details>
        );
      })}
    </section>
  );
}

function CodingAttemptFeedback({ feedback, locale }: {
  feedback: CodingExerciseAiFeedback;
  locale: CodingExercisesLocale;
}) {
  const t = (key: Parameters<typeof formatCodingExercisesMessage>[1]) => formatCodingExercisesMessage(locale, key);
  return (
    <section className="inline-panel stack stack-tight">
      <h3>{t("aiFeedbackResult")}</h3>
      {feedback.summary ? <p>{feedback.summary}</p> : null}
      {feedback.strengths?.length ? (
        <div>
          <strong>{t("aiFeedbackStrengths")}</strong>
          <ul>{feedback.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
      ) : null}
      {feedback.improvements?.length ? (
        <div>
          <strong>{t("aiFeedbackImprovements")}</strong>
          <ul>{feedback.improvements.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
      ) : null}
      {feedback.criteria?.map((criterion, index) => (
        <div className="stack stack-tight" key={criterion.id ?? index}>
          {criterion.title ? <strong>{criterion.title}</strong> : null}
          {criterion.feedback ? <p className="muted">{criterion.feedback}</p> : null}
        </div>
      ))}
    </section>
  );
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getStudentWorkspaceEditorLimits(workspace: HTMLDivElement | null) {
  const workspaceWidth = workspace?.getBoundingClientRect().width ?? 960;
  return {
    min: minimumEditorWidth,
    max: Math.max(minimumEditorWidth, workspaceWidth - workspaceDividerWidth - minimumTestRunnerWidth)
  };
}

function getStudentWorkspaceDefaultEditorWidth(workspace: HTMLDivElement | null) {
  const workspaceWidth = workspace?.getBoundingClientRect().width ?? 960;
  const availableWidth = Math.max(0, workspaceWidth - workspaceDividerWidth);
  const { min, max } = getStudentWorkspaceEditorLimits(workspace);
  return Math.min(max, Math.max(min, availableWidth * (2 / 3)));
}

function TestSelector({
  id,
  label,
  value,
  options,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const menuId = `${id}-menu`;
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!anchor) return;
    const animationFrame = window.requestAnimationFrame(() => {
      const menu = document.getElementById(menuId);
      menu?.querySelector<HTMLButtonElement>(`[role="menuitemradio"][aria-checked="true"]`)?.focus();
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [anchor, menuId]);

  function selectOption(nextValue: string) {
    onChange(nextValue);
    const trigger = anchor;
    setAnchor(null);
    trigger?.focus();
  }

  function moveOptionFocus(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const menu = document.getElementById(menuId);
    const items = Array.from(menu?.querySelectorAll<HTMLButtonElement>(`[role="menuitemradio"]`) ?? []);
    const currentIndex = items.indexOf(event.currentTarget);
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    else if (event.key === "Escape") {
      const trigger = anchor;
      setAnchor(null);
      trigger?.focus();
    } else {
      return;
    }
    event.preventDefault();
    if (nextIndex !== null) items[nextIndex]?.focus();
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        className="coding-exercise-test-selector"
        aria-controls={menuId}
        aria-expanded={Boolean(anchor)}
        aria-haspopup="menu"
        title={selectedOption?.label}
        onClick={(event) => setAnchor((current) => (current ? null : event.currentTarget))}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          setAnchor(event.currentTarget);
        }}
      >
        <span>{selectedOption?.label ?? ""}</span>
        <span aria-hidden="true" className="coding-exercise-test-selector-chevron">▾</span>
      </button>
      <ContextMenu
        anchor={anchor}
        className="coding-exercise-test-menu"
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        <div id={menuId} role="none">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className="coding-exercise-test-menu-option"
              title={option.label}
              onClick={() => selectOption(option.value)}
              onKeyDown={moveOptionFocus}
            >
              <span aria-hidden="true">{option.value === value ? "✓" : ""}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </ContextMenu>
    </div>
  );
}

function getPersistedPrivateConfig(privateConfig: CodingExercisePrivateConfig): CodingExercisePrivateConfig {
  const templateSource =
    typeof privateConfig.templateSource === "string" && privateConfig.templateSource.length > 0
      ? privateConfig.templateSource
      : buildCodingExerciseTemplateSource(privateConfig.templatePrefix ?? "", privateConfig.templateSuffix ?? "");
  const templateParts = splitCodingExerciseTemplateSource(templateSource);
  const lineCount = templateSource.split("\n").length;
  const templateVisibleLineNumbers = privateConfig.templateVisibleLineNumbers
    .filter((lineNumber) => Number.isInteger(lineNumber) && lineNumber >= 0 && lineNumber < lineCount)
    .sort((left, right) => left - right);

  return {
    ...privateConfig,
    templateSource,
    templateVisibleLineNumbers,
    templatePrefix: templateParts.prefix,
    templateSuffix: templateParts.suffix
  };
}

function buildCodingExerciseSnapshot(input: CodingExerciseSnapshot): CodingExerciseSnapshot {
  return JSON.parse(JSON.stringify(input)) as CodingExerciseSnapshot;
}

function codingExerciseSnapshotsEqual(left: CodingExerciseSnapshot, right: CodingExerciseSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasExistingGeneratedSolutionContent(
  config: CodingExerciseConfig,
  privateConfig: CodingExercisePrivateConfig,
  referenceSolution: string
) {
  const templateSource = privateConfig.templateSource.trim();

  return Boolean(
    config.starterCode.trim() ||
      referenceSolution.trim() ||
      (templateSource && templateSource !== codingExerciseTemplateInsertionToken)
  );
}

function isApiErrorLike(value: unknown): value is { code?: string; details?: unknown } {
  return value instanceof Error && "code" in value;
}

function formatReferenceValidationFailureMessage(details: Record<string, unknown> | null, locale: CodingExercisesLocale) {
  const validationSummary = normalizeObject(details?.validationSummary);
  const firstFailedTest = validationSummary ? findFirstFailedReferenceValidationTest(validationSummary) : null;
  const testName =
    firstFailedTest && typeof firstFailedTest.name === "string" && firstFailedTest.name.trim()
      ? firstFailedTest.name
      : formatCodingExercisesMessage(locale, "test");
  const reason =
    getReferenceValidationFailureReason(firstFailedTest, locale) || formatCodingExercisesMessage(locale, "referenceSolutionGenericFailure");

  return formatCodingExercisesMessage(locale, "referenceSolutionValidationFailed", {
    testName,
    reason
  });
}

function findFirstFailedReferenceValidationTest(validationSummary: Record<string, unknown>) {
  for (const groupKey of ["sampleTests", "hiddenTests"]) {
    const group = normalizeObject(validationSummary[groupKey]);
    const tests = Array.isArray(group?.tests) ? (group.tests as Array<Record<string, unknown>>) : [];
    const failed = tests.find((test) => test && typeof test === "object" && test.passed === false);
    if (failed) {
      return failed;
    }
  }
  return null;
}

function getReferenceValidationFailureReason(test: Record<string, unknown> | null, locale: CodingExercisesLocale) {
  if (!test) {
    return "";
  }
  for (const key of ["message", "stderr", "compileOutput", "statusLabel"]) {
    const value = test[key];
    if (typeof value === "string" && value.trim()) {
      return key === "statusLabel" ? formatJudgeStatusLabel(value, locale) : value;
    }
  }
  return "";
}

function formatJudgeStatusLabel(value: string, locale: CodingExercisesLocale) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "accepted") {
    return formatCodingExercisesMessage(locale, "judgeStatusAccepted");
  }
  if (normalized === "wrong answer") {
    return formatCodingExercisesMessage(locale, "judgeStatusWrongAnswer");
  }
  if (normalized === "compilation error") {
    return formatCodingExercisesMessage(locale, "judgeStatusCompilationError");
  }
  if (normalized === "runtime error" || normalized.startsWith("runtime error ")) {
    return formatCodingExercisesMessage(locale, "judgeStatusRuntimeError");
  }
  if (normalized === "time limit exceeded") {
    return formatCodingExercisesMessage(locale, "judgeStatusTimeLimitExceeded");
  }
  return value;
}

function getReferenceValidationTests(summary: Record<string, unknown> | null, groupKey: "sampleTests" | "hiddenTests") {
  const group = normalizeObject(summary?.[groupKey]) as ReferenceValidationGroup | null;
  const tests = Array.isArray(group?.tests) ? group.tests : [];
  const testMap = new Map<string, ReferenceValidationTestResult>();

  for (const test of tests) {
    if (!test || typeof test !== "object" || Array.isArray(test)) {
      continue;
    }
    const id = "id" in test && typeof test.id === "string" ? test.id : null;
    if (!id) {
      continue;
    }
    testMap.set(id, test as ReferenceValidationTestResult);
  }

  return testMap;
}

function getSampleTestSummary(test: SampleTest) {
  return test.title.trim() || test.id;
}

function renderTemplateVisibilityRail(
  templateLines: string[],
  visibleLineNumbers: number[],
  toggleTemplateVisibleLine: (lineIndex: number) => void,
  t: (key: Parameters<typeof formatCodingExercisesMessage>[1], values?: Record<string, string | number>) => string
) {
  const visibleLines = new Set(visibleLineNumbers);

  return (
    <div className="parsons-editor-rail parsons-editor-selection-rail">
      {templateLines.map((_, lineIndex) => {
        const selected = visibleLines.has(lineIndex);
        const isStudentInsertionLine = templateLines[lineIndex]?.includes(codingExerciseTemplateInsertionToken);
        return (
          <button
            key={`template-visible-line-${lineIndex}`}
            type="button"
            aria-label={t("templateVisibleLine", { line: lineIndex + 1 })}
            title={t("templateVisibleLine", { line: lineIndex + 1 })}
            disabled={isStudentInsertionLine}
            onClick={() => toggleTemplateVisibleLine(lineIndex)}
            className={`parsons-line-marker ${selected ? "is-selected" : ""} ${isStudentInsertionLine ? "is-disabled" : ""}`}
          />
        );
      })}
    </div>
  );
}

function ValidationBadge({
  result,
  locale,
  loading = false
}: {
  result?: ReferenceValidationTestResult;
  locale: CodingExercisesLocale;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span
        aria-label={formatCodingExercisesMessage(locale, "saving")}
        style={{
          animation: "coding-exercise-spin 0.8s linear infinite",
          border: "2px solid rgba(13, 27, 71, 0.15)",
          borderRadius: "50%",
          borderTopColor: "#0d1b47",
          boxSizing: "border-box",
          display: "inline-block",
          height: 16,
          width: 16
        }}
      />
    );
  }

  if (!result) {
    return null;
  }

  return (
    <span
      aria-label={result.passed ? formatCodingExercisesMessage(locale, "passed") : formatCodingExercisesMessage(locale, "failed")}
      style={{
        color: result.passed ? "#157347" : "#b42318",
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1
      }}
    >
      {result.passed ? "✓" : "✕"}
    </span>
  );
}

const collapsibleHeaderStyle: CSSProperties = {
  alignItems: "center",
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  padding: 0,
  textAlign: "left",
  width: "100%"
};

function renderHiddenTestValidation(testId: string, testResult: ReferenceValidationTestResult | undefined, locale: CodingExercisesLocale) {
  if (!testResult || testResult.passed) {
    return null;
  }

  const detailBlocks = [
    { label: formatCodingExercisesMessage(locale, "compilerOutput"), value: testResult.compileOutput },
    { label: formatCodingExercisesMessage(locale, "runtimeError"), value: testResult.stderr },
    { label: formatCodingExercisesMessage(locale, "judgeMessage"), value: testResult.message },
    { label: formatCodingExercisesMessage(locale, "programOutput"), value: testResult.stdout }
  ].filter((item) => item.value && item.value.trim().length > 0);

  return (
    <section
      key={`${testId}-validation`}
      className="stack"
      style={{
        background: "rgba(186, 26, 26, 0.05)",
        border: "1px solid rgba(186, 26, 26, 0.18)",
        borderRadius: 10,
        padding: 12
      }}
    >
      <strong style={{ color: "#8f1d1d" }}>
        {formatCodingExercisesMessage(locale, "validationFailed")}
        {testResult.statusLabel ? `: ${testResult.statusLabel}` : ""}
      </strong>
      {detailBlocks.length ? (
        detailBlocks.map((item) => (
          <div key={item.label} className="stack" style={{ gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
            <pre
              style={{
                background: "rgba(13, 27, 71, 0.04)",
                borderRadius: 8,
                margin: 0,
                overflowX: "auto",
                padding: 10,
                whiteSpace: "pre-wrap"
              }}
            >
              {item.value}
            </pre>
          </div>
        ))
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {formatCodingExercisesMessage(locale, "referenceSolutionFailedHiddenTest")}
        </p>
      )}
    </section>
  );
}

function ExecutionCard({
  execution,
  title,
  compact = false,
  locale
}: {
  execution: CodingExecution;
  title: string;
  compact?: boolean;
  locale: CodingExercisesLocale;
}) {
  const testSummary = execution.resultSummary?.tests;
  const tests = Array.isArray(testSummary) ? testSummary : [];
  const outputCompared = canShowExecutionOutcome(execution) && execution.resultSummary?.outputCompared !== false;
  return (
    <section className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>{title}</strong>
        {execution.status === "pending" ? (
          <span className="muted">{formatCodingExercisesMessage(locale, "statusPending")}</span>
        ) : outputCompared ? (
          <OutcomeMark passed={execution.status === "completed"} locale={locale} />
        ) : null}
      </div>
      {execution.kind === "run" ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "runInput")}</label>
          <pre className="coding-exercise-output-text" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {execution.stdin || formatCodingExercisesMessage(locale, "noRunInput")}
          </pre>
        </div>
      ) : null}
      {execution.stdout ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "stdout")}</label>
          <pre className="coding-exercise-output-text" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.stdout}</pre>
        </div>
      ) : null}
      {execution.stderr ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "stderr")}</label>
          <pre className="coding-exercise-output-text" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.stderr}</pre>
        </div>
      ) : null}
      {execution.compileOutput ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "compileOutput")}</label>
          <pre className="coding-exercise-output-text" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.compileOutput}</pre>
        </div>
      ) : null}
      {execution.message ? <p className="muted">{execution.message}</p> : null}
      {execution.outputTruncated ? <p className="muted">{formatCodingExercisesMessage(locale, "outputTruncated")}</p> : null}
      {tests.length && !compact ? (
        <div className="stack">
          <strong>{formatCodingExercisesMessage(locale, "hiddenTestResults")}</strong>
          {tests.map((test) => {
            const item = test as Record<string, unknown>;
            return (
              <div key={String(item.id ?? item.name)} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <span>{String(item.name ?? item.id ?? formatCodingExercisesMessage(locale, "test"))}</span>
                {typeof item.passed === "boolean" ? <OutcomeMark passed={item.passed} locale={locale} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function getExecutionDisplayOutput(execution: CodingExecution, locale: CodingExercisesLocale) {
  const blocks: string[] = [];
  const stdout = execution.stdout ?? "";
  const stderr = execution.stderr ?? "";
  const compileOutput = execution.compileOutput ?? "";
  const message = execution.message?.trim();

  if (stdout) {
    blocks.push(stdout);
  }
  if (compileOutput) {
    blocks.push(`${formatCodingExercisesMessage(locale, "compilerOutput")}:\n${compileOutput}`);
  }
  if (stderr) {
    blocks.push(`${formatCodingExercisesMessage(locale, "runtimeError")}:\n${stderr}`);
  }
  if (message && message !== stderr.trim() && message !== compileOutput.trim()) {
    blocks.push(message);
  }

  return blocks.length ? blocks.join("\n\n") : formatCodingExercisesMessage(locale, "noOutput");
}

function OutcomeMark({ passed, locale }: { passed: boolean; locale: CodingExercisesLocale }) {
  const label = formatCodingExercisesMessage(locale, passed ? "passed" : "failed");
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        color: passed ? "#157347" : "#b42318",
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1
      }}
    >
      {passed ? "✓" : "✕"}
    </span>
  );
}

function canShowExecutionOutcome(execution: CodingExecution) {
  return execution.resultSummary?.gradingWithheld !== true && execution.resultSummary?.gradingPending !== true;
}
