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
  type WebDesignFileLanguage
} from "../web-design-coding-exercises";

type ActivityLike = {
  id: string;
  title: string;
  description: string;
  config?: Record<string, unknown>;
};

type WebDesignCodingExerciseActivityViewProps = {
  activity: ActivityLike;
  canManage: boolean;
  onSave: (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<ActivityLike>;
  locale?: "en" | "fr" | "zh";
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
  fullScreen: string;
  exitFullScreen: string;
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
    exitFullScreen: "Exit full screen"
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
    exitFullScreen: "Quitter le plein ecran"
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
    exitFullScreen: "退出全屏"
  }
} as const;

export function WebDesignCodingExerciseActivityView({
  activity,
  canManage,
  onSave,
  locale = "en"
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
  }, [activity]);

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
          onActivePathChange={setActivePath}
          onEnterFullScreen={() => setIsFullScreen(true)}
          onExitFullScreen={() => setIsFullScreen(false)}
          onUpdateFile={updateFile}
          previewDocument={previewDocument}
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
            fullScreen
            onActivePathChange={setActivePath}
            onEnterFullScreen={() => setIsFullScreen(true)}
            onExitFullScreen={() => setIsFullScreen(false)}
            onUpdateFile={updateFile}
            previewDocument={previewDocument}
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
  files,
  fullScreen = false,
  onActivePathChange,
  onEnterFullScreen,
  onExitFullScreen,
  onUpdateFile,
  previewDocument
}: {
  activeFile: WebDesignExerciseFile | undefined;
  activePath: string;
  copy: StudentWorkspaceCopy;
  files: readonly WebDesignExerciseFile[];
  fullScreen?: boolean;
  onActivePathChange: (path: string) => void;
  onEnterFullScreen: () => void;
  onExitFullScreen: () => void;
  onUpdateFile: (path: string, patch: Partial<WebDesignExerciseFile>) => void;
  previewDocument: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateRows: "auto minmax(0, 1fr)",
        height: fullScreen ? "100%" : undefined,
        minHeight: fullScreen ? 0 : undefined
      }}
    >
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="secondary" onClick={fullScreen ? onExitFullScreen : onEnterFullScreen}>
          {fullScreen ? copy.exitFullScreen : copy.fullScreen}
        </button>
      </div>
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
