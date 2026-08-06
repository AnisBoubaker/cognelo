"use client";

import DOMPurify from "dompurify";
import { marked } from "marked";
import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { CodeEditor } from "./code-editor";

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
    linkPrompt: "Enter the link URL"
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
    linkPrompt: "Saisissez l'adresse du lien"
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
    linkPrompt: "输入链接地址"
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
    linkPrompt: "أدخل عنوان الرابط"
  }
} as const;

marked.setOptions({ breaks: true, gfm: true });

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
  const visualRef = useRef<HTMLDivElement | null>(null);
  const visualMarkdownRef = useRef<string | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const copy = editorCopy[locale] ?? editorCopy.en;

  useEffect(() => {
    const visualElement = visualRef.current;
    if (!visualElement) {
      return;
    }
    if (visualMarkdownRef.current === value) {
      return;
    }
    selectionRangeRef.current = null;
    visualElement.innerHTML = markdownToEditorHtml(value);
    visualMarkdownRef.current = value;
  }, [value]);

  function syncVisualValue() {
    if (!visualRef.current) {
      return;
    }
    const markdown = editorHtmlToMarkdown(visualRef.current);
    visualMarkdownRef.current = markdown;
    onChange(markdown);
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

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const clipboardHtml = event.clipboardData.getData("text/html");
    if (clipboardHtml) {
      document.execCommand("insertHTML", false, sanitizeEditorHtml(clipboardHtml));
    } else {
      document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    }
    syncVisualValue();
  }

  function handleVisualKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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
              syncVisualValue();
            }}
            onInput={() => {
              saveSelection();
              syncVisualValue();
            }}
            onKeyDown={handleVisualKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onPaste={handlePaste}
          />
      </div>
      <div className="rich-text-editor-markdown-source" hidden={mode !== "markdown"} role="tabpanel">
        <CodeEditor
          id={id ? `${id}-markdown` : undefined}
          language="markdown"
          minHeight={minHeight}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function markdownToEditorHtml(markdown: string) {
  const html = sanitizeEditorHtml(marked.parse(markdown ?? "") as string);
  return html.trim() ? html : "<p><br></p>";
}

function sanitizeEditorHtml(html: string) {
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
    return escapeMarkdown(node.textContent ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
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
