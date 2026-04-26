"use client";

import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownRenderer, MonacoCodeEditor, useNotifications } from "@cognelo/activity-ui";
import {
  buildWebDesignPreviewDocument,
  defaultWebDesignExerciseConfig,
  inferWebDesignFileLanguage,
  normalizeWebDesignExerciseConfig,
  normalizeWebDesignFilePath,
  parseWebDesignExerciseConfig,
  webDesignExpectedResultTokenPattern,
  webDesignPromptIncludesExpectedResult,
  webDesignPromptRequestsCroppedExpectedResult,
  type WebDesignExerciseConfig,
  type WebDesignExerciseFile,
  type WebDesignExerciseTestKind,
  type WebDesignFileLanguage
} from "../web-design-coding-exercises";

type ActivityLike = {
  id: string;
  title: string;
  description: string;
  config?: Record<string, unknown>;
};

type CourseLike = {
  id: string;
};

type WebDesignExerciseTestRecord = {
  id: string;
  name: string;
  kind: WebDesignExerciseTestKind;
  testCode: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
  metadata: Record<string, unknown>;
  validationSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type WebDesignExerciseReferenceBundleRecord = {
  files: WebDesignExerciseFile[];
  validationSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type WebDesignExerciseSubmissionRecord = {
  id: string;
  activityId: string;
  userId: string;
  kind: "run" | "submit";
  status: "pending" | "completed" | "failed";
  files: WebDesignExerciseFile[];
  resultSummary: Record<string, unknown>;
  score: number | null;
  maxScore: number | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  testResults: Array<{
    id: string;
    testId: string | null;
    name: string;
    status: "pending" | "completed" | "failed";
    weight: number;
    score: number | null;
    message: string | null;
    durationMs: number | null;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
};

type WebDesignExerciseClient = {
  listTests: (
    courseId: string,
    activityId: string
  ) => Promise<{ tests: WebDesignExerciseTestRecord[]; referenceBundle: WebDesignExerciseReferenceBundleRecord | null }>;
  saveTests: (
    courseId: string,
    activityId: string,
    input: {
      shouldCaptureExpectedResult?: boolean;
      shouldCropExpectedResult?: boolean;
      referenceFiles: WebDesignExerciseFile[];
      tests: Array<Omit<WebDesignExerciseTestRecord, "orderIndex" | "createdAt" | "updatedAt" | "validationSummary">>;
    }
  ) => Promise<{ tests: WebDesignExerciseTestRecord[]; referenceBundle: WebDesignExerciseReferenceBundleRecord | null }>;
  getExpectedResult: (courseId: string, activityId: string) => Promise<{ imageDataUrl: string | null }>;
  runCode: (courseId: string, activityId: string, input: { files: WebDesignExerciseFile[] }) => Promise<{ submission: WebDesignExerciseSubmissionRecord }>;
  listRuns: (courseId: string, activityId: string) => Promise<{ submissions: WebDesignExerciseSubmissionRecord[] }>;
  submitCode: (
    courseId: string,
    activityId: string,
    input: { files: WebDesignExerciseFile[] }
  ) => Promise<{ submission: WebDesignExerciseSubmissionRecord }>;
  listSubmissions: (courseId: string, activityId: string) => Promise<{ submissions: WebDesignExerciseSubmissionRecord[] }>;
};

type WebDesignCodingExerciseActivityViewProps = {
  activity: ActivityLike;
  canManage: boolean;
  course?: CourseLike | null;
  onSave: (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<ActivityLike>;
  locale?: "en" | "fr" | "zh";
  webDesignClient?: WebDesignExerciseClient;
};

type ApiErrorLike = Error & {
  code?: string;
  details?: unknown;
};

type PreviewConsoleMessage = {
  id: string;
  level: "debug" | "error" | "info" | "log" | "warn";
  values: string[];
};

type PreviewPaneCopy = {
  preview: string;
  console: string;
  clearConsole: string;
  emptyConsole: string;
  expectedResult: string;
};

type StudentWorkspaceCopy = PreviewPaneCopy & {
  files: string;
  solutionFiles: string;
  starterFiles: string;
  addFile: string;
  editor: string;
  saving: string;
  remove: string;
  path: string;
  language: string;
  editable: string;
  fullScreen: string;
  exitFullScreen: string;
  testsTitle: string;
  testsLoadError: string;
  testsSaved: string;
  testsSaveError: string;
  testsSaveValidationError: string;
  referenceBundle: string;
  useCurrentFiles: string;
  addTest: string;
  saveTests: string;
  noTests: string;
  testName: string;
  testKind: string;
  testCode: string;
  confirmRemoveTest: string;
  setupTab: string;
  sample: string;
  hidden: string;
  enabled: string;
  weight: string;
  runTests: string;
  submit: string;
  runningTests: string;
  submitting: string;
  result: string;
  passed: string;
  failed: string;
  noRunner: string;
  noCourse: string;
  fileCode: string;
  solutionCode: string;
  starterCode: string;
  previewSolution: string;
};

const fileLanguageOptions: Array<{ value: WebDesignFileLanguage; label: string }> = [
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "javascript", label: "JavaScript" }
];

function alignStarterFilesToSolutionFiles(starterFiles: readonly WebDesignExerciseFile[], solutionFiles: readonly WebDesignExerciseFile[]) {
  return solutionFiles.map((solutionFile, index) => {
    const starterFile = starterFiles.find((file) => normalizeWebDesignFilePath(file.path) === solutionFile.path);
    return {
      ...solutionFile,
      id: starterFile?.id ?? `starter-${solutionFile.id}`,
      starterCode: starterFile?.starterCode ?? "",
      isEditable: starterFile?.isEditable ?? true,
      orderIndex: index
    };
  });
}

function formatWebDesignCopy(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((message, [key, value]) => message.replaceAll(`{${key}}`, value), template);
}

const copyByLocale = {
  en: {
    authoringTitle: "Web design exercise authoring",
    title: "Title",
    description: "Description",
    prompt: "Prompt",
    files: "Files",
    solutionFiles: "Solution files",
    starterFiles: "Student starting files",
    preview: "Preview",
    previewSolution: "Solution preview",
    expectedResult: "Expected result image",
    addFile: "Add file",
    remove: "Remove",
    path: "Path",
    language: "Language",
    editable: "Student editable",
    saving: "Saving...",
    save: "Save web design exercise",
    saved: "Web design exercise saved.",
    saveError: "Unable to save the web design exercise right now.",
    duplicatePath: "Each file path must be unique.",
    missingFile: "Add at least one file.",
    fileCode: "File code",
    solutionCode: "Teacher solution code",
    starterCode: "Student starting code",
    editor: "Editor",
    console: "Console",
    clearConsole: "Clear",
    emptyConsole: "No messages",
    fullScreen: "Full screen",
    exitFullScreen: "Exit full screen",
    testsTitle: "Playwright tests",
    testsLoadError: "Unable to load web design tests.",
    testsSaved: "Web design tests and solution saved.",
    testsSaveError: "Unable to save web design tests and solution right now.",
    testsSaveValidationError: "Error saving because {count} tests failed.",
    referenceBundle: "Reference bundle",
    useCurrentFiles: "Use solution files as reference",
    addTest: "Add test",
    saveTests: "Save tests and solution",
    noTests: "No tests yet.",
    testName: "Test name",
    testKind: "Kind",
    testCode: "Playwright test code",
    confirmRemoveTest: "Delete this test?",
    setupTab: "Setup",
    sample: "Sample",
    hidden: "Hidden",
    enabled: "Enabled",
    weight: "Weight",
    runTests: "Run sample tests",
    submit: "Submit",
    runningTests: "Running...",
    submitting: "Submitting...",
    result: "Result",
    passed: "Passed",
    failed: "Failed",
    noRunner: "Tests are not available yet.",
    noCourse: "Open this exercise from a course to run tests."
  },
  fr: {
    authoringTitle: "Edition de l'exercice de conception web",
    title: "Titre",
    description: "Description",
    prompt: "Consigne",
    files: "Fichiers",
    solutionFiles: "Fichiers de solution",
    starterFiles: "Fichiers de depart etudiants",
    preview: "Apercu",
    previewSolution: "Apercu de la solution",
    expectedResult: "Image du resultat attendu",
    addFile: "Ajouter un fichier",
    remove: "Retirer",
    path: "Chemin",
    language: "Langage",
    editable: "Modifiable par l'etudiant",
    saving: "Enregistrement...",
    save: "Enregistrer l'exercice web",
    saved: "L'exercice de conception web a ete enregistre.",
    saveError: "Impossible d'enregistrer l'exercice de conception web pour le moment.",
    duplicatePath: "Chaque chemin de fichier doit etre unique.",
    missingFile: "Ajoutez au moins un fichier.",
    fileCode: "Code du fichier",
    solutionCode: "Code de solution enseignant",
    starterCode: "Code de depart etudiant",
    editor: "Editeur",
    console: "Console",
    clearConsole: "Effacer",
    emptyConsole: "Aucun message",
    fullScreen: "Plein ecran",
    exitFullScreen: "Quitter le plein ecran",
    testsTitle: "Tests Playwright",
    testsLoadError: "Impossible de charger les tests de conception web.",
    testsSaved: "Les tests et la solution de conception web ont ete enregistres.",
    testsSaveError: "Impossible d'enregistrer les tests et la solution de conception web pour le moment.",
    testsSaveValidationError: "Erreur d'enregistrement : {count} tests ont echoue.",
    referenceBundle: "Ensemble de reference",
    useCurrentFiles: "Utiliser les fichiers de solution comme reference",
    addTest: "Ajouter un test",
    saveTests: "Enregistrer les tests et la solution",
    noTests: "Aucun test pour le moment.",
    testName: "Nom du test",
    testKind: "Type",
    testCode: "Code de test Playwright",
    confirmRemoveTest: "Supprimer ce test ?",
    setupTab: "Configuration",
    sample: "Exemple",
    hidden: "Cache",
    enabled: "Active",
    weight: "Poids",
    runTests: "Lancer les tests d'exemple",
    submit: "Soumettre",
    runningTests: "Execution...",
    submitting: "Soumission...",
    result: "Resultat",
    passed: "Reussi",
    failed: "Echoue",
    noRunner: "Les tests ne sont pas encore disponibles.",
    noCourse: "Ouvrez cet exercice depuis un cours pour lancer les tests."
  },
  zh: {
    authoringTitle: "网页设计练习编辑",
    title: "标题",
    description: "说明",
    prompt: "题目",
    files: "文件",
    solutionFiles: "参考答案文件",
    starterFiles: "学生起始文件",
    preview: "预览",
    previewSolution: "参考答案预览",
    expectedResult: "预期结果图片",
    addFile: "添加文件",
    remove: "移除",
    path: "路径",
    language: "语言",
    editable: "学生可编辑",
    saving: "保存中...",
    save: "保存网页设计练习",
    saved: "网页设计练习已保存。",
    saveError: "暂时无法保存网页设计练习。",
    duplicatePath: "每个文件路径必须唯一。",
    missingFile: "请至少添加一个文件。",
    fileCode: "文件代码",
    solutionCode: "教师参考答案代码",
    starterCode: "学生起始代码",
    editor: "编辑器",
    console: "控制台",
    clearConsole: "清除",
    emptyConsole: "暂无消息",
    fullScreen: "全屏",
    exitFullScreen: "退出全屏",
    testsTitle: "Playwright 测试",
    testsLoadError: "无法加载网页设计测试。",
    testsSaved: "网页设计测试和参考答案已保存。",
    testsSaveError: "暂时无法保存网页设计测试和参考答案。",
    testsSaveValidationError: "保存失败，因为 {count} 个测试未通过。",
    referenceBundle: "参考文件包",
    useCurrentFiles: "使用参考答案文件作为参考",
    addTest: "添加测试",
    saveTests: "保存测试和参考答案",
    noTests: "暂无测试。",
    testName: "测试名称",
    testKind: "类型",
    testCode: "Playwright 测试代码",
    confirmRemoveTest: "删除这个测试吗？",
    setupTab: "设置",
    sample: "示例",
    hidden: "隐藏",
    enabled: "启用",
    weight: "权重",
    runTests: "运行示例测试",
    submit: "提交",
    runningTests: "运行中...",
    submitting: "提交中...",
    result: "结果",
    passed: "通过",
    failed: "失败",
    noRunner: "测试暂不可用。",
    noCourse: "请从课程中打开此练习以运行测试。"
  }
} as const;

export function WebDesignCodingExerciseActivityView({
  activity,
  canManage,
  course,
  onSave,
  locale = "en",
  webDesignClient
}: WebDesignCodingExerciseActivityViewProps) {
  const copy = copyByLocale[locale] ?? copyByLocale.en;
  const notifications = useNotifications();
  const initialConfig = useMemo(() => parseWebDesignExerciseConfig(activity.config), [activity.config]);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [prompt, setPrompt] = useState(initialConfig.prompt);
  const [starterFiles, setStarterFiles] = useState<WebDesignExerciseFile[]>(initialConfig.files);
  const [solutionFiles, setSolutionFiles] = useState<WebDesignExerciseFile[]>(initialConfig.files);
  const [activePath, setActivePath] = useState(initialConfig.files[0]?.path ?? "index.html");
  const [activeSolutionPath, setActiveSolutionPath] = useState(initialConfig.files[0]?.path ?? "index.html");
  const [activeStarterPath, setActiveStarterPath] = useState(initialConfig.files[0]?.path ?? "index.html");
  const [activeAuthoringTab, setActiveAuthoringTab] = useState<"setup" | "solution" | "starter" | "tests">("setup");
  const [saving, setSaving] = useState(false);
  const [validatingTests, setValidatingTests] = useState(false);
  const [error, setError] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [executingKind, setExecutingKind] = useState<"run" | "submit" | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<WebDesignExerciseSubmissionRecord | null>(null);
  const [executionError, setExecutionError] = useState("");
  const [expectedResultImageDataUrl, setExpectedResultImageDataUrl] = useState<string | null>(null);
  const [authoringTests, setAuthoringTests] = useState<WebDesignExerciseTestRecord[]>([]);
  const [authoringTestsLoaded, setAuthoringTestsLoaded] = useState(false);
  const previousActivityIdRef = useRef(activity.id);
  const referencePreloadActivityIdRef = useRef<string | null>(null);
  const solutionDirtyRef = useRef(false);

  const loadReferenceFiles = useCallback((files: readonly WebDesignExerciseFile[], options?: { force?: boolean }) => {
    if (!files.length) {
      return;
    }
    if (solutionDirtyRef.current && !options?.force) {
      return;
    }
    const nextFiles = files.map((file, index) => ({ ...file, orderIndex: index }));
    solutionDirtyRef.current = false;
    setSolutionFiles(nextFiles);
    setStarterFiles((current) => alignStarterFilesToSolutionFiles(current, nextFiles));
    setActiveSolutionPath((current) => (nextFiles.some((file) => file.path === current) ? current : nextFiles[0]?.path ?? "index.html"));
    setActiveStarterPath((current) => (nextFiles.some((file) => file.path === current) ? current : nextFiles[0]?.path ?? "index.html"));
    setActivePath((current) => (nextFiles.some((file) => file.path === current) ? current : nextFiles[0]?.path ?? "index.html"));
  }, []);

  useEffect(() => {
    const isNewActivity = previousActivityIdRef.current !== activity.id;
    previousActivityIdRef.current = activity.id;
    const nextConfig = parseWebDesignExerciseConfig(activity.config);
    setTitle(activity.title);
    setDescription(activity.description);
    setPrompt(nextConfig.prompt);
    setStarterFiles(nextConfig.files);
    setActivePath(nextConfig.files[0]?.path ?? "index.html");
    setActiveStarterPath(nextConfig.files[0]?.path ?? "index.html");
    if (isNewActivity) {
      setSolutionFiles(nextConfig.files);
      setActiveSolutionPath(nextConfig.files[0]?.path ?? "index.html");
      setActiveAuthoringTab("setup");
    }
    if (isNewActivity) {
      setSaving(false);
      setValidatingTests(false);
    }
    setError("");
    setIsFullScreen(false);
    setExecutingKind(null);
    setLatestSubmission(null);
    setExecutionError("");
    setExpectedResultImageDataUrl(null);
    if (isNewActivity) {
      referencePreloadActivityIdRef.current = null;
      solutionDirtyRef.current = false;
      setAuthoringTests([]);
      setAuthoringTestsLoaded(false);
    }
  }, [activity]);

  useEffect(() => {
    if (!canManage || !course?.id || !webDesignClient) {
      return;
    }
    if (referencePreloadActivityIdRef.current === activity.id) {
      return;
    }
    referencePreloadActivityIdRef.current = activity.id;

    let isMounted = true;
    webDesignClient
      .listTests(course.id, activity.id)
      .then((result) => {
        if (isMounted && result.referenceBundle?.files.length) {
          loadReferenceFiles(result.referenceBundle.files);
        }
        if (isMounted) {
          setAuthoringTests(result.tests);
          setAuthoringTestsLoaded(true);
        }
      })
      .catch(() => {
        referencePreloadActivityIdRef.current = null;
        // The tests panel reports load failures; this preload is only for hydrating the solution editor.
      });

    return () => {
      isMounted = false;
    };
  }, [activity.id, canManage, course?.id, loadReferenceFiles, webDesignClient]);

  useEffect(() => {
    if (canManage || !course?.id || !webDesignClient) {
      return;
    }

    let isMounted = true;
    Promise.all([webDesignClient.listSubmissions(course.id, activity.id), webDesignClient.listRuns(course.id, activity.id)])
      .then(([submissionsResult, runsResult]) => {
        if (!isMounted) {
          return;
        }
        setLatestSubmission(submissionsResult.submissions[0] ?? runsResult.submissions[0] ?? null);
      })
      .catch(() => {
        if (isMounted) {
          setLatestSubmission(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activity.id, canManage, course?.id, webDesignClient]);

  useEffect(() => {
    if (!course?.id || !webDesignClient || !webDesignPromptIncludesExpectedResult(prompt)) {
      setExpectedResultImageDataUrl(null);
      return;
    }

    let isMounted = true;
    webDesignClient
      .getExpectedResult(course.id, activity.id)
      .then((result) => {
        if (isMounted) {
          setExpectedResultImageDataUrl(result.imageDataUrl);
        }
      })
      .catch(() => {
        if (isMounted) {
          setExpectedResultImageDataUrl(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activity.id, course?.id, prompt, webDesignClient]);

  useEffect(() => {
    if (!isFullScreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFullScreen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullScreen]);

  const normalizedStarterFiles = useMemo(
    () =>
      starterFiles
        .map((file, index) => ({ ...file, path: normalizeWebDesignFilePath(file.path), orderIndex: index }))
        .sort((left, right) => left.orderIndex - right.orderIndex),
    [starterFiles]
  );
  const normalizedSolutionFiles = useMemo(
    () =>
      solutionFiles
        .map((file, index) => ({ ...file, path: normalizeWebDesignFilePath(file.path), orderIndex: index }))
        .sort((left, right) => left.orderIndex - right.orderIndex),
    [solutionFiles]
  );
  const activeFile = normalizedStarterFiles.find((file) => file.path === activePath) ?? normalizedStarterFiles[0];
  const activeSolutionFile = normalizedSolutionFiles.find((file) => file.path === activeSolutionPath) ?? normalizedSolutionFiles[0];
  const activeStarterFile = normalizedStarterFiles.find((file) => file.path === activeStarterPath) ?? normalizedStarterFiles[0];
  const studentPreviewDocument = useMemo(() => buildWebDesignPreviewDocument(normalizedStarterFiles), [normalizedStarterFiles]);
  const solutionPreviewDocument = useMemo(() => buildWebDesignPreviewDocument(normalizedSolutionFiles), [normalizedSolutionFiles]);
  const validationError = useMemo(
    () => validateFiles(normalizedStarterFiles, copy.duplicatePath, copy.missingFile),
    [copy, normalizedStarterFiles]
  );

  async function saveExercise(event: FormEvent) {
    event.preventDefault();
    const nextConfig: WebDesignExerciseConfig = normalizeWebDesignExerciseConfig({
      prompt,
      files: normalizedStarterFiles,
      previewEntry: normalizedStarterFiles.find((file) => file.language === "html")?.path ?? normalizedStarterFiles[0]?.path ?? "index.html",
      maxEditorSeconds: defaultWebDesignExerciseConfig.maxEditorSeconds
    });

    const nextValidationError = validateFiles(nextConfig.files, copy.duplicatePath, copy.missingFile);
    if (nextValidationError) {
      setError(nextValidationError);
      return;
    }

    setSaving(true);
    setValidatingTests(true);
    setError("");

    try {
      await onSave({
        title,
        description,
        config: nextConfig
      });
      await saveSolutionAndTests();
      notifications.success(copy.saved);
    } catch (err) {
      if (!handleReferenceValidationError(err)) {
        notifications.error(err instanceof Error ? err.message : copy.saveError);
      }
    } finally {
      setSaving(false);
      setValidatingTests(false);
    }
  }

  async function saveSolutionAndTests(testsOverride?: WebDesignExerciseTestRecord[]) {
    if (!course?.id || !webDesignClient) {
      return null;
    }

    const testsToSave = testsOverride ?? (authoringTestsLoaded ? authoringTests : (await webDesignClient.listTests(course.id, activity.id)).tests);
    const result = await webDesignClient.saveTests(course.id, activity.id, {
      shouldCaptureExpectedResult: webDesignPromptIncludesExpectedResult(prompt),
      shouldCropExpectedResult: webDesignPromptRequestsCroppedExpectedResult(prompt),
      referenceFiles: normalizedSolutionFiles,
      tests: testsToSave.map((test) => ({
        id: test.id,
        name: test.name,
        kind: test.kind,
        testCode: test.testCode,
        isEnabled: test.isEnabled,
        weight: test.weight,
        metadata: test.metadata
      }))
    });
    setAuthoringTests(result.tests);
    setAuthoringTestsLoaded(true);
    const savedReferenceFiles = result.referenceBundle?.files.length ? result.referenceBundle.files : normalizedSolutionFiles;
    loadReferenceFiles(savedReferenceFiles, { force: true });
    setExpectedResultImageDataUrl(getExpectedResultImageDataUrl(result.referenceBundle));
    return result;
  }

  function handleReferenceValidationError(err: unknown) {
    const details = normalizeWebDesignObject((err as ApiErrorLike).details);
    const validationSummary = normalizeWebDesignObject(details.validationSummary);
    const testSummaries = normalizeWebDesignObject(validationSummary.testSummaries);
    const failedIds = Object.entries(testSummaries)
      .filter(([, summary]) => getWebDesignValidationStatus(normalizeWebDesignObject(summary)) === "failed")
      .map(([id]) => id);

    if (!Object.keys(testSummaries).length) {
      return false;
    }

    setAuthoringTests((current) =>
      current.map((test) =>
        Object.prototype.hasOwnProperty.call(testSummaries, test.id)
          ? {
              ...test,
              validationSummary: normalizeWebDesignObject(testSummaries[test.id])
            }
          : test
      )
    );
    setActiveAuthoringTab("tests");
    notifications.error(
      failedIds.length
        ? formatWebDesignCopy(copy.testsSaveValidationError, { count: String(failedIds.length) })
        : err instanceof Error
          ? err.message
          : copy.testsSaveError
    );
    return true;
  }

  function updateStudentFile(path: string, patch: Partial<WebDesignExerciseFile>) {
    setStarterFiles((current) =>
      current.map((file) => {
        if (normalizeWebDesignFilePath(file.path) !== path) {
          return file;
        }
        const nextPath = patch.path === undefined ? file.path : normalizeWebDesignFilePath(patch.path);
        return {
          ...file,
          ...patch,
          path: nextPath,
          language: patch.path !== undefined && patch.language === undefined ? inferWebDesignFileLanguage(nextPath) : patch.language ?? file.language
        };
      })
    );

    if (patch.path !== undefined && activePath === path) {
      setActivePath(normalizeWebDesignFilePath(patch.path));
    }
  }

  function updateSolutionFile(path: string, patch: Partial<WebDesignExerciseFile>) {
    solutionDirtyRef.current = true;
    setSolutionFiles((current) =>
      current.map((file) => {
        if (normalizeWebDesignFilePath(file.path) !== path) {
          return file;
        }
        const nextPath = patch.path === undefined ? file.path : normalizeWebDesignFilePath(patch.path);
        return {
          ...file,
          ...patch,
          path: nextPath,
          language: patch.path !== undefined && patch.language === undefined ? inferWebDesignFileLanguage(nextPath) : patch.language ?? file.language
        };
      })
    );

    if (patch.path !== undefined || patch.language !== undefined) {
      setStarterFiles((current) =>
        current.map((file) => {
          if (normalizeWebDesignFilePath(file.path) !== path) {
            return file;
          }
          const nextPath = patch.path === undefined ? file.path : normalizeWebDesignFilePath(patch.path);
          return {
            ...file,
            path: nextPath,
            language: patch.path !== undefined && patch.language === undefined ? inferWebDesignFileLanguage(nextPath) : patch.language ?? file.language
          };
        })
      );
    }

    if (patch.path !== undefined && activeSolutionPath === path) {
      setActiveSolutionPath(normalizeWebDesignFilePath(patch.path));
    }
    if (patch.path !== undefined && activeStarterPath === path) {
      setActiveStarterPath(normalizeWebDesignFilePath(patch.path));
    }
    if (patch.path !== undefined && activePath === path) {
      setActivePath(normalizeWebDesignFilePath(patch.path));
    }
  }

  function updateStarterFile(path: string, patch: Partial<WebDesignExerciseFile>) {
    setStarterFiles((current) =>
      current.map((file) => (normalizeWebDesignFilePath(file.path) === path ? { ...file, ...patch, path: file.path, language: file.language } : file))
    );
  }

  function addFile() {
    solutionDirtyRef.current = true;
    const nextNumber = solutionFiles.length + 1;
    const path = `script-${nextNumber}.js`;
    const language = inferWebDesignFileLanguage(path);
    const orderIndex = solutionFiles.length;
    const solutionFile: WebDesignExerciseFile = {
      id: `solution-file-${Date.now()}`,
      path,
      language,
      starterCode: "",
      isEditable: true,
      orderIndex
    };
    const starterFile: WebDesignExerciseFile = {
      ...solutionFile,
      id: `starter-file-${Date.now()}`,
      isEditable: true
    };

    setSolutionFiles((current) => [...current, solutionFile]);
    setStarterFiles((current) => [...current, starterFile]);
    setActiveSolutionPath(path);
    setActiveStarterPath(path);
  }

  function removeFile(path: string) {
    solutionDirtyRef.current = true;
    setSolutionFiles((current) => {
      const remaining = current.filter((file) => normalizeWebDesignFilePath(file.path) !== path);
      if (activeSolutionPath === path) {
        setActiveSolutionPath(remaining[0]?.path ?? "index.html");
      }
      return remaining;
    });
    setStarterFiles((current) => {
      const remaining = current.filter((file) => normalizeWebDesignFilePath(file.path) !== path);
      if (activeStarterPath === path) {
        setActiveStarterPath(remaining[0]?.path ?? "index.html");
      }
      if (activePath === path) {
        setActivePath(remaining[0]?.path ?? "index.html");
      }
      return remaining;
    });
  }

  async function executeStudentTests(kind: "run" | "submit") {
    if (!course?.id) {
      setExecutionError(copy.noCourse);
      return;
    }

    if (!webDesignClient) {
      setExecutionError(copy.noRunner);
      return;
    }

    setExecutingKind(kind);
    setExecutionError("");
    try {
      const result =
        kind === "run"
          ? await webDesignClient.runCode(course.id, activity.id, { files: normalizedStarterFiles })
          : await webDesignClient.submitCode(course.id, activity.id, { files: normalizedStarterFiles });
      setLatestSubmission(result.submission);
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : copy.noRunner);
    } finally {
      setExecutingKind(null);
    }
  }

  if (canManage) {
    const authoringTabs = [
      { id: "setup", label: copy.setupTab },
      { id: "solution", label: copy.solutionFiles },
      { id: "starter", label: copy.starterFiles },
      { id: "tests", label: copy.testsTitle }
    ] as const;

    return (
      <form className="section stack" onSubmit={saveExercise}>
        <div className="stack">
          <h2>{copy.authoringTitle}</h2>
        </div>

        <div className="row" role="tablist" aria-label={copy.authoringTitle} style={{ gap: 8 }}>
          {authoringTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeAuthoringTab === tab.id}
              className={activeAuthoringTab === tab.id ? undefined : "secondary"}
              onClick={() => setActiveAuthoringTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeAuthoringTab === "setup" ? (
          <section className="stack" role="tabpanel">
            <div className="field">
              <label htmlFor="web-design-title">{copy.title}</label>
              <input id="web-design-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="web-design-description">{copy.description}</label>
              <textarea id="web-design-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="web-design-prompt">{copy.prompt}</label>
              <textarea id="web-design-prompt" rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </div>
          </section>
        ) : null}

        {activeAuthoringTab === "solution" ? (
          <section className="stack" role="tabpanel">
            <AuthoringFileTabs
              activeFile={activeSolutionFile}
              activePath={activeSolutionPath}
              codeLabel={copy.solutionCode}
              copy={copy}
              editorIdPrefix="web-design-solution"
              files={normalizedSolutionFiles}
              heading={copy.solutionFiles}
              onActivePathChange={setActiveSolutionPath}
              onAddFile={addFile}
              onRemoveFile={removeFile}
              onUpdateFile={updateSolutionFile}
              showFileSettings
            />

            <section className="stack">
              <h3 style={{ margin: 0 }}>{copy.previewSolution}</h3>
              <PreviewPane copy={copy} previewDocument={solutionPreviewDocument} />
              <ExpectedResultImage copy={copy} imageDataUrl={expectedResultImageDataUrl} prompt={prompt} />
            </section>
          </section>
        ) : null}

        {activeAuthoringTab === "starter" ? (
          <section className="stack" role="tabpanel">
            <AuthoringFileTabs
              activeFile={activeStarterFile}
              activePath={activeStarterPath}
              codeLabel={copy.starterCode}
              copy={copy}
              editorIdPrefix="web-design-starter"
              files={normalizedStarterFiles}
              heading={copy.starterFiles}
              onActivePathChange={setActiveStarterPath}
              onUpdateFile={updateStarterFile}
              showEditableToggle
            />

            {error || validationError ? <p className="error">{error || validationError}</p> : null}
          </section>
        ) : null}

        {activeAuthoringTab === "tests" ? (
          <WebDesignTestsPanel
            activityId={activity.id}
            copy={copy}
            courseId={course?.id ?? ""}
            currentFiles={normalizedSolutionFiles}
            onReferenceFilesLoad={loadReferenceFiles}
            onTestsChange={(tests) => {
              setAuthoringTests(tests);
              setAuthoringTestsLoaded(true);
            }}
            saving={validatingTests}
            tests={authoringTests}
            testsLoaded={authoringTestsLoaded}
            webDesignClient={webDesignClient}
          />
        ) : null}

        <div className="row">
          <button type="submit" disabled={saving || Boolean(validationError)}>
            {saving ? copy.saving : copy.save}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <section className="section stack">
        {prompt ? <ExpectedResultPrompt imageDataUrl={expectedResultImageDataUrl} markdown={prompt} /> : null}
        <StudentWorkspace
          activeFile={activeFile}
          activePath={activePath}
          copy={copy}
          files={normalizedStarterFiles}
          executionError={executionError}
          executingKind={executingKind}
          latestSubmission={latestSubmission}
          onActivePathChange={setActivePath}
          onEnterFullScreen={() => setIsFullScreen(true)}
          onExitFullScreen={() => setIsFullScreen(false)}
          onRunTests={() => executeStudentTests("run")}
          onSubmit={() => executeStudentTests("submit")}
          onUpdateFile={updateStudentFile}
          previewDocument={studentPreviewDocument}
          testsAvailable={Boolean(course?.id && webDesignClient)}
        />
      </section>

      {isFullScreen ? (
        <div
          style={{
            background: "#f8fbff",
            inset: 0,
            overflow: "hidden",
            padding: 16,
            position: "fixed",
            zIndex: 1000
          }}
        >
          <StudentWorkspace
            activeFile={activeFile}
            activePath={activePath}
            copy={copy}
            files={normalizedStarterFiles}
            executionError={executionError}
            executingKind={executingKind}
            fullScreen
            latestSubmission={latestSubmission}
            onActivePathChange={setActivePath}
            onEnterFullScreen={() => setIsFullScreen(true)}
            onExitFullScreen={() => setIsFullScreen(false)}
            onRunTests={() => executeStudentTests("run")}
            onSubmit={() => executeStudentTests("submit")}
            onUpdateFile={updateStudentFile}
            previewDocument={studentPreviewDocument}
            testsAvailable={Boolean(course?.id && webDesignClient)}
          />
        </div>
      ) : null}
    </>
  );
}

function AuthoringFileTabs({
  activeFile,
  activePath,
  codeLabel,
  copy,
  editorIdPrefix,
  files,
  heading,
  onActivePathChange,
  onAddFile,
  onRemoveFile,
  onUpdateFile,
  showEditableToggle = false,
  showFileSettings = false
}: {
  activeFile: WebDesignExerciseFile | undefined;
  activePath: string;
  codeLabel: string;
  copy: StudentWorkspaceCopy;
  editorIdPrefix: string;
  files: readonly WebDesignExerciseFile[];
  heading: string;
  onActivePathChange: (path: string) => void;
  onAddFile?: () => void;
  onRemoveFile?: (path: string) => void;
  onUpdateFile: (path: string, patch: Partial<WebDesignExerciseFile>) => void;
  showEditableToggle?: boolean;
  showFileSettings?: boolean;
}) {
  return (
    <section className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.12)", borderRadius: 8, padding: 14 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{heading}</h3>
        {onAddFile ? (
          <button type="button" className="secondary" onClick={onAddFile}>
            {copy.addFile}
          </button>
        ) : null}
      </div>

      <div className="row" role="tablist" aria-label={heading} style={{ gap: 8 }}>
        {files.map((file) => (
          <button
            key={file.id}
            type="button"
            role="tab"
            aria-selected={file.path === activePath}
            className={file.path === activePath ? undefined : "secondary"}
            onClick={() => onActivePathChange(file.path)}
            style={{ minWidth: 0 }}
          >
            {file.path}
          </button>
        ))}
      </div>

      {activeFile ? (
        <>
          {showFileSettings ? (
            <div className="row" style={{ alignItems: "end" }}>
              <div className="field" style={{ flex: "1 1 220px" }}>
                <label htmlFor={`${editorIdPrefix}-path-${activeFile.id}`}>{copy.path}</label>
                <input
                  id={`${editorIdPrefix}-path-${activeFile.id}`}
                  value={activeFile.path}
                  onChange={(event) => onUpdateFile(activeFile.path, { path: event.target.value })}
                />
              </div>
              <div className="field" style={{ flex: "0 1 180px" }}>
                <label htmlFor={`${editorIdPrefix}-language-${activeFile.id}`}>{copy.language}</label>
                <select
                  id={`${editorIdPrefix}-language-${activeFile.id}`}
                  value={activeFile.language}
                  onChange={(event) => onUpdateFile(activeFile.path, { language: event.target.value as WebDesignFileLanguage })}
                >
                  {fileLanguageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {onRemoveFile ? (
                <button type="button" className="secondary" onClick={() => onRemoveFile(activeFile.path)} disabled={files.length <= 1}>
                  {copy.remove}
                </button>
              ) : null}
            </div>
          ) : null}

          {showEditableToggle ? (
            <label className="checkbox-row" style={{ alignSelf: "start", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={activeFile.isEditable}
                onChange={(event) => onUpdateFile(activeFile.path, { isEditable: event.target.checked })}
              />
              {copy.editable}
            </label>
          ) : null}

          <div className="stack">
            <span>{codeLabel}</span>
            <MonacoCodeEditor
              id={`${editorIdPrefix}-${activeFile.id}`}
              value={activeFile.starterCode}
              onChange={(value) => onUpdateFile(activeFile.path, { starterCode: value })}
              language={activeFile.language}
              minHeight={260}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function ExpectedResultPrompt({ imageDataUrl, markdown }: { imageDataUrl: string | null; markdown: string }) {
  if (!webDesignPromptIncludesExpectedResult(markdown)) {
    return <MarkdownRenderer markdown={markdown} />;
  }

  const parts = markdown.split(webDesignExpectedResultTokenPattern);
  return (
    <div className="stack">
      {parts.map((part, index) => (
        <div key={`${index}-${part.slice(0, 12)}`} className="stack">
          {part.trim() ? <MarkdownRenderer markdown={part} /> : null}
          {index < parts.length - 1 && imageDataUrl ? (
            <img
              alt="Expected result"
              src={imageDataUrl}
              style={{
                border: "1px solid rgba(13, 27, 71, 0.12)",
                borderRadius: 8,
                display: "block",
                height: "auto",
                maxWidth: "100%"
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ExpectedResultImage({ copy, imageDataUrl, prompt }: { copy: StudentWorkspaceCopy; imageDataUrl: string | null; prompt: string }) {
  if (!webDesignPromptIncludesExpectedResult(prompt) || !imageDataUrl) {
    return null;
  }

  return (
    <section className="stack" style={{ gap: 8 }}>
      <h3 style={{ margin: 0 }}>{copy.expectedResult}</h3>
      <img
        alt={copy.expectedResult}
        src={imageDataUrl}
        style={{
          border: "1px solid rgba(13, 27, 71, 0.12)",
          borderRadius: 8,
          display: "block",
          height: "auto",
          maxWidth: "100%"
        }}
      />
    </section>
  );
}

function StudentWorkspace({
  activeFile,
  activePath,
  copy,
  executionError,
  executingKind,
  files,
  fullScreen = false,
  latestSubmission,
  onActivePathChange,
  onEnterFullScreen,
  onExitFullScreen,
  onRunTests,
  onSubmit,
  onUpdateFile,
  previewDocument,
  testsAvailable
}: {
  activeFile: WebDesignExerciseFile | undefined;
  activePath: string;
  copy: StudentWorkspaceCopy;
  executionError: string;
  executingKind: "run" | "submit" | null;
  files: readonly WebDesignExerciseFile[];
  fullScreen?: boolean;
  latestSubmission: WebDesignExerciseSubmissionRecord | null;
  onActivePathChange: (path: string) => void;
  onEnterFullScreen: () => void;
  onExitFullScreen: () => void;
  onRunTests: () => void;
  onSubmit: () => void;
  onUpdateFile: (path: string, patch: Partial<WebDesignExerciseFile>) => void;
  previewDocument: string;
  testsAvailable: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateRows: "auto auto minmax(0, 1fr)",
        height: fullScreen ? "100%" : undefined,
        minHeight: fullScreen ? 0 : undefined
      }}
    >
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <button type="button" className="secondary" onClick={onRunTests} disabled={!testsAvailable || executingKind !== null}>
            {executingKind === "run" ? copy.runningTests : copy.runTests}
          </button>
          <button type="button" onClick={onSubmit} disabled={!testsAvailable || executingKind !== null}>
            {executingKind === "submit" ? copy.submitting : copy.submit}
          </button>
        </div>
        <button type="button" className="secondary" onClick={fullScreen ? onExitFullScreen : onEnterFullScreen}>
          {fullScreen ? copy.exitFullScreen : copy.fullScreen}
        </button>
      </div>

      <StudentTestResultPanel copy={copy} error={executionError} submission={latestSubmission} />

      <div
        style={{
          alignItems: "stretch",
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          height: fullScreen ? "100%" : undefined,
          minHeight: fullScreen ? 0 : undefined
        }}
      >
        <div
          style={{
            alignContent: "stretch",
            display: "grid",
            gap: 16,
            gridTemplateRows: "auto minmax(0, 1fr)",
            height: "100%",
            minHeight: 0,
            minWidth: 0
          }}
        >
          <div className="row" role="tablist" aria-label={copy.files} style={{ alignSelf: "start", gap: 8 }}>
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                role="tab"
                aria-selected={file.path === activePath}
                className={file.path === activePath ? undefined : "secondary"}
                onClick={() => onActivePathChange(file.path)}
                style={{ minWidth: 0 }}
              >
                {file.path}
              </button>
            ))}
          </div>

          {activeFile ? (
            <MonacoCodeEditor
              id={`web-design-student-${fullScreen ? "full-" : ""}${activeFile.id}`}
              value={activeFile.starterCode}
              onChange={(value) => onUpdateFile(activeFile.path, { starterCode: value })}
              language={activeFile.language}
              height="100%"
              minHeight={0}
              ariaLabel={`${copy.editor}: ${activeFile.path}`}
              readOnly={!activeFile.isEditable}
            />
          ) : null}
        </div>

        <PreviewPane copy={copy} previewDocument={previewDocument} showConsole fillHeight={fullScreen} />
      </div>
    </div>
  );
}

function StudentTestResultPanel({
  copy,
  error,
  submission
}: {
  copy: StudentWorkspaceCopy;
  error: string;
  submission: WebDesignExerciseSubmissionRecord | null;
}) {
  if (!error && !submission) {
    return null;
  }

  return (
    <section
      className="stack"
      style={{
        border: "1px solid rgba(13, 27, 71, 0.12)",
        borderRadius: 8,
        gap: 8,
        padding: 12
      }}
    >
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{copy.result}</h3>
        {submission ? (
          <strong style={{ color: submission.status === "completed" ? "#166534" : "#b42318" }}>
            {submission.score ?? 0}/{submission.maxScore ?? 0}
          </strong>
        ) : null}
      </div>
      {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
      {submission?.message ? <p className="muted" style={{ margin: 0 }}>{submission.message}</p> : null}
      {submission?.testResults.length ? (
        <div className="stack" style={{ gap: 6 }}>
          {submission.testResults.map((result) => (
            <div
              key={result.id}
              className="row"
              style={{
                alignItems: "center",
                borderTop: "1px solid rgba(13, 27, 71, 0.08)",
                justifyContent: "space-between",
                paddingTop: 6
              }}
            >
              <span>{result.name}</span>
              <span style={{ color: result.status === "completed" ? "#166534" : "#b42318", fontWeight: 700 }}>
                {result.status === "completed" ? copy.passed : copy.failed}
                {result.message ? `: ${result.message}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function WebDesignTestsPanel({
  activityId,
  copy,
  courseId,
  currentFiles,
  onReferenceFilesLoad,
  onTestsChange,
  saving,
  tests,
  testsLoaded,
  webDesignClient
}: {
  activityId: string;
  copy: StudentWorkspaceCopy;
  courseId: string;
  currentFiles: readonly WebDesignExerciseFile[];
  onReferenceFilesLoad?: (files: readonly WebDesignExerciseFile[], options?: { force?: boolean }) => void;
  onTestsChange: (tests: WebDesignExerciseTestRecord[]) => void;
  saving: boolean;
  tests: WebDesignExerciseTestRecord[];
  testsLoaded: boolean;
  webDesignClient?: WebDesignExerciseClient;
}) {
  const notifications = useNotifications();
  const [referenceFiles, setReferenceFiles] = useState<WebDesignExerciseFile[]>(() => currentFiles.map((file) => ({ ...file })));
  const [expandedTestIds, setExpandedTestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedTestsActivityIdRef = useRef<string | null>(null);

  function setTests(updater: WebDesignExerciseTestRecord[] | ((current: WebDesignExerciseTestRecord[]) => WebDesignExerciseTestRecord[])) {
    onTestsChange(typeof updater === "function" ? updater(tests) : updater);
  }

  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("web-design-spinner-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "web-design-spinner-style";
    style.textContent = "@keyframes web-design-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  useEffect(() => {
    const failedIds = tests
      .filter((test) => getWebDesignValidationStatus(test.validationSummary) === "failed")
      .map((test) => test.id);
    if (failedIds.length) {
      setExpandedTestIds((current) => Array.from(new Set([...current, ...failedIds])));
    }
  }, [tests]);

  useEffect(() => {
    if (!courseId || !webDesignClient) {
      loadedTestsActivityIdRef.current = null;
      setReferenceFiles(currentFiles.map((file) => ({ ...file })));
      return;
    }
    if (loadedTestsActivityIdRef.current === activityId) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    webDesignClient
      .listTests(courseId, activityId)
      .then((result) => {
        if (!isMounted) {
          return;
        }
        loadedTestsActivityIdRef.current = activityId;
        onTestsChange(result.tests);
        const nextReferenceFiles = result.referenceBundle?.files.length ? result.referenceBundle.files : currentFiles.map((file) => ({ ...file }));
        setReferenceFiles(nextReferenceFiles);
        onReferenceFilesLoad?.(nextReferenceFiles);
      })
      .catch((err) => {
        loadedTestsActivityIdRef.current = null;
        if (isMounted) {
          notifications.error(err instanceof Error ? err.message : copy.testsLoadError);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activityId, copy.testsLoadError, courseId, notifications, onReferenceFilesLoad, onTestsChange, webDesignClient]);

  function addTest(kind: WebDesignExerciseTestKind) {
    const id = `web-test-${Date.now()}`;
    const count = tests.filter((test) => test.kind === kind).length;
    setTests((current) => [
      ...current,
      {
        id,
        name: `${kind === "sample" ? copy.sample : copy.hidden} ${count + 1}`,
        kind,
        testCode: 'await expect(page.locator("body")).toBeVisible();',
        isEnabled: true,
        weight: 1,
        orderIndex: current.length,
        metadata: {},
        validationSummary: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);
    setExpandedTestIds((current) => [...current, id]);
  }

  function updateTest(testId: string, patch: Partial<WebDesignExerciseTestRecord>) {
    setTests((current) => current.map((test) => (test.id === testId ? { ...test, ...patch } : test)));
    if (patch.id && patch.id !== testId) {
      setExpandedTestIds((current) => current.map((id) => (id === testId ? patch.id as string : id)));
    }
  }

  function removeTest(testId: string) {
    if (!window.confirm(copy.confirmRemoveTest)) {
      return;
    }

    setTests((current) => current.filter((test) => test.id !== testId));
    setExpandedTestIds((current) => current.filter((id) => id !== testId));
  }

  function toggleTest(testId: string) {
    setExpandedTestIds((current) => (current.includes(testId) ? current.filter((id) => id !== testId) : [...current, testId]));
  }

  return (
    <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{copy.testsTitle}</h3>
        <button
          type="button"
          className="secondary icon-button"
          onClick={() => setReferenceFiles(currentFiles.map((file) => ({ ...file })))}
          title={copy.useCurrentFiles}
          aria-label={copy.useCurrentFiles}
        >
          <WebDesignActionIcon name="reference" />
        </button>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        {copy.referenceBundle}: {referenceFiles.map((file) => file.path).join(", ")}
      </p>

      <WebDesignTestSection
        copy={copy}
        expandedTestIds={expandedTestIds}
        kind="sample"
        saving={saving}
        onAddTest={() => addTest("sample")}
        onRemoveTest={removeTest}
        onToggleTest={toggleTest}
        onUpdateTest={updateTest}
        tests={tests.filter((test) => test.kind === "sample")}
      />

      <WebDesignTestSection
        copy={copy}
        expandedTestIds={expandedTestIds}
        kind="hidden"
        saving={saving}
        onAddTest={() => addTest("hidden")}
        onRemoveTest={removeTest}
        onToggleTest={toggleTest}
        onUpdateTest={updateTest}
        tests={tests.filter((test) => test.kind === "hidden")}
      />

      {!tests.length ? (
        <p className="muted" style={{ margin: 0 }}>
          {loading || !testsLoaded ? copy.saving : copy.noTests}
        </p>
      ) : null}
    </section>
  );
}

function WebDesignTestSection({
  copy,
  expandedTestIds,
  kind,
  saving,
  onAddTest,
  onRemoveTest,
  onToggleTest,
  onUpdateTest,
  tests
}: {
  copy: StudentWorkspaceCopy;
  expandedTestIds: string[];
  kind: WebDesignExerciseTestKind;
  saving: boolean;
  onAddTest: () => void;
  onRemoveTest: (testId: string) => void;
  onToggleTest: (testId: string) => void;
  onUpdateTest: (testId: string, patch: Partial<WebDesignExerciseTestRecord>) => void;
  tests: WebDesignExerciseTestRecord[];
}) {
  return (
    <section className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h4 style={{ margin: 0 }}>{kind === "sample" ? copy.sample : copy.hidden}</h4>
        <button type="button" className="secondary icon-button" onClick={onAddTest} title={copy.addTest} aria-label={copy.addTest}>
          <WebDesignActionIcon name="add" />
        </button>
      </div>

      {tests.map((test) => (
        <section key={test.id} className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.12)", borderRadius: 8, padding: 14 }}>
          <button type="button" onClick={() => onToggleTest(test.id)} style={webDesignCollapsibleHeaderStyle}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span>{expandedTestIds.includes(test.id) ? "▾" : "▸"}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{test.name || test.id}</span>
            </span>
            <WebDesignValidationBadge copy={copy} loading={saving && test.isEnabled} summary={test.validationSummary} />
          </button>

          {expandedTestIds.includes(test.id) ? (
            <>
              <div className="row" style={{ alignItems: "end" }}>
                <div className="field" style={{ flex: "1 1 220px" }}>
                  <label htmlFor={`web-design-test-name-${test.id}`}>{copy.testName}</label>
                  <input
                    id={`web-design-test-name-${test.id}`}
                    value={test.name}
                    onChange={(event) => onUpdateTest(test.id, { name: event.target.value })}
                  />
                </div>
                <div className="field" style={{ flex: "0 1 110px" }}>
                  <label htmlFor={`web-design-test-weight-${test.id}`}>{copy.weight}</label>
                  <input
                    id={`web-design-test-weight-${test.id}`}
                    min={0}
                    type="number"
                    value={test.weight}
                    onChange={(event) => onUpdateTest(test.id, { weight: Number(event.target.value) || 0 })}
                  />
                </div>
                <label className="row" style={{ gap: 8, minHeight: 42 }}>
                  <input type="checkbox" checked={test.isEnabled} onChange={(event) => onUpdateTest(test.id, { isEnabled: event.target.checked })} />
                  {copy.enabled}
                </label>
                <button type="button" className="danger icon-button" onClick={() => onRemoveTest(test.id)} title={copy.remove} aria-label={copy.remove}>
                  <WebDesignActionIcon name="remove" />
                </button>
              </div>
              <div className="stack">
                <span>{copy.testCode}</span>
                <MonacoCodeEditor
                  id={`web-design-test-code-${test.id}`}
                  value={test.testCode}
                  onChange={(value) => onUpdateTest(test.id, { testCode: value })}
                  language="javascript"
                  minHeight={220}
                />
              </div>
              <WebDesignValidationDetails summary={test.validationSummary} />
            </>
          ) : null}
        </section>
      ))}
    </section>
  );
}

function WebDesignValidationBadge({
  copy,
  loading,
  summary
}: {
  copy: StudentWorkspaceCopy;
  loading: boolean;
  summary: Record<string, unknown>;
}) {
  const status = getWebDesignValidationStatus(summary);
  if (loading) {
    return (
      <span className="muted" style={{ fontSize: 13 }}>
        <WebDesignActionIcon name="spinner" />
      </span>
    );
  }

  if (status === "passed") {
    return (
      <span aria-label={copy.passed} style={{ color: "#157347", fontWeight: 800 }}>
        ✓
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span aria-label={copy.failed} style={{ color: "#b42318", fontWeight: 800 }}>
        ✕
      </span>
    );
  }

  if (status === "skipped") {
    return (
      <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
        -
      </span>
    );
  }

  return (
    <span className="muted" style={{ fontSize: 13 }}>
      -
    </span>
  );
}

function WebDesignValidationDetails({ summary }: { summary: Record<string, unknown> }) {
  if (getWebDesignValidationStatus(summary) !== "failed") {
    return null;
  }

  const message = typeof summary.message === "string" ? summary.message : "";
  const durationMs = typeof summary.durationMs === "number" ? summary.durationMs : null;

  if (!message && durationMs === null) {
    return null;
  }

  return (
    <section
      className="stack"
      style={{
        background: "rgba(186, 26, 26, 0.05)",
        border: "1px solid rgba(186, 26, 26, 0.18)",
        borderRadius: 10,
        padding: 12
      }}
    >
      <strong style={{ color: "#8f1d1d" }}>{message || "Reference validation failed."}</strong>
      {durationMs !== null ? (
        <span className="muted" style={{ fontSize: 13 }}>
          {durationMs}ms
        </span>
      ) : null}
    </section>
  );
}

function getWebDesignValidationStatus(summary: Record<string, unknown>) {
  const status = typeof summary.status === "string" ? summary.status : "";
  const score = typeof summary.score === "number" ? summary.score : null;
  const maxScore = typeof summary.maxScore === "number" ? summary.maxScore : null;
  const message = typeof summary.message === "string" ? summary.message : "";

  if (status === "failed" || (maxScore !== null && score !== null && score < maxScore)) {
    return "failed";
  }
  if (status === "completed" && (maxScore === null || score === null || score >= maxScore) && !message) {
    return "passed";
  }
  if (status === "skipped") {
    return "skipped";
  }
  return "";
}

function normalizeWebDesignObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getExpectedResultImageDataUrl(referenceBundle: WebDesignExerciseReferenceBundleRecord | null | undefined) {
  const validationSummary = normalizeWebDesignObject(referenceBundle?.validationSummary);
  const expectedResult = normalizeWebDesignObject(validationSummary.expectedResult);
  return typeof expectedResult.imageDataUrl === "string" ? expectedResult.imageDataUrl : null;
}

function WebDesignActionIcon({ name }: { name: "add" | "reference" | "remove" | "save" | "spinner" }) {
  if (name === "spinner") {
    return (
      <span
        aria-hidden="true"
        style={{
          animation: "web-design-spin 0.8s linear infinite",
          border: "2px solid currentColor",
          borderRightColor: "transparent",
          borderRadius: "999px",
          display: "inline-block",
          height: 16,
          width: 16
        }}
      />
    );
  }

  const paths = {
    add: "M12 5v14M5 12h14",
    reference: "M4 4h16v12H7l-3 3V4z",
    remove: "M6 6l12 12M18 6L6 18",
    save: "M5 5h14v14H5zM8 5v5h8M8 16h8"
  } satisfies Record<Exclude<typeof name, "spinner">, string>;

  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d={paths[name]} />
    </svg>
  );
}

const webDesignCollapsibleHeaderStyle: CSSProperties = {
  alignItems: "center",
  background: "transparent",
  border: 0,
  color: "inherit",
  cursor: "pointer",
  display: "flex",
  font: "inherit",
  justifyContent: "space-between",
  padding: 0,
  textAlign: "left",
  width: "100%"
};

function PreviewPane({
  copy,
  previewDocument,
  fillHeight = false,
  showConsole = false
}: {
  copy: PreviewPaneCopy;
  fillHeight?: boolean;
  previewDocument: string;
  showConsole?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [messages, setMessages] = useState<PreviewConsoleMessage[]>([]);

  useEffect(() => {
    setMessages([]);
  }, [previewDocument]);

  useEffect(() => {
    if (!showConsole) {
      return;
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow || !isPreviewConsolePayload(event.data)) {
        return;
      }

      setMessages((current) =>
        [
          ...current,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            level: event.data.level,
            values: event.data.values
          }
        ].slice(-80)
      );
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [showConsole]);

  return (
    <section
      style={{
        display: "grid",
        gap: 16,
        gridTemplateRows: showConsole ? "auto minmax(0, 1fr) auto" : "auto minmax(0, 1fr)",
        height: fillHeight ? "100%" : undefined,
        minHeight: 0,
        minWidth: 0
      }}
    >
      <h3 style={{ margin: 0 }}>{copy.preview}</h3>
      <iframe
        ref={iframeRef}
        title={copy.preview}
        sandbox="allow-modals allow-scripts"
        srcDoc={previewDocument}
        style={{
          height: fillHeight ? "100%" : undefined,
          width: "100%",
          minHeight: fillHeight ? 0 : 560,
          border: "1px solid rgba(13, 27, 71, 0.14)",
          borderRadius: 8,
          background: "white"
        }}
      />
      {showConsole ? (
        <section className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <h4 style={{ margin: 0 }}>{copy.console}</h4>
            <button type="button" className="secondary" onClick={() => setMessages([])}>
              {copy.clearConsole}
            </button>
          </div>
          <div
            role="log"
            aria-label={copy.console}
            style={{
              background: "#101827",
              border: "1px solid rgba(13, 27, 71, 0.14)",
              borderRadius: 8,
              color: "#e8edf7",
              fontFamily: '"SFMono-Regular", SFMono-Regular, ui-monospace, Menlo, Consolas, monospace',
              fontSize: 13,
              minHeight: 132,
              maxHeight: 150,
              overflow: "auto",
              padding: 12,
              whiteSpace: "pre-wrap"
            }}
          >
            {messages.length ? (
              messages.map((message) => (
                <div key={message.id} style={{ color: consoleLevelColor(message.level), overflowWrap: "anywhere" }}>
                  <span style={{ opacity: 0.76 }}>[{message.level}]</span> {message.values.join(" ")}
                </div>
              ))
            ) : (
              <span style={{ color: "#aab5c8" }}>{copy.emptyConsole}</span>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function isPreviewConsolePayload(value: unknown): value is { type: "cognelo:web-design-console"; level: PreviewConsoleMessage["level"]; values: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    payload.type === "cognelo:web-design-console" &&
    typeof payload.level === "string" &&
    ["debug", "error", "info", "log", "warn"].includes(payload.level) &&
    Array.isArray(payload.values) &&
    payload.values.every((item) => typeof item === "string")
  );
}

function consoleLevelColor(level: PreviewConsoleMessage["level"]) {
  if (level === "error") {
    return "#ffb4ad";
  }
  if (level === "warn") {
    return "#ffd479";
  }
  if (level === "info") {
    return "#93c5fd";
  }
  if (level === "debug") {
    return "#c4b5fd";
  }
  return "#e8edf7";
}

function validateFiles(files: readonly WebDesignExerciseFile[], duplicatePathMessage: string, missingFileMessage: string) {
  if (!files.length) {
    return missingFileMessage;
  }

  const paths = new Set<string>();
  for (const file of files) {
    const path = normalizeWebDesignFilePath(file.path);
    if (paths.has(path)) {
      return duplicatePathMessage;
    }
    paths.add(path);
  }

  return "";
}
