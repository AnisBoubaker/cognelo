import { mergeAnswerPdfParts } from "./answer-export-pdf-merge";
import { fetchPublicExportImage } from "./answer-export-images";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium } from "playwright";
import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import katex from "katex";
import { zipSync } from "fflate";
import { AppError, getMediaAssetForDelivery, type buildAnswerExport, type AnswerExportDocument } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import type { AnswerExportBlock } from "@cognelo/activity-sdk/server";
import { answerExportLabels } from "./answer-export-labels";

type Export = Awaited<ReturnType<typeof buildAnswerExport>>;
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const markdown = new Marked({ gfm: true, renderer: { html: ({ text }) => escape(text) } });
markdown.use({ extensions: [
  { name: "displayMath", level: "block", start: (src) => src.indexOf("$$"), tokenizer(src) { const match = /^\$\$([\s\S]+?)\$\$(?:\n|$)/.exec(src); if (match) return { type: "displayMath", raw: match[0], text: match[1] }; }, renderer(token) { return katex.renderToString(token.text, { displayMode: true, throwOnError: false, trust: false }); } },
  { name: "inlineMath", level: "inline", start: (src) => src.indexOf("$"), tokenizer(src) { const match = /^\$([^$\n]+)\$/.exec(src); if (match) return { type: "inlineMath", raw: match[0], text: match[1] }; }, renderer(token) { return katex.renderToString(token.text, { throwOnError: false, trust: false }); } }
] });
function markdownHtml(text: string) {
  return sanitizeHtml(markdown.parse(text, { async: false }), { allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "span", "math", "semantics", "annotation", "mrow", "mi", "mo", "mn", "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot", "mtext", "mspace", "mtable", "mtr", "mtd", "mover", "munder", "munderover", "mpadded", "svg", "path", "line"],
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, "*": ["class", "style", "aria-hidden"], img: ["src", "alt", "width", "height"], math: ["xmlns", "display"], annotation: ["encoding"], svg: ["xmlns", "width", "height", "viewBox", "preserveAspectRatio"], path: ["d"], line: ["x1", "x2", "y1", "y2"] }, allowedSchemes: ["https", "http", "data"], allowedSchemesByTag: { a: ["https", "http", "mailto"], img: ["https", "http", "data"] } });
}
function blockHtml(block: AnswerExportBlock) {
  const title = block.title ? `<h4>${escape(block.title)}</h4>` : "";
  if (block.kind === "code") return `${title}<pre dir="ltr"><code>${escape(block.text)}</code></pre>`;
  if (block.kind === "table") return `${title}<table><thead><tr>${block.headers.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `${title}<div class="markdown">${markdownHtml(block.text)}</div>`;
}
export function answerExportHtml(data: Export, documents: AnswerExportDocument[], css = "") {
  const labels = answerExportLabels(data.options.locale);
  const blocks = (items: AnswerExportBlock[]) => items.map(blockHtml).join("");
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat(data.options.locale, { timeZone: data.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
  const body = documents.map((student) => student.attempts.map((attempt, attemptIndex) => `<article class="submission">
    <header><p class="course">${escape(data.subjectTitle)} · ${escape(data.courseTitle)}</p><h1>${escape(data.activityTitle)}</h1>
    <h2>${escape(student.name)}</h2><p>${escape(student.email)} · ${escape(student.groupTitle)}</p>
    <p class="meta">${escape(labels.attempt)} ${attempt.number} · ${escape(labels.submitted)} ${escape(formatDate(attempt.submittedAt))} (${escape(data.timeZone)})</p>
    ${data.options.includeGrading ? `<p class="grade">${escape(labels.attemptGrade)}: ${escape(attempt.score ?? labels.ungraded)}</p>` : ""}
    ${data.options.includeGrading && attemptIndex === 0 && student.gradebookGrade !== undefined ? `<p class="grade">${escape(labels.gradebookGrade)}: ${escape(student.gradebookGrade ?? labels.ungraded)}</p>${student.gradebookComment ? `<p>${escape(labels.comments)}: ${escape(student.gradebookComment)}</p>` : ""}` : ""}</header>
    ${attempt.sections.map((section) => `<section>${attempt.sections.length > 1 || section.title !== data.activityTitle ? `<h3>${escape(section.title)}</h3>` : ""}
      ${data.options.includePrompt && section.prompt.length ? `<div class="prompt"><h4>${escape(labels.prompt)}</h4>${blocks(section.prompt)}</div>` : ""}
      ${section.answer.length ? `<div class="answer"><h4>${escape(labels.answer)}</h4>${blocks(section.answer)}</div>` : ""}
      ${data.options.includeGrading && (section.grading.length || section.score !== undefined) ? `<div class="grading"><h4>${escape(labels.grading)}</h4>${section.score !== undefined ? `<p>${escape(labels.score)}: ${escape(section.score ?? labels.ungraded)}</p>` : ""}${blocks(section.grading)}</div>` : ""}</section>`).join("")}</article>`).join("")).join("");
  return `<!doctype html><html lang="${data.options.locale}" dir="${data.options.locale === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'none'"><title>${escape(data.activityTitle)}</title><style>${css}
    *{box-sizing:border-box}body{font:11pt Arial,'Noto Sans','Noto Sans CJK SC',sans-serif;line-height:1.45;color:#17233c;margin:0}h1{font-size:20pt;margin:5px 0 14px}h2{font-size:15pt;margin:6px 0}h3{font-size:13pt;border-bottom:1px solid #cad3df;padding-bottom:5px;margin:20px 0 12px}h4{font-size:11pt;margin:14px 0 6px}p{margin:6px 0}header{border-bottom:2px solid #287cca;padding-bottom:12px}.course{color:#287cca;font-weight:bold;font-size:10pt}.meta{color:#5d6778;font-size:9pt}.grade{font-weight:bold}.submission+.submission{break-before:page}h1,h2,h3,h4{break-after:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4;font:9pt 'Courier New','Noto Sans Mono',monospace;line-height:1.4;background:#f5f7fa;border:1px solid #dde3eb;padding:10px;margin:6px 0;box-decoration-break:clone}code{font-family:'Courier New',monospace}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;margin:10px 0}td,th{border:1px solid #d6dfe9;padding:7px;text-align:start;overflow-wrap:anywhere;vertical-align:top}th{background:#eff4fa}tr{break-inside:avoid}thead{display:table-header-group}img{max-width:100%;max-height:230mm;object-fit:contain}a{color:#225f9e;overflow-wrap:anywhere}.prompt{background:#f6f8fb;border-inline-start:3px solid #bdd2e9;padding:1px 12px 10px}.grading{border-top:1px solid #ddd;margin-top:15px}.katex{font-size:1.05em}.katex-display{overflow-wrap:anywhere}blockquote{margin-inline:12px;border-inline-start:2px solid #ccc;padding-inline-start:10px}
  </style></head><body>${body}</body></html>`;
}
let katexCss: Promise<string> | undefined;
async function embeddedKatexCss() {
  return katexCss ??= (async () => {
    const resolvePackage = createRequire(path.join(process.cwd(), "package.json")).resolve;
    const directory = path.dirname(resolvePackage("katex"));
    const source = await readFile(path.join(directory, "katex.min.css"), "utf8");
    const paths = [...new Set([...source.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]))];
    const fonts = await Promise.all(paths.map(async (font) => [font, `data:font/woff2;base64,${(await readFile(path.join(directory, font))).toString("base64")}`] as const));
    return fonts.reduce((css, [font, data]) => css.replaceAll(`url(${font})`, `url(${data})`), source);
  })();
}
async function embedImages(html: string, user: CurrentUser, locale: string, cache: Map<string, string | null>) {
  for (const match of [...html.matchAll(/<img\b[^>]*>/gi)]) {
    const src = /src="([^"]+)"/.exec(match[0])?.[1] ?? "";
    const id = /(?:^|\/)api\/media\/([^/?#]+)/.exec(src)?.[1];
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(src) && src.length <= 14_000_000) continue;
    try {
      let data = cache.get(src);
      if (!cache.has(src)) {
        if (cache.size >= 100) throw new Error("Too many images");
        cache.set(src, null);
        if (id) {
          const asset = await getMediaAssetForDelivery(user, decodeURIComponent(id));
          if (asset.byteSize > 10_000_000 || !/^image\/(png|jpeg|webp|gif)$/.test(asset.mimeType)) throw new Error("Unsupported image");
          data = `data:${asset.mimeType};base64,${(await readFile(asset.filePath)).toString("base64")}`;
        } else {
          const image = await fetchPublicExportImage(src.replaceAll("&amp;", "&"));
          data = `data:${image.mime};base64,${image.bytes.toString("base64")}`;
        }
        cache.set(src, data);
      }
      if (!data) throw new Error("Image unavailable");
      html = html.replace(match[0], match[0].replace(src, data));
    } catch { html = html.replace(match[0], `<p>[${escape(answerExportLabels(locale).imageUnavailable)}: ${escape(/alt="([^"]*)"/.exec(match[0])?.[1] ?? src)}]</p>`); }
  }
  return html;
}
export const answerExportFileName = (name: string) => name.normalize("NFC").replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, "-").replace(/\.{2,}/g, "-").trim().slice(0, 120) || "answers";
let activeExports = 0;
export async function createAnswerExportFile(data: Export, user: CurrentUser) {
  if (activeExports >= 2) throw new AppError(429, "ANSWER_EXPORT_BUSY", "Other answer exports are running. Try again shortly.");
  activeExports++;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    browser = await chromium.launch({ chromiumSandbox: true, env: Object.fromEntries(["PATH", "HOME", "TMPDIR", "DISPLAY", "LD_LIBRARY_PATH", "FONTCONFIG_PATH"].flatMap((key) => process.env[key] ? [[key, process.env[key]!]] : [])), executablePath: process.env.PDF_CHROMIUM_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, timeout: 30_000 });
    deadline = setTimeout(() => { void browser?.close().catch(() => undefined); }, 240_000);
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block", offline: true });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const css = await embeddedKatexCss();
    const imageCache = new Map<string, string | null>();
    const render = async (documents: AnswerExportDocument[], footer = true) => {
      const html = await embedImages(answerExportHtml(data, documents, css), user, data.options.locale, imageCache);
      if (Buffer.byteLength(html) > 64_000_000) throw new AppError(413, "ANSWER_EXPORT_TOO_LARGE", "Select fewer students or attempts for this export.");
      await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
      return page.pdf({ format: "A4", printBackground: true, tagged: true, displayHeaderFooter: footer, headerTemplate: "<span></span>", footerTemplate: '<div style="font-size:9px;color:#667085;text-align:center;width:100%"><span class="pageNumber"></span> / <span class="totalPages"></span></div>', margin: { top: "16mm", right: "15mm", bottom: "18mm", left: "15mm" } });
    };
    const renderWithAttachments = async (documents: AnswerExportDocument[]) => {
      if (!data.options.includePrompt || !documents.some((document) => document.attempts.some((attempt) => attempt.sections.some((section) => section.promptPdfs?.length)))) return render(documents);
      const parts: Array<{ bytes: Uint8Array; attachment?: boolean }> = [];
      for (const student of documents) for (const attempt of student.attempts) {
        parts.push({ bytes: await render([{ ...student, attempts: [attempt] }], false) });
        for (const section of attempt.sections) for (const attachment of section.promptPdfs ?? []) parts.push({ bytes: attachment.bytes, attachment: true });
      }
      return mergeAnswerPdfParts(parts, data.activityTitle);
    };
    if (data.options.format === "pdf") return { bytes: await renderWithAttachments(data.documents), mime: "application/pdf", fileName: `${answerExportFileName(data.documents.length === 1 ? `${data.documents[0].name}-${data.activityTitle}${data.options.attemptId ? `-${data.documents[0].attempts[0].number}` : ""}` : data.activityTitle)}.pdf` };
    const files: Record<string, Uint8Array> = {};
    let total = 0;
    for (const [index, student] of data.documents.entries()) {
      const bytes = await renderWithAttachments([student]); total += bytes.length;
      if (total > 128_000_000) throw new AppError(413, "ANSWER_EXPORT_TOO_LARGE", "Select fewer students or attempts for this export.");
      files[`${String(index + 1).padStart(3, "0")}-${answerExportFileName(student.name)}-${answerExportFileName(student.groupTitle)}.pdf`] = bytes;
    }
    return { bytes: zipSync(files, { level: 1 }), mime: "application/zip", fileName: `${answerExportFileName(data.activityTitle)}.zip` };
  } finally { clearTimeout(deadline); try { await browser?.close(); } finally { activeExports--; } }
}
