"use client";

import { type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ActivityExecutionStateHost } from "@cognelo/activity-sdk";
import { CodeEditor, CodeRenderer, ContextMenu, EditActionBar, KnowledgeGenerationModeField, MarkdownRenderer, MonacoCodeEditor, RichTextEditor, getEditActionBarCopy, useActivityKnowledgeGeneration, useNotifications, useUnsavedChangesGuard, type ActivityKnowledgeGenerationRequest, type GeneratedKnowledgeSelection } from "@cognelo/activity-ui";
import {
  alignCodingExerciseStarterCodeToTemplate,
  balanceCodingExerciseAiRubricCriterionWeights,
  buildCodingExerciseStudentTemplateProjectionFromSource,
  buildCodingExerciseStudentTemplateSource,
  buildCodingExerciseTemplateSource,
  createCodingExerciseAiRubricCriterionId,
  codingExerciseDefaultHiddenTestCount,
  codingExerciseDefaultVisibleTestCount,
  codingExerciseMaxGeneratedTestCount,
  codingExerciseTemplateRequiresTestCodeMarker,
  codingExerciseTemplateInsertionToken,
  getCodingExerciseAiFeedbackValidationMessages,
  mergeCodingExerciseGeneratedSolutionPrivateConfig,
  normalizeCodingExerciseSampleTests,
  parseCodingExercisePrivateConfig,
  splitCodingExerciseTemplateSource,
  type CodingExerciseConfig,
  type CodingExerciseOutputMatchMode,
  type CodingExercisePrivateConfig
} from "../coding-exercises";
import {
  getCodingExerciseActivityConfig,
  getCodingExerciseInitialStudentSource
} from "./coding-exercise-student-source";
import { formatCodingExercisesMessage, normalizeCodingExercisesLocale, type CodingExercisesLocale } from "./messages";

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
      stdin?: string;
      expectedOutput?: string;
      testCode?: string;
      outputMatchMode?: CodingExerciseOutputMatchMode;
      containsLinesOrderMatters?: boolean;
      compareOutput?: boolean;
    }
  ) => Promise<{ execution: CodingExecution }>;
  listRuns: (courseId: string, activityId: string) => Promise<{ executions: CodingExecution[] }>;
  submitCode: (
    courseId: string,
    activityId: string,
    input: { sourceCode: string }
  ) => Promise<{
    execution: CodingExecution;
    availability: CodingAttemptAvailability;
    aiFeedback?: { feedback?: CodingExerciseAiFeedback } | null;
    aiFeedbackError?: string | null;
  }>;
  listSubmissions: (courseId: string, activityId: string) => Promise<{ executions: CodingExecution[] }>;
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
    title: string;
    description: string;
    prompt: string;
    referenceSolution: string;
    language: string;
    locale: CodingExercisesLocale;
    knowledge: ActivityKnowledgeGenerationRequest;
  }) => Promise<{ criteria: RubricCriterion[]; attempts: number }>;
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
  executionStateHost?: ActivityExecutionStateHost<Record<string, unknown>>;
  deferSubmission?: boolean;
  readOnly?: boolean;
  studentViewMode?: "attempt" | "previous";
  onNewAttemptAvailabilityChange?: (canStartNewAttempt: boolean) => void;
  onPreviousSubmissionsAvailabilityChange?: (hasPreviousSubmissions: boolean) => void;
  onSubmitted?: () => void;
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
  executionStateHost,
  deferSubmission = false,
  readOnly = false,
  studentViewMode = "attempt",
  onNewAttemptAvailabilityChange,
  onPreviousSubmissionsAvailabilityChange,
  onSubmitted
}: CodingExerciseActivityViewProps) {
  const pluginLocale = normalizeCodingExercisesLocale(locale);
  const actionCopy = getEditActionBarCopy(pluginLocale);
  const t = (key: Parameters<typeof formatCodingExercisesMessage>[1], values?: Record<string, string | number>) =>
    formatCodingExercisesMessage(pluginLocale, key, values);
  const notifications = useNotifications();
  const knowledgeGeneration = useActivityKnowledgeGeneration();
  const aiGenerationDraftRef = useRef<{
    prompt: string;
    referenceSolution: string;
    privateConfig: CodingExercisePrivateConfig;
    language: string;
  } | null>(null);
  const previousActivityIdRef = useRef(activity.id);
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
  const [referenceValidationSummary, setReferenceValidationSummary] = useState<Record<string, unknown> | null>(null);
  const [expandedSampleTestIds, setExpandedSampleTestIds] = useState<string[]>([]);
  const [expandedHiddenTestIds, setExpandedHiddenTestIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingSolution, setGeneratingSolution] = useState(false);
  const [generatingTests, setGeneratingTests] = useState(false);
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [gradingSection, setGradingSection] = useState<"rubric" | "tests">("rubric");
  const [replacementDialog, setReplacementDialog] = useState<"prompt" | "solution" | "rubric" | "tests" | null>(null);
  const [testGenerationDialogOpen, setTestGenerationDialogOpen] = useState(false);
  const [visibleTestGenerationCount, setVisibleTestGenerationCount] = useState(codingExerciseDefaultVisibleTestCount);
  const [hiddenTestGenerationCount, setHiddenTestGenerationCount] = useState(codingExerciseDefaultHiddenTestCount);
  const [error, setError] = useState("");
  const [editorCode, setEditorCode] = useState(() => getCodingExerciseInitialStudentSource(activity.config));
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
  const [executionStateLoaded, setExecutionStateLoaded] = useState(!executionStateHost);
  const studentWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const activityConfigKey = useMemo(() => JSON.stringify(activity.config ?? {}), [activity.config]);
  const sampleValidationTests = getReferenceValidationTests(referenceValidationSummary, "sampleTests");
  const hiddenValidationTests = getReferenceValidationTests(referenceValidationSummary, "hiddenTests");
  const templateProjection = buildCodingExerciseStudentTemplateProjectionFromSource(
    config.studentTemplateSource || buildCodingExerciseTemplateSource("", "")
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
    setEditorCode(alignCodingExerciseStarterCodeToTemplate(nextConfig.starterCode, nextConfig.studentTemplateSource));
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
      setExecutionStateLoaded(true);
      return;
    }
    let cancelled = false;
    setExecutionStateLoaded(false);
    const initialSourceCode = getCodingExerciseInitialStudentSource(
      JSON.parse(activityConfigKey) as Record<string, unknown>
    );
    executionStateHost.load()
      .then(async (saved) => {
        const sourceCode = typeof saved?.sourceCode === "string" ? saved.sourceCode : initialSourceCode;
        if (cancelled) return;
        setEditorCode(sourceCode);
        if (typeof saved?.sourceCode !== "string" && !readOnly) {
          await executionStateHost.save({ sourceCode });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("loadHistoryError"));
      })
      .finally(() => {
        if (!cancelled) setExecutionStateLoaded(true);
      });
    return () => { cancelled = true; };
  }, [activity.id, activityConfigKey, canManage, executionStateHost, readOnly]);

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
      return;
    }

    codingClient
      .listHiddenTests(course.id, activity.id)
      .then((result) => {
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
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("loadHiddenTestsError")));
  }, [activity.id, canManage, course?.id]);

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
    setPrivateConfig((current) => {
      const visibleLineNumbers = current.templateVisibleLineNumbers.includes(lineIndex)
        ? current.templateVisibleLineNumbers.filter((value) => value !== lineIndex)
        : [...current.templateVisibleLineNumbers, lineIndex].sort((left, right) => left - right);

      return {
        ...current,
        templateVisibleLineNumbers: visibleLineNumbers
      };
    });
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
      const normalizedPrivateConfig = parseCodingExercisePrivateConfig(getPersistedPrivateConfig(privateConfig));

      if (!normalizedPrivateConfig.templateSource.includes(codingExerciseTemplateInsertionToken)) {
        throw new Error(t("templateSourceMissingMarker"));
      }

      if (
        codingExerciseTemplateRequiresTestCodeMarker(normalizedPrivateConfig.templateSource, [
          ...normalizeCodingExerciseSampleTests(config.sampleTests),
          ...hiddenTests
        ])
      ) {
        throw new Error(t("templateTestCodeMissingMarker"));
      }

      const persistedActivityConfig = {
        prompt: config.prompt,
        language: config.language,
        executionMode: "template",
        starterCode: config.starterCode,
        studentTemplateSource: buildCodingExerciseStudentTemplateSource(
          normalizedPrivateConfig.templateSource,
          normalizedPrivateConfig.templateVisibleLineNumbers,
          config.language
        ),
        sampleTests: normalizeCodingExerciseSampleTests(config.sampleTests),
        maxEditorSeconds: config.maxEditorSeconds
      };
      const hiddenTestsInput = {
        tests: hiddenTests.map((test, index) => ({
          ...test,
          orderIndex: index
        })),
        sampleTests: normalizeCodingExerciseSampleTests(config.sampleTests),
        referenceSolution,
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

      await onSave({
        title,
        description,
        config: persistedActivityConfig
      });

      if (canManage && course?.id && codingClient) {
        const result = await codingClient.saveHiddenTests(course.id, activity.id, {
          ...hiddenTestsInput,
          validationReceipt
        });
        setHiddenTests(result.tests);
        setReferenceSolution(result.referenceSolution?.sourceCode ?? "");
        setPrivateConfig(parseCodingExercisePrivateConfig(result.referenceSolution?.privateConfig ?? {}));
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
      } else {
        setSavedSnapshot(currentSnapshot);
      }

      notifications.success(t("saved"));
      setError("");
    } catch (err) {
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
  }, [activity.id, canManage, codingClient, config, course?.id, currentSnapshot, description, hiddenTests, notifications, onSave, privateConfig, referenceSolution, t, title]);

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
    if (hasExistingGeneratedSolutionContent(config, privateConfig, referenceSolution)) {
      setReplacementDialog("solution");
      return;
    }
    void generateSolution();
  }

  async function generateSolution() {
    if (!aiGenerationClient || !config.language) {
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
        studentTemplateSource: result.templateSource
      }));
      setReferenceSolution(result.referenceSolution);
      const generatedPrivateConfig = mergeCodingExerciseGeneratedSolutionPrivateConfig(privateConfig, result);
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
    const referenceSolutionForGeneration = referenceSolution.trim() ? referenceSolution : draft?.referenceSolution ?? "";
    if (promptForGeneration.trim().length < 10) {
      notifications.error(t("generateTestsPromptRequired"));
      return;
    }
    if (!referenceSolutionForGeneration.trim()) {
      notifications.error(t("generateTestsReferenceRequired"));
      return;
    }
    if (hasExistingGeneratedTestContent(config, hiddenTests)) {
      setReplacementDialog("tests");
      return;
    }
    openTestGenerationCountDialog();
  }

  function openTestGenerationCountDialog() {
    setVisibleTestGenerationCount(codingExerciseDefaultVisibleTestCount);
    setHiddenTestGenerationCount(codingExerciseDefaultHiddenTestCount);
    setReplacementDialog(null);
    setTestGenerationDialogOpen(true);
  }

  async function generateTests(input: {
    visibleTestCount?: number;
    hiddenTestCount?: number;
  } = {}) {
    if (!aiGenerationClient || !config.language) {
      return;
    }

    const visibleTestCount = input.visibleTestCount ?? codingExerciseDefaultVisibleTestCount;
    const hiddenTestCount = input.hiddenTestCount ?? codingExerciseDefaultHiddenTestCount;
    setGeneratingTests(true);
    setReplacementDialog(null);
    setTestGenerationDialogOpen(false);
    setError("");
    try {
      const draft = aiGenerationDraftRef.current;
      const promptForGeneration = config.prompt.trim() ? config.prompt : draft?.prompt ?? "";
      const referenceSolutionForGeneration = referenceSolution.trim() ? referenceSolution : draft?.referenceSolution ?? "";
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
        visibleTestCount,
        hiddenTestCount,
        knowledge: knowledgeGeneration.request
      });
      if (result.status === "error") {
        notifications.error(result.message);
        return;
      }
      setConfig((current) => ({
        ...current,
        sampleTests: normalizeCodingExerciseSampleTests(result.sampleTests)
      }));
      const generatedAt = Date.now();
      const generatedHiddenTests = result.hiddenTests.map((test, index) => ({
        ...test,
        outputMatchMode: "contains_lines" as const,
        containsLinesOrderMatters: false,
        id: `${test.id}-${generatedAt}-${index + 1}`.slice(0, 80),
        orderIndex: index,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      setHiddenTests(generatedHiddenTests);
      setReferenceValidationSummary(result.validationSummary);
      setExpandedSampleTestIds(result.sampleTests.map((test) => test.id));
      setExpandedHiddenTestIds(generatedHiddenTests.map((test) => test.id));
      knowledgeGeneration.applySelections(result.knowledgeConceptSelections);
      if (result.status === "warning" && result.warningMessage) {
        notifications.warning(result.warningMessage);
      }
      notifications.success(result.attempts > 1 ? `${t("generatedTests")} (${result.attempts})` : t("generatedTests"));
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
    if (!title.trim() || config.prompt.trim().length < 10 || !referenceSolution.trim()) {
      notifications.error(t("generateRubricRequirements"));
      return;
    }
    if (privateConfig.aiFeedback.criteria.length > 0) {
      setReplacementDialog("rubric");
      return;
    }
    void generateRubric();
  }

  async function generateRubric() {
    if (!aiGenerationClient || !config.language) {
      return;
    }

    setGeneratingRubric(true);
    setReplacementDialog(null);
    setError("");
    try {
      const result = await aiGenerationClient.generateRubric({
        title,
        description,
        prompt: config.prompt,
        referenceSolution,
        language: config.language,
        locale: pluginLocale,
        knowledge: knowledgeGeneration.request
      });
      setPrivateConfig((current) => ({
        ...current,
        aiFeedback: { ...current.aiFeedback, criteria: result.criteria }
      }));
      notifications.success(result.attempts > 1 ? `${t("generatedRubric")} (${result.attempts})` : t("generatedRubric"));
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("generateRubricError"));
    } finally {
      setGeneratingRubric(false);
    }
  }

  async function runCode() {
    if (!course?.id || !codingClient || !config.language || !editorCode.trim()) {
      return;
    }
    setWorkingAction("run");
    setError("");
    setRunExecution(null);
    try {
      const isPersonalizedTest = selectedSampleTestId === personalizedTestId;
      const result = await codingClient.runCode(course.id, activity.id, {
        sourceCode: editorCode,
        stdin: sampleInput,
        expectedOutput: isPersonalizedTest ? "" : sampleExpectedOutput,
        testCode: isPersonalizedTest ? "" : sampleTestCode,
        outputMatchMode: isPersonalizedTest ? "exact" : sampleOutputMatchMode,
        containsLinesOrderMatters: isPersonalizedTest ? false : sampleContainsLinesOrderMatters,
        compareOutput: !isPersonalizedTest
      });
      setRunExecution(result.execution);
      setRecentRuns((current) => [result.execution, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("runError"));
    } finally {
      setWorkingAction(null);
    }
  }

  async function submitCode() {
    if (!course?.id || !codingClient || !config.language || !editorCode.trim()) {
      return;
    }
    setWorkingAction("submit");
    setError("");
    try {
      const result = await codingClient.submitCode(course.id, activity.id, {
        sourceCode: editorCode
      });
      await executionStateHost?.clear?.().catch(() => undefined);
      setSubmitExecution(result.execution);
      setEditorCode(alignCodingExerciseStarterCodeToTemplate(config.starterCode, config.studentTemplateSource));
      setRunExecution(null);
      setPreviousAttempts((current) => [
        { submission: result.execution, runs: [...recentRuns].reverse() },
        ...current
      ]);
      setRecentRuns([]);
      setIsWorkspaceFullScreen(false);
      setSubmissionConfirmation(result);
      onPreviousSubmissionsAvailabilityChange?.(true);
      if (result.availability.canStart) {
        onNewAttemptAvailabilityChange?.(!readOnly);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitError"));
    } finally {
      setWorkingAction(null);
    }
  }

  function updateStudentCode(sourceCode: string) {
    setEditorCode(sourceCode);
    setSubmitExecution(null);
    if (executionStateHost && executionStateLoaded && !readOnly) {
      void executionStateHost.save({ sourceCode }).catch((err) => {
        setError(err instanceof Error ? err.message : t("submitError"));
      });
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
    if (replacementDialog === "prompt") {
      return t("generatePrompt");
    }
    if (replacementDialog === "solution") {
      return t("generateSolution");
    }
    if (replacementDialog === "rubric") {
      return t("generateRubric");
    }
    return t("generateTests");
  }

  function getReplacementDialogTitle() {
    if (replacementDialog === "prompt") {
      return t("replacePromptTitle");
    }
    if (replacementDialog === "solution") {
      return t("replaceSolutionTitle");
    }
    if (replacementDialog === "rubric") {
      return t("replaceRubricTitle");
    }
    return t("replaceTestsTitle");
  }

  function getReplacementDialogMessage() {
    if (replacementDialog === "prompt") {
      return t("replacePromptMessage");
    }
    if (replacementDialog === "solution") {
      return t("replaceSolutionMessage");
    }
    if (replacementDialog === "rubric") {
      return t("replaceRubricMessage");
    }
    return t("replaceTestsMessage");
  }

  function getKeepReplacementLabel() {
    if (replacementDialog === "prompt") {
      return t("keepCurrentPrompt");
    }
    if (replacementDialog === "solution") {
      return t("keepCurrentSolution");
    }
    if (replacementDialog === "rubric") {
      return t("keepCurrentRubric");
    }
    return t("keepCurrentTests");
  }

  function getReplaceReplacementLabel() {
    if (replacementDialog === "prompt") {
      return t("replaceCurrentPrompt");
    }
    if (replacementDialog === "solution") {
      return t("replaceCurrentSolution");
    }
    if (replacementDialog === "rubric") {
      return t("replaceCurrentRubric");
    }
    return t("replaceCurrentTests");
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
    if (replacementDialog === "rubric") {
      void generateRubric();
      return;
    }
    openTestGenerationCountDialog();
  }

  function renderAuthoringGrading(content: ReactNode) {
    if (authoringGradingPortalTarget === undefined) return content;
    return authoringGradingPortalTarget ? createPortal(content, authoringGradingPortalTarget) : null;
  }

  const testGenerationCountsValid = [visibleTestGenerationCount, hiddenTestGenerationCount].every(
    (count) => Number.isInteger(count) && count >= 1 && count <= codingExerciseMaxGeneratedTestCount
  );

  return (
    <section className="section stack">
      {canManage ? (
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
                setReferenceValidationSummary(null);
                setConfig((current) => ({ ...current, language: nextLanguage }));
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

          {aiGenerationClient ? (
            <button
              className="secondary"
              type="button"
              disabled={!config.language || generatingSolution || config.prompt.trim().length < 10}
              onClick={requestSolutionGeneration}
            >
              {generatingSolution ? t("generatingSolution") : t("generateSolution")}
            </button>
          ) : null}

          {replacementDialog && typeof document !== "undefined" ? createPortal(
            <div className="dialog-backdrop" role="presentation">
              <div
                aria-modal="true"
                className="dialog-panel"
                role="dialog"
                aria-labelledby={`coding-generation-replace-${replacementDialog}`}
              >
                <div className="stack" style={{ gap: 8 }}>
                  <p className="eyebrow">{getReplacementDialogEyebrow()}</p>
                  <h2 id={`coding-generation-replace-${replacementDialog}`}>{getReplacementDialogTitle()}</h2>
                  <p className="muted">{getReplacementDialogMessage()}</p>
                </div>
                <div className="dialog-actions">
                  <button className="secondary" type="button" onClick={() => setReplacementDialog(null)}>
                    {getKeepReplacementLabel()}
                  </button>
                  <button type="button" onClick={confirmReplacementGeneration}>
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
                <div className="stack" style={{ gap: 8 }}>
                  <p className="eyebrow">{t("generateTests")}</p>
                  <h2 id="coding-generation-tests-title">{t("generateTestsDialogTitle")}</h2>
                  <p className="muted" id="coding-generation-tests-description">{t("generateTestsDialogMessage")}</p>
                </div>
                <div className="form-grid two-columns">
                  <div className="field">
                    <label htmlFor="coding-generation-visible-test-count">{t("visibleTestCount")}</label>
                    <input
                      id="coding-generation-visible-test-count"
                      max={codingExerciseMaxGeneratedTestCount}
                      min={1}
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
                      max={codingExerciseMaxGeneratedTestCount}
                      min={1}
                      step={1}
                      type="number"
                      value={hiddenTestGenerationCount}
                      onChange={(event) => setHiddenTestGenerationCount(Number(event.target.value))}
                    />
                  </div>
                </div>
                <p className="muted">{t("testCountLimit")}</p>
                <div className="dialog-actions">
                  <button className="secondary" type="button" onClick={() => setTestGenerationDialogOpen(false)}>
                    {t("cancelTestGeneration")}
                  </button>
                  <button
                    disabled={!config.language || !testGenerationCountsValid}
                    type="button"
                    onClick={() => void generateTests({
                      visibleTestCount: visibleTestGenerationCount,
                      hiddenTestCount: hiddenTestGenerationCount
                    })}
                  >
                    {t("confirmTestGeneration")}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          ) : null}

          <div className="stack">
            <label className="editor-section-label">{t("starterCode")}</label>
            <CodeEditor
              value={config.starterCode}
              onChange={(value) => setConfig((current) => ({ ...current, starterCode: value }))}
              language={config.language}
              minHeight={220}
            />
          </div>

          <div className="stack">
            <label className="editor-section-label">{t("referenceSolution")}</label>
            <p className="muted" style={{ margin: 0 }}>
              {t("referenceSolutionHelp")}
            </p>
            <CodeEditor
              value={referenceSolution}
              onChange={(value) => {
                aiGenerationDraftRef.current = null;
                setReferenceSolution(value);
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
          </div>

          <div className="stack">
            <label className="editor-section-label">{t("templateSource")}</label>
            <p className="muted" style={{ margin: 0 }}>
              {t("templateSourceHelp")}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              {t("templateVisibleLinesHelp")}
            </p>
            <CodeEditor
              value={privateConfig.templateSource || buildCodingExerciseTemplateSource("", "")}
              onChange={(value) => {
                aiGenerationDraftRef.current = null;
                setPrivateConfig((current) => {
                  const nextTemplate = value || buildCodingExerciseTemplateSource("", "");
                  const templateParts = splitCodingExerciseTemplateSource(nextTemplate);
                  return {
                    ...current,
                    templateSource: nextTemplate,
                    templateVisibleLineNumbers: current.templateVisibleLineNumbers.filter(
                      (lineNumber) => lineNumber < nextTemplate.split("\n").length
                    ),
                    templatePrefix: templateParts.prefix,
                    templateSuffix: templateParts.suffix
                  };
                });
              }}
              language={config.language}
              getLineClassName={(lineIndex) =>
                privateConfig.templateVisibleLineNumbers.includes(lineIndex)
                  ? "coding-exercise-template-line is-visible"
                  : "coding-exercise-template-line"
              }
              leftRail={renderTemplateVisibilityRail(
                (privateConfig.templateSource || buildCodingExerciseTemplateSource("", "")).split("\n"),
                privateConfig.templateVisibleLineNumbers,
                toggleTemplateVisibleLine,
                t
              )}
              leftRailWidth={20}
              minHeight={260}
            />
          </div>

          <div className="field">
            <label htmlFor="coding-max-editor-seconds">{t("editorTimeLimit")}</label>
            <input
              id="coding-max-editor-seconds"
              type="number"
              min={30}
              max={14400}
              value={config.maxEditorSeconds}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  maxEditorSeconds: Number(event.target.value || "1800")
                }))
              }
            />
          </div>

          {renderAuthoringGrading(<div className="stack">
            <div>
              <h2>{t("gradingTitle")}</h2>
              <p className="muted">{t("gradingHelp")}</p>
            </div>
            <div className="settings-layout coding-exercise-grading-layout">
              <aside className="settings-nav coding-exercise-grading-nav" aria-label={t("gradingSections")} role="tablist">
                <button
                  aria-controls="coding-exercise-rubric-panel"
                  aria-selected={gradingSection === "rubric"}
                  className={gradingSection === "rubric" ? "is-active" : ""}
                  role="tab"
                  type="button"
                  onClick={() => setGradingSection("rubric")}
                >
                  <span>{t("rubricSectionTab")}</span>
                </button>
                <button
                  aria-controls="coding-exercise-tests-panel"
                  aria-selected={gradingSection === "tests"}
                  className={gradingSection === "tests" ? "is-active" : ""}
                  role="tab"
                  type="button"
                  onClick={() => setGradingSection("tests")}
                >
                  <span>{t("testCasesSectionTab")}</span>
                </button>
              </aside>
              <div
                className="stack"
                hidden={gradingSection !== "rubric"}
                id="coding-exercise-rubric-panel"
                role="tabpanel"
              >
            <section className="stack">
              <label className="checkbox-row">
                <input
                  checked={privateConfig.aiFeedback.gradingEnabled}
                  type="checkbox"
                  onChange={(event) => setPrivateConfig((current) => ({
                    ...current,
                    aiFeedback: {
                      ...current.aiFeedback,
                      gradingEnabled: event.target.checked,
                      criteria: event.target.checked && current.aiFeedback.criteria.length === 0
                        ? [{ id: "correctness", title: "Correctness and approach", description: "Evaluate the correctness, clarity, and suitability of the submitted approach.", weightPercent: 100 }]
                        : current.aiFeedback.criteria
                    }
                  }))}
                />
                <span>{t("aiGradingEnabled")}</span>
              </label>
              {privateConfig.aiFeedback.gradingEnabled ? (
                <div className="form-grid two-columns">
                  <div className="field">
                    <label htmlFor="coding-ai-test-weight">{t("testWeightPercent")}</label>
                    <input
                      id="coding-ai-test-weight"
                      min={0}
                      max={100}
                      required
                      type="number"
                      value={privateConfig.aiFeedback.testWeightPercent}
                      onChange={(event) => setPrivateConfig((current) => ({ ...current, aiFeedback: { ...current.aiFeedback, testWeightPercent: Number(event.target.value) } }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="coding-ai-rubric-weight">{t("aiWeightPercent")}</label>
                    <input
                      id="coding-ai-rubric-weight"
                      min={0}
                      max={100}
                      required
                      type="number"
                      value={privateConfig.aiFeedback.aiWeightPercent}
                      onChange={(event) => setPrivateConfig((current) => ({ ...current, aiFeedback: { ...current.aiFeedback, aiWeightPercent: Number(event.target.value) } }))}
                    />
                  </div>
                </div>
              ) : null}
            </section>

            <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
              <div>
                <h3>{t("rubricTitle")}</h3>
                <p className="muted">{t("rubricHelp")}</p>
              </div>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <h4>{t("rubricCriteria")}</h4>
                <div className="row">
                  {aiGenerationClient ? (
                    <button
                      className="button secondary"
                      disabled={!config.language || generatingRubric || !title.trim() || config.prompt.trim().length < 10 || !referenceSolution.trim()}
                      title={!config.language
                        ? t("languageRequired")
                        : !title.trim() || config.prompt.trim().length < 10 || !referenceSolution.trim()
                          ? t("generateRubricRequirements")
                          : undefined}
                      type="button"
                      onClick={requestRubricGeneration}
                    >
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
                        >−</button>
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

            <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
              <div>
                <h3>{t("aiFeedbackTitle")}</h3>
                <p className="muted">{t("aiFeedbackHelp")}</p>
              </div>
              <label className="checkbox-row">
                <input
                  checked={privateConfig.aiFeedback.enabled}
                  type="checkbox"
                  onChange={(event) => setPrivateConfig((current) => ({
                    ...current,
                    aiFeedback: {
                      ...current.aiFeedback,
                      enabled: event.target.checked,
                      criteria: event.target.checked && current.aiFeedback.criteria.length === 0
                        ? [{ id: "correctness", title: "Correctness and approach", description: "Evaluate the correctness, clarity, and suitability of the submitted approach.", weightPercent: 100 }]
                        : current.aiFeedback.criteria
                    }
                  }))}
                />
                <span>{t("aiFeedbackEnabled")}</span>
              </label>
              {privateConfig.aiFeedback.enabled ? (
                <div className="field">
                  <label htmlFor="coding-ai-instructions">{t("feedbackInstructions")}</label>
                  <textarea
                    id="coding-ai-instructions"
                    maxLength={8000}
                    required
                    rows={5}
                    value={privateConfig.aiFeedback.instructions}
                    onChange={(event) => setPrivateConfig((current) => ({ ...current, aiFeedback: { ...current.aiFeedback, instructions: event.target.value } }))}
                  />
                </div>
              ) : null}
              {aiFeedbackValidationMessages.length ? (
                <div className="error" role="alert">
                  <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                    {aiFeedbackValidationMessages.map((message) => <li key={message}>{message}</li>)}
                  </ul>
                </div>
              ) : null}
            </section>

              </div>
              <div
                className="stack"
                hidden={gradingSection !== "tests"}
                id="coding-exercise-tests-panel"
                role="tabpanel"
              >

          {aiGenerationClient ? (
            <button
              className="secondary"
              type="button"
              disabled={!config.language || generatingTests || config.prompt.trim().length < 10 || !referenceSolution.trim()}
              onClick={requestTestsGeneration}
            >
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
                      <label htmlFor={`sample-output-match-mode-${index}`}>{t("outputMatchMode")}</label>
                      <select
                        id={`sample-output-match-mode-${index}`}
                        value={test.outputMatchMode}
                        onChange={(event) => updateSampleTest(index, "outputMatchMode", event.target.value)}
                      >
                        <option value="exact">{t("outputMatchExact")}</option>
                        <option value="contains_lines">{t("outputMatchContainsLines")}</option>
                        <option value="regex">{t("outputMatchRegex")}</option>
                      </select>
                      <p className="muted" style={{ margin: 0 }}>
                        {test.outputMatchMode === "contains_lines"
                          ? t("outputMatchContainsLinesHelp")
                          : test.outputMatchMode === "regex"
                            ? t("outputMatchRegexHelp")
                            : t("outputMatchExactHelp")}
                      </p>
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
                      <label className="editor-section-label">{t("testHarnessCode")}</label>
                      <p className="muted" style={{ margin: 0 }}>
                        {t("testHarnessCodeHelp")}
                      </p>
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
              <h3>{t("hiddenTests")}</h3>
              <button type="button" className="button secondary" disabled={!config.language} onClick={addHiddenTest}>
                {t("addHiddenTest")}
              </button>
            </div>
            <p className="muted">{t("hiddenTestsHelp")}</p>
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
                      <label htmlFor={`hidden-output-match-mode-${index}`}>{t("outputMatchMode")}</label>
                      <select
                        id={`hidden-output-match-mode-${index}`}
                        value={test.outputMatchMode}
                        onChange={(event) => updateHiddenTest(index, "outputMatchMode", event.target.value)}
                      >
                        <option value="exact">{t("outputMatchExact")}</option>
                        <option value="contains_lines">{t("outputMatchContainsLines")}</option>
                        <option value="regex">{t("outputMatchRegex")}</option>
                      </select>
                      <p className="muted" style={{ margin: 0 }}>
                        {test.outputMatchMode === "contains_lines"
                          ? t("outputMatchContainsLinesHelp")
                          : test.outputMatchMode === "regex"
                            ? t("outputMatchRegexHelp")
                            : t("outputMatchExactHelp")}
                      </p>
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
                      <label className="editor-section-label">{t("testHarnessCode")}</label>
                      <p className="muted" style={{ margin: 0 }}>
                        {t("testHarnessCodeHelp")}
                      </p>
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
          {authoringGradingPortalTarget !== undefined ? (
            <>
              {error ? <p className="error">{error}</p> : null}
              <EditActionBar
                isDirty={hasUnsavedChanges}
                isSaving={saving}
                saveDisabled={!config.language || aiFeedbackValidationMessages.length > 0}
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
            saveDisabled={!config.language || aiFeedbackValidationMessages.length > 0}
            savedLabel={actionCopy.saved}
            unsavedLabel={actionCopy.unsaved}
            saveLabel={t("saveCodingExercise")}
            savingLabel={t("saving")}
            cancelLabel={actionCopy.cancel}
            onCancel={discardChanges}
            onSave={saveCodingExercise}
          />
        </form>
      ) : (
        <div className="stack">
          {studentViewMode === "previous" ? (
            <CodingAttemptHistoryList attempts={previousAttempts} language={config.language} locale={pluginLocale} />
          ) : (
            <>
              <MarkdownRenderer className="coding-exercise-student-prompt" markdown={config.prompt} />
              <div
                aria-label={isWorkspaceFullScreen ? t("fullScreen") : undefined}
                aria-modal={isWorkspaceFullScreen || undefined}
                className={`coding-exercise-workspace-shell${isWorkspaceFullScreen ? " is-full-screen" : ""}`}
                role={isWorkspaceFullScreen ? "dialog" : undefined}
              >
                <div className="coding-exercise-workspace-toolbar">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setIsWorkspaceFullScreen((current) => !current)}
                  >
                    {isWorkspaceFullScreen ? t("exitFullScreen") : t("fullScreen")}
                  </button>
                </div>

                <div
                  className={`coding-exercise-student-workspace${deferSubmission ? "" : " has-actions"}`}
                  ref={studentWorkspaceRef}
                  style={
                    {
                      "--coding-exercise-editor-width": workspaceEditorWidth === null ? "2fr" : `${workspaceEditorWidth}px`
                    } as CSSProperties
                  }
                >
                  <div className="coding-exercise-editor-pane">
                    <MonacoCodeEditor
                      id={`coding-exercise-student-${activity.id}`}
                      ariaLabel={activity.title || t("starterCode")}
                      value={editorCode}
                      onChange={updateStudentCode}
                      language={config.language}
                      height="100%"
                      minHeight={isWorkspaceFullScreen ? 0 : 520}
                      readOnly={readOnly || !executionStateLoaded}
                      readOnlyPrefix={templateProjection.readOnlyPrefix}
                      readOnlySuffix={templateProjection.readOnlySuffix}
                    />
                  </div>

                  {!deferSubmission ? (
                    <div className="row coding-exercise-editor-actions" style={{ alignItems: "center" }}>
                      <button type="button" onClick={submitCode} disabled={!config.language || readOnly || workingAction === "submit" || !editorCode.trim()}>
                        {workingAction === "submit" ? t("submitting") : t("submitForGrading")}
                      </button>
                      {submitExecution && submitExecution.status !== "pending" ? (
                        <OutcomeMark passed={submitExecution.status === "completed"} locale={pluginLocale} />
                      ) : null}
                    </div>
                  ) : null}

                  <div
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

                  <button type="button" onClick={runCode} disabled={!config.language || readOnly || workingAction === "run" || !editorCode.trim()}>
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
                  </section>
                </div>
              </div>

              {recentRuns.length ? (
                <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
                  <h3>{t("recentRuns")}</h3>
                  {recentRuns.map((execution) => (
                    <ExecutionCard
                      key={execution.id}
                      execution={execution}
                      title={new Date(execution.createdAt).toLocaleString(pluginLocale)}
                      compact
                      locale={pluginLocale}
                    />
                  ))}
                </section>
              ) : null}
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
                  <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                    <h2 id="coding-submission-confirmation-title" style={{ margin: 0 }}>
                      {t("submissionCompleteTitle")}
                    </h2>
                    <OutcomeMark
                      passed={submissionConfirmation.execution.status === "completed"}
                      locale={pluginLocale}
                    />
                  </div>
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
                    {t("confirmOk")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
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
  return (
    <section className="stack coding-exercise-attempt-history">
      {attempts.map((attempt, index) => {
        const attemptNumber = attempts.length - index;
        return (
          <details className="coding-exercise-attempt-accordion" key={attempt.submission.id}>
            <summary>
              <span>{formatCodingExercisesMessage(locale, "attemptNumber", { number: attemptNumber })}</span>
              <time dateTime={attempt.submission.createdAt}>
                {new Date(attempt.submission.createdAt).toLocaleString(locale)}
              </time>
              {attempt.submission.status === "pending" ? (
                <span className="muted">{formatCodingExercisesMessage(locale, "statusPending")}</span>
              ) : (
                <OutcomeMark passed={attempt.submission.status === "completed"} locale={locale} />
              )}
            </summary>
            <div className="stack coding-exercise-attempt-content">
              <div className="stack stack-tight">
                <strong>{formatCodingExercisesMessage(locale, "submittedSolution")}</strong>
                <CodeRenderer code={attempt.submission.sourceCode} language={language} showLineNumbers />
              </div>
              <ExecutionCard
                execution={attempt.submission}
                title={formatCodingExercisesMessage(locale, "submissionResult")}
                locale={locale}
              />
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

function hasExistingGeneratedTestContent(config: CodingExerciseConfig, hiddenTests: HiddenTest[]) {
  const normalizedSampleTests = normalizeCodingExerciseSampleTests(config.sampleTests);
  return Boolean(normalizedSampleTests.length || hiddenTests.length);
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
  const outputCompared = execution.resultSummary?.outputCompared !== false;
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
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {execution.stdin || formatCodingExercisesMessage(locale, "noRunInput")}
          </pre>
        </div>
      ) : null}
      {execution.stdout ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "stdout")}</label>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.stdout}</pre>
        </div>
      ) : null}
      {execution.stderr ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "stderr")}</label>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.stderr}</pre>
        </div>
      ) : null}
      {execution.compileOutput ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "compileOutput")}</label>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.compileOutput}</pre>
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
