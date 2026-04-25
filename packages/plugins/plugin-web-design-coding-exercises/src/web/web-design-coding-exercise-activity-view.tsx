"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownRenderer, MonacoCodeEditor, useNotifications } from "@cognelo/activity-ui";
import {
  buildWebDesignPreviewDocument,
  defaultWebDesignExerciseConfig,
  inferWebDesignFileLanguage,
  normalizeWebDesignExerciseConfig,
  normalizeWebDesignFilePath,
  parseWebDesignExerciseConfig,
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
      referenceFiles: WebDesignExerciseFile[];
      tests: Array<Omit<WebDesignExerciseTestRecord, "orderIndex" | "createdAt" | "updatedAt" | "validationSummary">>;
    }
  ) => Promise<{ tests: WebDesignExerciseTestRecord[]; referenceBundle: WebDesignExerciseReferenceBundleRecord | null }>;
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
};

type StudentWorkspaceCopy = PreviewPaneCopy & {
  files: string;
  editor: string;
  saving: string;
  remove: string;
  fullScreen: string;
  exitFullScreen: string;
  testsTitle: string;
  testsLoadError: string;
  testsSaved: string;
  testsSaveError: string;
  referenceBundle: string;
  useCurrentFiles: string;
  addTest: string;
  saveTests: string;
  noTests: string;
  testName: string;
  testKind: string;
  testCode: string;
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
};

const fileLanguageOptions: Array<{ value: WebDesignFileLanguage; label: string }> = [
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "javascript", label: "JavaScript" }
];

const copyByLocale = {
  en: {
    authoringTitle: "Web design exercise authoring",
    title: "Title",
    description: "Description",
    prompt: "Prompt",
    files: "Files",
    preview: "Preview",
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
    editor: "Editor",
    console: "Console",
    clearConsole: "Clear",
    emptyConsole: "No messages",
    fullScreen: "Full screen",
    exitFullScreen: "Exit full screen",
    testsTitle: "Playwright tests",
    testsLoadError: "Unable to load web design tests.",
    testsSaved: "Web design tests saved.",
    testsSaveError: "Unable to save web design tests right now.",
    referenceBundle: "Reference bundle",
    useCurrentFiles: "Use current files as reference",
    addTest: "Add test",
    saveTests: "Save tests",
    noTests: "No tests yet.",
    testName: "Test name",
    testKind: "Kind",
    testCode: "Playwright test code",
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
    preview: "Apercu",
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
    editor: "Editeur",
    console: "Console",
    clearConsole: "Effacer",
    emptyConsole: "Aucun message",
    fullScreen: "Plein ecran",
    exitFullScreen: "Quitter le plein ecran",
    testsTitle: "Tests Playwright",
    testsLoadError: "Impossible de charger les tests de conception web.",
    testsSaved: "Les tests de conception web ont ete enregistres.",
    testsSaveError: "Impossible d'enregistrer les tests de conception web pour le moment.",
    referenceBundle: "Ensemble de reference",
    useCurrentFiles: "Utiliser les fichiers actuels comme reference",
    addTest: "Ajouter un test",
    saveTests: "Enregistrer les tests",
    noTests: "Aucun test pour le moment.",
    testName: "Nom du test",
    testKind: "Type",
    testCode: "Code de test Playwright",
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
    preview: "预览",
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
    editor: "编辑器",
    console: "控制台",
    clearConsole: "清除",
    emptyConsole: "暂无消息",
    fullScreen: "全屏",
    exitFullScreen: "退出全屏",
    testsTitle: "Playwright 测试",
    testsLoadError: "无法加载网页设计测试。",
    testsSaved: "网页设计测试已保存。",
    testsSaveError: "暂时无法保存网页设计测试。",
    referenceBundle: "参考文件包",
    useCurrentFiles: "使用当前文件作为参考",
    addTest: "添加测试",
    saveTests: "保存测试",
    noTests: "暂无测试。",
    testName: "测试名称",
    testKind: "类型",
    testCode: "Playwright 测试代码",
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
  const [files, setFiles] = useState<WebDesignExerciseFile[]>(initialConfig.files);
  const [activePath, setActivePath] = useState(initialConfig.files[0]?.path ?? "index.html");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [executingKind, setExecutingKind] = useState<"run" | "submit" | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<WebDesignExerciseSubmissionRecord | null>(null);
  const [executionError, setExecutionError] = useState("");

  useEffect(() => {
    const nextConfig = parseWebDesignExerciseConfig(activity.config);
    setTitle(activity.title);
    setDescription(activity.description);
    setPrompt(nextConfig.prompt);
    setFiles(nextConfig.files);
    setActivePath(nextConfig.files[0]?.path ?? "index.html");
    setSaving(false);
    setError("");
    setIsFullScreen(false);
    setExecutingKind(null);
    setLatestSubmission(null);
    setExecutionError("");
  }, [activity]);

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

  const normalizedFiles = useMemo(
    () =>
      files
        .map((file, index) => ({ ...file, path: normalizeWebDesignFilePath(file.path), orderIndex: index }))
        .sort((left, right) => left.orderIndex - right.orderIndex),
    [files]
  );
  const activeFile = normalizedFiles.find((file) => file.path === activePath) ?? normalizedFiles[0];
  const previewDocument = useMemo(() => buildWebDesignPreviewDocument(normalizedFiles), [normalizedFiles]);
  const validationError = useMemo(() => validateFiles(normalizedFiles, copy.duplicatePath, copy.missingFile), [copy, normalizedFiles]);

  async function saveExercise(event: FormEvent) {
    event.preventDefault();
    const nextConfig: WebDesignExerciseConfig = normalizeWebDesignExerciseConfig({
      prompt,
      files: normalizedFiles,
      previewEntry: normalizedFiles.find((file) => file.language === "html")?.path ?? normalizedFiles[0]?.path ?? "index.html",
      maxEditorSeconds: defaultWebDesignExerciseConfig.maxEditorSeconds
    });

    const nextValidationError = validateFiles(nextConfig.files, copy.duplicatePath, copy.missingFile);
    if (nextValidationError) {
      setError(nextValidationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        title,
        description,
        config: nextConfig
      });
      notifications.success(copy.saved);
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  function updateFile(path: string, patch: Partial<WebDesignExerciseFile>) {
    setFiles((current) =>
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

  function addFile() {
    setFiles((current) => {
      const nextNumber = current.length + 1;
      const path = `script-${nextNumber}.js`;
      return [
        ...current,
        {
          id: `file-${Date.now()}`,
          path,
          language: inferWebDesignFileLanguage(path),
          starterCode: "",
          isEditable: true,
          orderIndex: current.length
        }
      ];
    });
    setActivePath(`script-${files.length + 1}.js`);
  }

  function removeFile(path: string) {
    setFiles((current) => {
      const remaining = current.filter((file) => normalizeWebDesignFilePath(file.path) !== path);
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
          ? await webDesignClient.runCode(course.id, activity.id, { files: normalizedFiles })
          : await webDesignClient.submitCode(course.id, activity.id, { files: normalizedFiles });
      setLatestSubmission(result.submission);
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : copy.noRunner);
    } finally {
      setExecutingKind(null);
    }
  }

  if (canManage) {
    return (
      <form className="section stack" onSubmit={saveExercise}>
        <div className="stack">
          <h2>{copy.authoringTitle}</h2>
        </div>

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

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{copy.files}</h3>
          <button type="button" className="secondary" onClick={addFile}>
            {copy.addFile}
          </button>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          {normalizedFiles.map((file) => (
            <section key={file.id} className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.12)", borderRadius: 8, padding: 14 }}>
              <div className="row" style={{ alignItems: "end" }}>
                <div className="field" style={{ flex: "1 1 220px" }}>
                  <label htmlFor={`web-design-path-${file.id}`}>{copy.path}</label>
                  <input
                    id={`web-design-path-${file.id}`}
                    value={file.path}
                    onChange={(event) => updateFile(file.path, { path: event.target.value })}
                  />
                </div>
                <div className="field" style={{ flex: "0 1 180px" }}>
                  <label htmlFor={`web-design-language-${file.id}`}>{copy.language}</label>
                  <select
                    id={`web-design-language-${file.id}`}
                    value={file.language}
                    onChange={(event) => updateFile(file.path, { language: event.target.value as WebDesignFileLanguage })}
                  >
                    {fileLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="row" style={{ gap: 8, minHeight: 42 }}>
                  <input
                    type="checkbox"
                    checked={file.isEditable}
                    onChange={(event) => updateFile(file.path, { isEditable: event.target.checked })}
                  />
                  {copy.editable}
                </label>
                <button type="button" className="secondary" onClick={() => removeFile(file.path)} disabled={normalizedFiles.length <= 1}>
                  {copy.remove}
                </button>
              </div>
              <div className="stack">
                <span>{copy.fileCode}</span>
                <MonacoCodeEditor
                  id={`web-design-author-${file.id}`}
                  value={file.starterCode}
                  onChange={(value) => updateFile(file.path, { starterCode: value })}
                  language={file.language}
                  minHeight={220}
                />
              </div>
            </section>
          ))}
        </div>

        {error || validationError ? <p className="error">{error || validationError}</p> : null}

        <div className="row">
          <button type="submit" disabled={saving || Boolean(validationError)}>
            {saving ? copy.saving : copy.save}
          </button>
        </div>

        <PreviewPane copy={copy} previewDocument={previewDocument} />

        <WebDesignTestsPanel
          activityId={activity.id}
          copy={copy}
          courseId={course?.id ?? ""}
          currentFiles={normalizedFiles}
          webDesignClient={webDesignClient}
        />
      </form>
    );
  }

  return (
    <>
      <section className="section stack">
        {prompt ? <MarkdownRenderer markdown={prompt} /> : null}
        <StudentWorkspace
          activeFile={activeFile}
          activePath={activePath}
          copy={copy}
          files={normalizedFiles}
          executionError={executionError}
          executingKind={executingKind}
          latestSubmission={latestSubmission}
          onActivePathChange={setActivePath}
          onEnterFullScreen={() => setIsFullScreen(true)}
          onExitFullScreen={() => setIsFullScreen(false)}
          onRunTests={() => executeStudentTests("run")}
          onSubmit={() => executeStudentTests("submit")}
          onUpdateFile={updateFile}
          previewDocument={previewDocument}
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
            files={normalizedFiles}
            executionError={executionError}
            executingKind={executingKind}
            fullScreen
            latestSubmission={latestSubmission}
            onActivePathChange={setActivePath}
            onEnterFullScreen={() => setIsFullScreen(true)}
            onExitFullScreen={() => setIsFullScreen(false)}
            onRunTests={() => executeStudentTests("run")}
            onSubmit={() => executeStudentTests("submit")}
            onUpdateFile={updateFile}
            previewDocument={previewDocument}
            testsAvailable={Boolean(course?.id && webDesignClient)}
          />
        </div>
      ) : null}
    </>
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
  webDesignClient
}: {
  activityId: string;
  copy: StudentWorkspaceCopy;
  courseId: string;
  currentFiles: readonly WebDesignExerciseFile[];
  webDesignClient?: WebDesignExerciseClient;
}) {
  const notifications = useNotifications();
  const [tests, setTests] = useState<WebDesignExerciseTestRecord[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<WebDesignExerciseFile[]>(() => currentFiles.map((file) => ({ ...file })));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!courseId || !webDesignClient) {
      setReferenceFiles(currentFiles.map((file) => ({ ...file })));
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
        setTests(result.tests);
        setReferenceFiles(result.referenceBundle?.files.length ? result.referenceBundle.files : currentFiles.map((file) => ({ ...file })));
      })
      .catch((err) => {
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
  }, [activityId, copy.testsLoadError, courseId, currentFiles, notifications, webDesignClient]);

  async function saveTests() {
    if (!courseId || !webDesignClient) {
      return;
    }

    setSaving(true);
    try {
      const result = await webDesignClient.saveTests(courseId, activityId, {
        referenceFiles,
        tests: tests.map((test) => ({
          id: test.id,
          name: test.name,
          kind: test.kind,
          testCode: test.testCode,
          isEnabled: test.isEnabled,
          weight: test.weight,
          metadata: test.metadata
        }))
      });
      setTests(result.tests);
      setReferenceFiles(result.referenceBundle?.files.length ? result.referenceBundle.files : referenceFiles);
      notifications.success(copy.testsSaved);
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : copy.testsSaveError);
    } finally {
      setSaving(false);
    }
  }

  function addTest() {
    setTests((current) => [
      ...current,
      {
        id: `web-test-${Date.now()}`,
        name: `Test ${current.length + 1}`,
        kind: "hidden",
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
  }

  function updateTest(testId: string, patch: Partial<WebDesignExerciseTestRecord>) {
    setTests((current) => current.map((test) => (test.id === testId ? { ...test, ...patch } : test)));
  }

  function removeTest(testId: string) {
    setTests((current) => current.filter((test) => test.id !== testId));
  }

  return (
    <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{copy.testsTitle}</h3>
        <div className="row">
          <button type="button" className="secondary" onClick={() => setReferenceFiles(currentFiles.map((file) => ({ ...file })))}>
            {copy.useCurrentFiles}
          </button>
          <button type="button" className="secondary" onClick={addTest}>
            {copy.addTest}
          </button>
          <button type="button" onClick={saveTests} disabled={saving || loading || !courseId || !webDesignClient}>
            {saving ? copy.saving : copy.saveTests}
          </button>
        </div>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        {copy.referenceBundle}: {referenceFiles.map((file) => file.path).join(", ")}
      </p>

      {tests.length ? (
        <div className="stack" style={{ gap: 12 }}>
          {tests.map((test) => (
            <section key={test.id} className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.12)", borderRadius: 8, padding: 14 }}>
              <div className="row" style={{ alignItems: "end" }}>
                <div className="field" style={{ flex: "1 1 220px" }}>
                  <label htmlFor={`web-design-test-name-${test.id}`}>{copy.testName}</label>
                  <input
                    id={`web-design-test-name-${test.id}`}
                    value={test.name}
                    onChange={(event) => updateTest(test.id, { name: event.target.value })}
                  />
                </div>
                <div className="field" style={{ flex: "0 1 150px" }}>
                  <label htmlFor={`web-design-test-kind-${test.id}`}>{copy.testKind}</label>
                  <select
                    id={`web-design-test-kind-${test.id}`}
                    value={test.kind}
                    onChange={(event) => updateTest(test.id, { kind: event.target.value as WebDesignExerciseTestKind })}
                  >
                    <option value="sample">{copy.sample}</option>
                    <option value="hidden">{copy.hidden}</option>
                  </select>
                </div>
                <div className="field" style={{ flex: "0 1 110px" }}>
                  <label htmlFor={`web-design-test-weight-${test.id}`}>{copy.weight}</label>
                  <input
                    id={`web-design-test-weight-${test.id}`}
                    min={0}
                    type="number"
                    value={test.weight}
                    onChange={(event) => updateTest(test.id, { weight: Number(event.target.value) || 0 })}
                  />
                </div>
                <label className="row" style={{ gap: 8, minHeight: 42 }}>
                  <input
                    type="checkbox"
                    checked={test.isEnabled}
                    onChange={(event) => updateTest(test.id, { isEnabled: event.target.checked })}
                  />
                  {copy.enabled}
                </label>
                <button type="button" className="secondary" onClick={() => removeTest(test.id)}>
                  {copy.remove}
                </button>
              </div>
              <div className="stack">
                <span>{copy.testCode}</span>
                <MonacoCodeEditor
                  id={`web-design-test-code-${test.id}`}
                  value={test.testCode}
                  onChange={(value) => updateTest(test.id, { testCode: value })}
                  language="javascript"
                  minHeight={220}
                />
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {loading ? copy.saving : copy.noTests}
        </p>
      )}
    </section>
  );
}

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
