"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ActionIcon, HelpLabel, MonacoCodeEditor, type MonacoEditorMountHandler } from "@cognelo/activity-ui";
import type { CodingBlankAnswers } from "../code-blanks";
import { CodeBlanksEditor } from "./code-blanks-editor";
import { canMarkBlankSelection, projectBlankAuthoring, serializeBlankAuthoring, updateBlankRanges, type AuthoringCodeDocument, type AuthoringBlankRange } from "./code-blanks-authoring-model";
import { formatCodingExercisesMessage, type CodingExercisesLocale } from "./messages";

type EditorController = { sync: (document: AuthoringCodeDocument) => void; mark: () => void; remove: (id: string) => void; dispose: () => void };
type BlankControl = { id: string; label: string; container: HTMLElement };

export function CodeBlanksAuthoring({ template, answers, language, locale, onChange, numberOffset = 0, documentId = "coding-blank-template", history }: {
  template: string; answers: CodingBlankAnswers; language: string; locale: CodingExercisesLocale;
  numberOffset?: number; documentId?: string; history?: Map<number, AuthoringBlankRange[]>;
  onChange: (template: string, answers: CodingBlankAnswers) => void;
}) {
  const t = (key: Parameters<typeof formatCodingExercisesMessage>[1], values?: Record<string, number>) => formatCodingExercisesMessage(locale, key, values);
  const controller = useRef<EditorController | null>(null);
  const [canMark, setCanMark] = useState(false);
  const [controls, setControls] = useState<BlankControl[]>([]);
  const [fallbackSelection, setFallbackSelection] = useState({ start: 0, end: 0 });
  const projection = useMemo(() => {
    try { return projectBlankAuthoring(template, answers); } catch { return null; }
  }, [template, answers]);
  const current = useRef({ projection, onChange, locale, numberOffset });
  current.current = { projection, onChange, locale, numberOffset };

  useEffect(() => {
    if (projection) controller.current?.sync(projection);
  }, [projection, locale, numberOffset]);
  useEffect(() => () => { controller.current?.dispose(); controller.current = null; }, []);

  const mount: MonacoEditorMountHandler = (editor, monaco) => {
    const model = editor.getModel();
    if (!model || !current.current.projection) return;
    let document = current.current.projection;
    let widgets: Parameters<typeof editor.addContentWidget>[0][] = [];
    const decorations = editor.createDecorationsCollection();
    const rangeHistory = history ?? new Map<number, AuthoringBlankRange[]>();
    let disposed = false;

    function selection() {
      const selected = editor.getSelection();
      return selected ? { start: model!.getOffsetAt(selected.getStartPosition()), end: model!.getOffsetAt(selected.getEndPosition()) } : { start: 0, end: 0 };
    }
    function updateSelection() {
      const { start, end } = selection();
      setCanMark(canMarkBlankSelection(document, start, end));
    }
    function sync(next: AuthoringCodeDocument) {
      if (disposed || model!.getValue() !== next.source) return;
      document = next;
      rangeHistory.set(model!.getAlternativeVersionId(), next.ranges.map(range => ({ ...range })));
      if (rangeHistory.size > 1000) rangeHistory.delete(rangeHistory.keys().next().value!);
      decorations.set(next.ranges.map(range => {
        const start = model!.getPositionAt(range.start), end = model!.getPositionAt(range.end);
        return { range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
          options: { inlineClassName: "coding-authoring-blank-highlight",
            after: { content: "   ", cursorStops: monaco.editor.InjectedTextCursorStops.None },
            hoverMessage: { value: formatCodingExercisesMessage(current.current.locale, "codeBlankNumber", { number: next.ranges.indexOf(range) + 1 + current.current.numberOffset }) } } };
      }));
      for (const widget of widgets) editor.removeContentWidget(widget);
      widgets = [];
      const nextControls = next.ranges.map((range, index) => {
        const container = window.document.createElement("div");
        container.className = "coding-authoring-blank-control";
        const widget: Parameters<typeof editor.addContentWidget>[0] = {
          getId: () => `code-blank-${range.id}`,
          getDomNode: () => container,
          getPosition: () => ({ position: model!.getPositionAt(range.end), positionAffinity: monaco.editor.PositionAffinity.Left,
            preference: [monaco.editor.ContentWidgetPositionPreference.EXACT] }),
          allowEditorOverflow: false,
          suppressMouseDown: true
        };
        widgets.push(widget);
        editor.addContentWidget(widget);
        return { id: range.id, label: formatCodingExercisesMessage(current.current.locale, "removeCodeBlank", { number: index + 1 + current.current.numberOffset }), container };
      });
      setControls(nextControls);
      updateSelection();
    }
    function publish(next: AuthoringCodeDocument) {
      sync(next);
      const saved = serializeBlankAuthoring(next);
      current.current.onChange(saved.template, saved.answers);
    }
    const contentListener = editor.onDidChangeModelContent(event => {
      const source = model!.getValue();
      // Discard/load establishes a baseline rather than another authoring write.
      if (source === current.current.projection?.source) { sync(current.current.projection); return; }
      const saved = (event.isUndoing || event.isRedoing) ? rangeHistory.get(model!.getAlternativeVersionId()) : undefined;
      publish({ source, ranges: saved ?? updateBlankRanges(document.ranges, event.changes) });
    });
    const selectionListener = editor.onDidChangeCursorSelection(updateSelection);
    const instance: EditorController = {
      sync,
      mark: () => {
        const { start, end } = selection();
        if (!canMarkBlankSelection(document, start, end)) return;
        const id = `blank_${crypto.randomUUID().replaceAll("-", "")}`;
        publish({ source: model!.getValue(), ranges: [...document.ranges, { id, start, end }].sort((a, b) => a.start - b.start) });
        editor.focus();
      },
      remove: id => { publish({ source: model!.getValue(), ranges: document.ranges.filter(range => range.id !== id) }); editor.focus(); },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        contentListener.dispose(); selectionListener.dispose(); decorations.clear();
        for (const widget of widgets) editor.removeContentWidget(widget);
        if (!history) rangeHistory.clear();
      }
    };
    controller.current?.dispose();
    controller.current = instance;
    editor.onDidDispose(() => { instance.dispose(); if (controller.current === instance) controller.current = null; });
    sync(document);
  };

  // The shared editor retains its plain-text fallback when Monaco is unavailable.
  function editFallback(source: string) {
    if (controller.current || !projection) return;
    let start = 0;
    while (start < projection.source.length && start < source.length && projection.source[start] === source[start]) start++;
    let previousEnd = projection.source.length, nextEnd = source.length;
    while (previousEnd > start && nextEnd > start && projection.source[previousEnd - 1] === source[nextEnd - 1]) { previousEnd--; nextEnd--; }
    const saved = serializeBlankAuthoring({ source, ranges: updateBlankRanges(projection.ranges, [{ rangeOffset: start, rangeLength: previousEnd - start, text: source.slice(start, nextEnd) }]) });
    onChange(saved.template, saved.answers);
  }
  function fallbackAction(id?: string) {
    if (!projection) return;
    if (!id && !canMarkBlankSelection(projection, fallbackSelection.start, fallbackSelection.end)) return;
    const ranges = id ? projection.ranges.filter(range => range.id !== id)
      : [...projection.ranges, { id: `blank_${crypto.randomUUID().replaceAll("-", "")}`, ...fallbackSelection }];
    const saved = serializeBlankAuthoring({ ...projection, ranges });
    onChange(saved.template, saved.answers);
  }
  const fallbackCanMark = !!projection && canMarkBlankSelection(projection, fallbackSelection.start, fallbackSelection.end);

  if (!projection) return <p role="alert">{t("blankTemplateInvalid")}</p>;
  const portals: ReactNode[] = controls.map(control => createPortal(<button type="button" className="secondary coding-authoring-blank-remove"
    aria-label={control.label} title={control.label} onClick={() => controller.current?.remove(control.id)}>
    <ActionIcon name="close" />
  </button>, control.container, control.id));
  return <div className="stack coding-blank-authoring" onSelect={event => {
    if (event.target instanceof HTMLTextAreaElement && !controller.current) setFallbackSelection({ start: event.target.selectionStart, end: event.target.selectionEnd });
  }}>
    <HelpLabel help={t("blankTemplateHelp")}><label>{t("blankTemplate")}</label></HelpLabel>
    <div><button type="button" className="secondary" disabled={!canMark && !fallbackCanMark}
      onClick={() => controller.current ? controller.current.mark() : fallbackAction()}><ActionIcon name="add" />{t("markCodeBlank")}</button></div>
    <MonacoCodeEditor id={documentId} ariaLabel={t("blankTemplate")} value={projection.source}
      onChange={editFallback} onEditorMount={mount} language={language} minHeight={300} autoHeight />
    {portals}
    {!controls.length && projection.ranges.length ? <div className="row">{projection.ranges.map((range, index) => <button
      key={range.id} type="button" className="secondary" onClick={() => fallbackAction(range.id)}>
      <ActionIcon name="close" />{t("removeCodeBlank", { number: index + 1 + numberOffset })}
    </button>)}</div> : null}
    {projection.ranges.length ? <><h3>{t("blankStudentPreview")}</h3>
      <CodeBlanksEditor numberOffset={numberOffset} template={template} answers={{}} onChange={() => undefined} readOnly locale={locale} language={language} />
    </> : null}
  </div>;
}
