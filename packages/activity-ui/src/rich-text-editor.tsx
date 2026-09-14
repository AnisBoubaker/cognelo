"use client";

import DOMPurify from "dompurify";
import { type ClipboardEvent, type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { CodeEditor } from "./code-editor";
import { EquationEditorDialog } from "./equation-editor-dialog";
import { renderMarkdownToHtml } from "./markdown";

export type RichTextEditorLocale = "en" | "fr" | "zh" | "ar";

export type RichTextEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  id?: string;
  locale?: RichTextEditorLocale;
  minHeight?: number;
  disabled?: boolean;
  ariaLabel?: string;
};

const editorCopy = {
  en: {
    editorMode: "Editor mode",
    visual: "Visual",
    markdown: "Markdown",
    format: "Text format",
    paragraph: "Paragraph",
    heading2: "Heading 2",
    heading3: "Heading 3",
    blockquote: "Quote",
    preformatted: "Code block",
    bold: "Bold",
    italic: "Italic",
    bulletList: "Bulleted list",
    numberedList: "Numbered list",
    link: "Link",
    unlink: "Remove link",
    linkPrompt: "Enter the link URL",
    equation: "Equation",
    addEquation: "Add equation",
    editEquation: "Edit equation",
    equationHelp: "Build the equation with the visual field, shortcut buttons, or on-screen keyboard.",
    equationInput: "Equation",
    equationStyle: "Equation placement",
    equationInline: "Inline",
    equationDisplay: "On its own line",
    equationShortcuts: "Common structures",
    equationKeyboard: "Math keyboard",
    equationLoading: "Loading equation editor…",
    equationLoadError: "The equation editor could not be loaded.",
    equationRequired: "Enter an equation before continuing.",
    equationIncomplete: "Complete every empty box before continuing.",
    equationCancel: "Cancel",
    equationInsert: "Insert equation",
    equationUpdate: "Update equation",
    equationRemove: "Remove equation",
    equationClose: "Close"
  },
  fr: {
    editorMode: "Mode d'edition",
    visual: "Visuel",
    markdown: "Markdown",
    format: "Format du texte",
    paragraph: "Paragraphe",
    heading2: "Titre 2",
    heading3: "Titre 3",
    blockquote: "Citation",
    preformatted: "Bloc de code",
    bold: "Gras",
    italic: "Italique",
    bulletList: "Liste a puces",
    numberedList: "Liste numerotee",
    link: "Lien",
    unlink: "Supprimer le lien",
    linkPrompt: "Saisissez l'adresse du lien",
    equation: "Équation",
    addEquation: "Ajouter une équation",
    editEquation: "Modifier l'équation",
    equationHelp: "Construisez l'équation avec le champ visuel, les raccourcis ou le clavier à l'écran.",
    equationInput: "Équation",
    equationStyle: "Disposition de l'équation",
    equationInline: "Dans le texte",
    equationDisplay: "Sur sa propre ligne",
    equationShortcuts: "Structures courantes",
    equationKeyboard: "Clavier mathématique",
    equationLoading: "Chargement de l'éditeur d'équations…",
    equationLoadError: "Impossible de charger l'éditeur d'équations.",
    equationRequired: "Saisissez une équation avant de continuer.",
    equationIncomplete: "Remplissez toutes les cases vides avant de continuer.",
    equationCancel: "Annuler",
    equationInsert: "Insérer l'équation",
    equationUpdate: "Mettre à jour l'équation",
    equationRemove: "Supprimer l'équation",
    equationClose: "Fermer"
  },
  zh: {
    editorMode: "编辑器模式",
    visual: "可视化",
    markdown: "Markdown",
    format: "文本格式",
    paragraph: "段落",
    heading2: "二级标题",
    heading3: "三级标题",
    blockquote: "引用",
    preformatted: "代码块",
    bold: "粗体",
    italic: "斜体",
    bulletList: "项目符号列表",
    numberedList: "编号列表",
    link: "链接",
    unlink: "移除链接",
    linkPrompt: "输入链接地址",
    equation: "公式",
    addEquation: "添加公式",
    editEquation: "编辑公式",
    equationHelp: "使用可视化输入框、快捷按钮或屏幕键盘构建公式。",
    equationInput: "公式",
    equationStyle: "公式位置",
    equationInline: "行内",
    equationDisplay: "独立一行",
    equationShortcuts: "常用结构",
    equationKeyboard: "数学键盘",
    equationLoading: "正在加载公式编辑器…",
    equationLoadError: "无法加载公式编辑器。",
    equationRequired: "请先输入公式。",
    equationIncomplete: "请先填写所有空白框。",
    equationCancel: "取消",
    equationInsert: "插入公式",
    equationUpdate: "更新公式",
    equationRemove: "删除公式",
    equationClose: "关闭"
  },
  ar: {
    editorMode: "وضع المحرر",
    visual: "مرئي",
    markdown: "Markdown",
    format: "تنسيق النص",
    paragraph: "فقرة",
    heading2: "عنوان 2",
    heading3: "عنوان 3",
    blockquote: "اقتباس",
    preformatted: "كتلة برمجية",
    bold: "عريض",
    italic: "مائل",
    bulletList: "قائمة نقطية",
    numberedList: "قائمة مرقمة",
    link: "رابط",
    unlink: "إزالة الرابط",
    linkPrompt: "أدخل عنوان الرابط",
    equation: "معادلة",
    addEquation: "إضافة معادلة",
    editEquation: "تعديل المعادلة",
    equationHelp: "أنشئ المعادلة باستخدام الحقل المرئي أو الاختصارات أو لوحة المفاتيح على الشاشة.",
    equationInput: "المعادلة",
    equationStyle: "موضع المعادلة",
    equationInline: "ضمن النص",
    equationDisplay: "في سطر مستقل",
    equationShortcuts: "تراكيب شائعة",
    equationKeyboard: "لوحة مفاتيح الرياضيات",
    equationLoading: "جارٍ تحميل محرر المعادلات…",
    equationLoadError: "تعذر تحميل محرر المعادلات.",
    equationRequired: "أدخل معادلة قبل المتابعة.",
    equationIncomplete: "أكمل جميع الخانات الفارغة قبل المتابعة.",
    equationCancel: "إلغاء",
    equationInsert: "إدراج المعادلة",
    equationUpdate: "تحديث المعادلة",
    equationRemove: "حذف المعادلة",
    equationClose: "إغلاق"
  }
} as const;

type EquationDialogState = {
  displayMode: boolean;
  latex: string;
  mode: "add" | "edit";
  targetIndex: number | null;
};

export function RichTextEditor({
  value,
  onChange,
  id,
  locale = "en",
  minHeight = 180,
  disabled = false,
  ariaLabel
}: RichTextEditorProps) {
  const [mode, setMode] = useState<"visual" | "markdown">("visual");
  const [equationDialog, setEquationDialog] = useState<EquationDialogState | null>(null);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const visualMarkdownRef = useRef<string | null>(null);
  const visualEquationsInteractiveRef = useRef<boolean | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const equationDialogOpeningRef = useRef(false);
  const copy = editorCopy[locale] ?? editorCopy.en;

  useEffect(() => {
    const visualElement = visualRef.current;
    if (!visualElement) {
      return;
    }
    if (visualMarkdownRef.current === value && visualEquationsInteractiveRef.current === !disabled) {
      return;
    }
    selectionRangeRef.current = null;
    renderVisualEditorHtml(visualElement, value, copy.editEquation, !disabled);
    visualMarkdownRef.current = value;
    visualEquationsInteractiveRef.current = !disabled;
  }, [copy.editEquation, disabled, value]);

  function syncVisualValue({ refreshRenderedMath = false }: { refreshRenderedMath?: boolean } = {}) {
    if (!visualRef.current) {
      return;
    }
    const markdown = editorHtmlToMarkdown(visualRef.current);
    visualMarkdownRef.current = markdown;
    onChange(markdown);
    if (refreshRenderedMath) {
      selectionRangeRef.current = null;
      renderVisualEditorHtml(visualRef.current, markdown, copy.editEquation, !disabled);
      visualEquationsInteractiveRef.current = !disabled;
    }
  }

  function runCommand(command: string, commandValue?: string) {
    if (disabled || !visualRef.current) {
      return;
    }
    visualRef.current.focus();
    if (selectionRangeRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRangeRef.current);
    }
    document.execCommand(command, false, commandValue);
    saveSelection();
    syncVisualValue();
  }

  function saveSelection() {
    const editor = visualRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRangeRef.current = range.cloneRange();
    }
  }

  function addLink() {
    if (disabled) {
      return;
    }
    const url = window.prompt(copy.linkPrompt, "https://");
    if (url?.trim()) {
      runCommand("createLink", url.trim());
    }
  }

  function addEquation() {
    if (disabled) {
      return;
    }
    saveSelection();
    equationDialogOpeningRef.current = true;
    setEquationDialog({ displayMode: true, latex: "", mode: "add", targetIndex: null });
  }

  function editEquation(target: HTMLElement) {
    if (disabled) {
      return;
    }
    const source = readProtectedMathSource(target);
    if (source === null) {
      return;
    }
    const displayMode = target.getAttribute("data-markdown-math-display") === "true";
    const targetIndex = visualRef.current
      ? Array.from(visualRef.current.querySelectorAll("[data-markdown-math-source]")).indexOf(target)
      : -1;
    if (targetIndex < 0) {
      return;
    }
    equationDialogOpeningRef.current = true;
    setEquationDialog({ displayMode, latex: extractMathExpression(source, displayMode), mode: "edit", targetIndex });
  }

  function applyEquation({ displayMode, latex }: { displayMode: boolean; latex: string }) {
    const visualElement = visualRef.current;
    if (!visualElement || !equationDialog) {
      return;
    }
    const source = displayMode ? `$$\n${latex}\n$$` : `$${latex}$`;
    const mathElement = createVisualMathElement(source, copy.editEquation);
    if (!mathElement) {
      return;
    }

    const currentTarget = equationDialog.targetIndex === null
      ? null
      : visualElement.querySelectorAll<HTMLElement>("[data-markdown-math-source]")[equationDialog.targetIndex];
    if (equationDialog.mode === "edit") {
      if (!currentTarget) {
        setEquationDialog(null);
        return;
      }
      currentTarget.replaceWith(mathElement);
    } else {
      insertVisualMathElement(visualElement, mathElement, displayMode, selectionRangeRef.current);
    }
    syncVisualValue({ refreshRenderedMath: true });
    setEquationDialog(null);
  }

  function removeEquation() {
    const visualElement = visualRef.current;
    const currentTarget = visualElement && equationDialog?.targetIndex !== null && equationDialog?.targetIndex !== undefined
      ? visualElement.querySelectorAll<HTMLElement>("[data-markdown-math-source]")[equationDialog.targetIndex]
      : null;
    if (!currentTarget) {
      setEquationDialog(null);
      return;
    }
    currentTarget.remove();
    syncVisualValue({ refreshRenderedMath: true });
    setEquationDialog(null);
  }

  function handleVisualClick(event: MouseEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-markdown-math-source]");
    if (target) {
      event.preventDefault();
      editEquation(target);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const clipboardHtml = event.clipboardData.getData("text/html");
    if (clipboardHtml) {
      document.execCommand("insertHTML", false, sanitizePastedEditorHtml(clipboardHtml));
    } else {
      document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    }
    syncVisualValue();
  }

  function handleVisualKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const mathTarget = (event.target as HTMLElement).closest<HTMLElement>("[data-markdown-math-source]");
    if (mathTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      editEquation(mathTarget);
      return;
    }
    if (event.key !== "Enter" || !event.shiftKey || disabled) {
      return;
    }
    event.preventDefault();
    const inserted = document.execCommand("insertLineBreak", false);
    if (!inserted) {
      document.execCommand("insertHTML", false, "<br>");
    }
    saveSelection();
    syncVisualValue();
  }

  return (
    <div className={`rich-text-editor${disabled ? " is-disabled" : ""}`}>
      <div className="rich-text-editor-mode-tabs" role="tablist" aria-label={copy.editorMode}>
        <button
          aria-selected={mode === "visual"}
          className={mode === "visual" ? "is-active" : ""}
          role="tab"
          type="button"
          onClick={() => setMode("visual")}
        >
          {copy.visual}
        </button>
        <button
          aria-selected={mode === "markdown"}
          className={mode === "markdown" ? "is-active" : ""}
          role="tab"
          type="button"
          onClick={() => setMode("markdown")}
        >
          {copy.markdown}
        </button>
      </div>

      <div className="rich-text-editor-visual-panel" hidden={mode !== "visual"} role="tabpanel">
          <div className="rich-text-editor-toolbar" role="toolbar" aria-label={copy.format}>
            <select
              aria-label={copy.format}
              defaultValue="p"
              disabled={disabled}
              onChange={(event) => runCommand("formatBlock", event.target.value)}
            >
              <option value="p">{copy.paragraph}</option>
              <option value="h2">{copy.heading2}</option>
              <option value="h3">{copy.heading3}</option>
              <option value="blockquote">{copy.blockquote}</option>
              <option value="pre">{copy.preformatted}</option>
            </select>
            <button aria-label={copy.bold} title={copy.bold} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}>
              <strong>B</strong>
            </button>
            <button aria-label={copy.italic} title={copy.italic} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")}>
              <em>I</em>
            </button>
            <button aria-label={copy.bulletList} title={copy.bulletList} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertUnorderedList")}>
              • List
            </button>
            <button aria-label={copy.numberedList} title={copy.numberedList} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertOrderedList")}>
              1. List
            </button>
            <button aria-label={copy.link} title={copy.link} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={addLink}>
              🔗
            </button>
            <button aria-label={copy.unlink} title={copy.unlink} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("unlink")}>
              {copy.unlink}
            </button>
            <button aria-label={copy.addEquation} title={copy.addEquation} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={addEquation}>
              <span aria-hidden="true">∑</span> {copy.equation}
            </button>
          </div>
          <div
            id={id}
            ref={visualRef}
            aria-label={ariaLabel}
            aria-multiline="true"
            className="rich-text-editor-visual markdown-renderer"
            contentEditable={!disabled}
            role="textbox"
            style={{ minHeight }}
            suppressContentEditableWarning
            onBlur={() => {
              saveSelection();
              syncVisualValue({ refreshRenderedMath: !equationDialogOpeningRef.current });
              equationDialogOpeningRef.current = false;
            }}
            onInput={() => {
              saveSelection();
              syncVisualValue();
            }}
            onClick={handleVisualClick}
            onKeyDown={handleVisualKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onPaste={handlePaste}
          />
      </div>
      <div className="rich-text-editor-markdown-source" hidden={mode !== "markdown"} role="tabpanel">
        <CodeEditor
          id={id ? `${id}-markdown` : undefined}
          ariaLabel={ariaLabel}
          language="markdown"
          minHeight={minHeight}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
      {equationDialog ? (
        <EquationEditorDialog
          copy={{
            eyebrow: copy.equation,
            addTitle: copy.addEquation,
            editTitle: copy.editEquation,
            help: copy.equationHelp,
            inputLabel: copy.equationInput,
            styleLabel: copy.equationStyle,
            inline: copy.equationInline,
            display: copy.equationDisplay,
            shortcuts: copy.equationShortcuts,
            keyboard: copy.equationKeyboard,
            loading: copy.equationLoading,
            loadError: copy.equationLoadError,
            required: copy.equationRequired,
            incomplete: copy.equationIncomplete,
            cancel: copy.equationCancel,
            insert: copy.equationInsert,
            update: copy.equationUpdate,
            remove: copy.equationRemove,
            close: copy.equationClose
          }}
          displayMode={equationDialog.displayMode}
          initialLatex={equationDialog.latex}
          locale={locale}
          mode={equationDialog.mode}
          onCancel={() => setEquationDialog(null)}
          onConfirm={applyEquation}
          onRemove={equationDialog.mode === "edit" ? removeEquation : undefined}
        />
      ) : null}
    </div>
  );
}

function renderVisualEditorHtml(element: HTMLElement, markdown: string, editEquationLabel: string, equationsInteractive: boolean) {
  element.innerHTML = markdownToEditorHtml(markdown);
  prepareVisualMathWidgets(element, editEquationLabel, equationsInteractive);
}

function prepareVisualMathWidgets(root: ParentNode, editEquationLabel: string, interactive = true) {
  root.querySelectorAll<HTMLElement>("[data-markdown-math-source]").forEach((element) => {
    if (!interactive) {
      element.removeAttribute("aria-label");
      element.removeAttribute("role");
      element.removeAttribute("tabindex");
      element.removeAttribute("title");
      return;
    }
    element.setAttribute("aria-label", editEquationLabel);
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("title", editEquationLabel);
  });
}

function createVisualMathElement(source: string, editEquationLabel: string) {
  const host = document.createElement("div");
  host.innerHTML = markdownToEditorHtml(source);
  const element = host.querySelector<HTMLElement>("[data-markdown-math-source]");
  if (element) {
    prepareVisualMathWidgets(host, editEquationLabel);
  }
  return element;
}

function insertVisualMathElement(root: HTMLElement, element: HTMLElement, displayMode: boolean, savedRange: Range | null) {
  const range = savedRange && root.contains(savedRange.commonAncestorContainer) ? savedRange : null;
  if (!displayMode) {
    if (range) {
      range.deleteContents();
      range.insertNode(element);
      return;
    }
    const paragraph = document.createElement("p");
    paragraph.append(element);
    root.append(paragraph);
    return;
  }

  const directChild = range ? findDirectEditorChild(root, range.commonAncestorContainer) : null;
  if (directChild?.textContent?.trim()) {
    directChild.after(element);
  } else if (directChild) {
    directChild.replaceWith(element);
  } else {
    root.append(element);
  }
  if (!element.nextElementSibling) {
    const trailingParagraph = document.createElement("p");
    trailingParagraph.append(document.createElement("br"));
    element.after(trailingParagraph);
  }
}

function findDirectEditorChild(root: HTMLElement, node: Node) {
  let current = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  while (current?.parentElement && current.parentElement !== root) {
    current = current.parentElement;
  }
  return current?.parentElement === root ? current : null;
}

function extractMathExpression(source: string, displayMode: boolean) {
  if (displayMode && source.startsWith("$$") && source.endsWith("$$")) {
    return source.slice(2, -2).trim();
  }
  if (source.startsWith("\\(") && source.endsWith("\\)")) {
    return source.slice(2, -2).trim();
  }
  if (source.startsWith("$") && source.endsWith("$")) {
    return source.slice(1, -1).trim();
  }
  return source.trim();
}

function markdownToEditorHtml(markdown: string) {
  const html = DOMPurify.sanitize(renderMarkdownToHtml(markdown, { protectMath: true }), {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    ADD_ATTR: ["contenteditable", "data-markdown-math-display", "data-markdown-math-source"]
  });
  return html.trim() ? html : "<p><br></p>";
}

function sanitizePastedEditorHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_ATTR: ["checked", "class", "disabled", "href", "title", "type"],
    ALLOWED_TAGS: [
      "a", "b", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "input", "li", "ol", "p", "pre",
      "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"
    ]
  });
}

function editorHtmlToMarkdown(root: HTMLElement) {
  return serializeChildren(root)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function serializeChildren(node: Node): string {
  return Array.from(node.childNodes).map(serializeNode).join("");
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownPreservingMath(node.textContent ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const mathSource = readProtectedMathSource(element);
  if (mathSource !== null) {
    return element.getAttribute("data-markdown-math-display") === "true" ? `${mathSource}\n\n` : mathSource;
  }
  const tag = element.tagName.toLowerCase();
  const content = serializeChildren(element);

  if (tag === "strong" || tag === "b") return `**${content}**`;
  if (tag === "em" || tag === "i") return `*${content}*`;
  if (tag === "del") return `~~${content}~~`;
  if (tag === "code" && element.parentElement?.tagName.toLowerCase() !== "pre") return `\`${element.textContent ?? ""}\``;
  if (tag === "a") return `[${content}](${element.getAttribute("href") ?? ""})`;
  if (tag === "input" && (element as HTMLInputElement).type === "checkbox") return (element as HTMLInputElement).checked ? "[x] " : "[ ] ";
  if (tag === "br") return "\n";
  if (tag === "hr") return "\n---\n\n";
  if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag.slice(1)))} ${content.trim()}\n\n`;
  if (tag === "p" || tag === "div") return `${escapeMarkdownBlockStart(content.trim())}\n\n`;
  if (tag === "blockquote") return `${content.trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  if (tag === "pre") {
    const language = element.querySelector("code")?.className.match(/(?:^|\s)language-([^\s]+)/)?.[1] ?? "";
    return `\`\`\`${language}\n${element.textContent?.replace(/\n$/, "") ?? ""}\n\`\`\`\n\n`;
  }
  if (tag === "ul" || tag === "ol") return serializeList(element, tag === "ol") + "\n";
  if (tag === "table") return serializeTable(element);
  if (tag === "li") return content;
  return content;
}

function readProtectedMathSource(element: HTMLElement) {
  const encodedSource = element.getAttribute("data-markdown-math-source");
  if (encodedSource === null) {
    return null;
  }
  try {
    return decodeURIComponent(encodedSource);
  } catch {
    return encodedSource;
  }
}

function serializeList(list: HTMLElement, ordered: boolean): string {
  return Array.from(list.children)
    .filter((child) => child.tagName.toLowerCase() === "li")
    .map((child, index) => {
      const item = child as HTMLElement;
      const directContent = Array.from(item.childNodes)
        .filter((node) => !(node.nodeType === Node.ELEMENT_NODE && ["ul", "ol"].includes((node as HTMLElement).tagName.toLowerCase())))
        .map(serializeNode)
        .join("")
        .trim();
      const nested: string = Array.from(item.children)
        .filter((nestedElement) => ["ul", "ol"].includes(nestedElement.tagName.toLowerCase()))
        .map((nestedElement) => serializeList(nestedElement as HTMLElement, nestedElement.tagName.toLowerCase() === "ol").split("\n").map((line: string) => `  ${line}`).join("\n"))
        .join("\n");
      return `${ordered ? `${index + 1}.` : "-"} ${directContent}${nested ? `\n${nested}` : ""}`;
    })
    .join("\n");
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}\[\]])/g, "\\$1");
}

function escapeMarkdownPreservingMath(value: string) {
  const mathSourcePattern = /\$\$[\s\S]*?\$\$|\\\((?:\\.|[^\\\n])*?\\\)|\$(?!\$)(?!\s)(?:\\.|[^\\$\n])*?[^\\$\s]\$(?!\$)/g;
  let markdown = "";
  let offset = 0;

  for (const match of value.matchAll(mathSourcePattern)) {
    const source = match[0];
    const index = match.index;
    const expression = source.startsWith("$$")
      ? source.slice(2, -2)
      : source.startsWith("\\(")
        ? source.slice(2, -2)
        : source.slice(1, -1);
    if (!expression.trim()) {
      continue;
    }
    markdown += escapeMarkdown(value.slice(offset, index)) + source;
    offset = index + source.length;
  }

  return markdown + escapeMarkdown(value.slice(offset));
}

function escapeMarkdownBlockStart(value: string) {
  return value.replace(/^(\s*)(#{1,6}|>|[-+]|\d+[.)])\s/, "$1\\$2 ");
}

function serializeTable(table: HTMLElement) {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll(":scope > th, :scope > td")).map((cell) => serializeChildren(cell).trim().replace(/\|/g, "\\|"))
  );
  if (!rows.length) {
    return "";
  }
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]);
  const header = normalizedRows[0];
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...normalizedRows.slice(1).map((row) => `| ${row.join(" | ")} |`),
    ""
  ].join("\n") + "\n";
}
