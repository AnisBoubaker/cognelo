"use client";
import { useCallback, useEffect, useRef, type ComponentProps } from "react";
import { MonacoCodeEditor, useMonacoModelStore, type MonacoEditorMountHandler } from "@cognelo/activity-ui";
import { buildCodingExerciseStudentTemplateProjectionFromSource } from "../coding-exercises";
import type { CodingSourceFile } from "../coding-files";

/** Register unvisited files too, so language workers can resolve the real project imports. */
export function CodingProjectEditor({ files, ...props }: ComponentProps<typeof MonacoCodeEditor> & { files: CodingSourceFile[] }) {
  const { store } = useMonacoModelStore();
  const mounted = useRef<Parameters<MonacoEditorMountHandler> | null>(null);
  const synchronizeFiles = useCallback<MonacoEditorMountHandler>((editor, monaco) => {
    const active = editor.getModel();
    if (!active) return;
    const directory = active.uri.path.slice(0, active.uri.path.lastIndexOf("/") + 1);
    for (const file of files) {
      const uri = active.uri.with({ path: directory + file.name });
      let model = monaco.editor.getModel(uri);
      const projection = buildCodingExerciseStudentTemplateProjectionFromSource(file.studentTemplateSource ?? "{{ STUDENT_CODE }}");
      const value = `${projection.readOnlyPrefix}${file.sourceCode}${projection.readOnlySuffix}`;
      if (!model) model = monaco.editor.createModel(value, active.getLanguageId(), uri);
      else if (model !== active && model.getValue().replace(/\r\n?/g, "\n") !== value.replace(/\r\n?/g, "\n")) model.setValue(value);
      if (model !== active && model.getLanguageId() !== active.getLanguageId()) monaco.editor.setModelLanguage(model, active.getLanguageId());
      store.remember(model);
    }
    const language = active.getLanguageId();
    if (language === "typescript" || language === "javascript") {
      const resources = files.map(file => active.uri.with({ path: directory + file.name }));
      const worker = language === "typescript" ? monaco.languages.typescript.getTypeScriptWorker() : monaco.languages.typescript.getJavaScriptWorker();
      void worker.then(factory => factory(...resources)).catch(() => undefined);
    }
    for (const model of monaco.editor.getModels()) {
      if (model === active || model.uri.scheme !== active.uri.scheme || model.uri.authority !== active.uri.authority) continue;
      const modelDirectory = model.uri.path.slice(0, model.uri.path.lastIndexOf("/") + 1);
      if (modelDirectory === directory && !files.some(file => model.uri.path === directory + file.name)) model.dispose();
    }
  }, [files, store]);
  useEffect(() => { if (mounted.current) synchronizeFiles(...mounted.current); }, [synchronizeFiles, props.language]);
  return <MonacoCodeEditor {...props} onEditorMount={(editor, monaco) => {
    mounted.current = [editor, monaco];
    synchronizeFiles(editor, monaco);
    props.onEditorMount?.(editor, monaco);
  }} />;
}
