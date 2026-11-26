import { zipSync } from "fflate";
import { createHash } from "node:crypto";
import { AppError, type StudentCourseExportBundle, type StudentCourseExportDocument } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { blockHtml, escapeExportHtml as escape, exportDocumentHtml, withAnswerExportRenderer } from "./answer-export-pdf";
import { mergeAnswerPdfParts } from "./answer-export-pdf-merge";

/** Bound UTF-8 path components and retain extensions without permitting traversal or device names. */
export function studentCourseArchiveName(value: string) {
  const clean = Buffer.from(value.normalize("NFC").replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, "-").replace(/\.{2,}/g, "-").replace(/^[. ]+|[. ]+$/g, ""), "utf8").toString("utf8");
  const extension = /\.[A-Za-z0-9]{1,12}$/.exec(clean)?.[0] ?? "";
  const stem = extension ? clean.slice(0, -extension.length) : clean;
  let name = "";
  for (const character of stem) { if (Buffer.byteLength(name + character + extension) > 120) break; name += character; }
  const result = (name + extension).replace(/[. ]+$/g, "") || "content";
  return /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(result) ? `content-${result}` : result;
}
export function studentCoursePdfPath(document: StudentCourseExportDocument) {
  const parts = document.path.map(studentCourseArchiveName);
  if (!parts.length) throw new AppError(409, "COURSE_EXPORT_CHANGED", "An export item is unavailable.");
  parts[parts.length - 1] += ".pdf";
  return parts.join("/");
}
export function studentCourseDocumentHtml(data: StudentCourseExportBundle, document: StudentCourseExportDocument, css = "") {
  const labels = data.labels;
  const blocks = (values: Parameters<typeof blockHtml>[0][]) => values.map(blockHtml).join("");
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(data.locale, { timeZone: data.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
  const heading = `<p class="course">${escape(data.subjectTitle)} · ${escape(data.courseTitle)}</p><h1>${escape(document.title)}</h1><p>${escape(document.groupTitle)}</p>`;
  const grade = (value: string | null) => value == null ? escape(labels.ungraded) : `<bdi dir="ltr">${escape(value)}</bdi>`;
  const body = `<article class="submission"><header>${heading}${document.grade !== undefined ? `<p class="grade">${escape(labels.gradebookGrade)}: ${grade(document.grade)}</p>` : ""}</header>
    ${blocks(document.prompt)}${document.gradeComment ? blockHtml({ kind: "markdown", title: labels.comments, text: document.gradeComment }) : ""}${document.isActivity && !document.attempts.length && document.grade === undefined ? `<p>${escape(labels.noSubmissions)}</p>` : ""}</article>`
    + document.attempts.map(attempt => `<article class="submission"><header>${heading}
      <h2>${escape(labels.attempt)} ${attempt.number}</h2><p class="meta">${escape(labels.submitted)} ${escape(date(attempt.submittedAt))}</p>
      ${attempt.score !== undefined ? `<p class="grade">${escape(labels.attemptGrade)}: ${grade(attempt.score)}</p>` : ""}</header>
      ${attempt.sections.map(section => `<section>${attempt.sections.length > 1 ? `<h3>${escape(section.title)}</h3>` : ""}
        ${section.prompt.length ? `<div class="prompt"><h4>${escape(labels.prompt)}</h4>${blocks(section.prompt)}</div>` : ""}
        ${section.answer.length ? `<div class="answer"><h4>${escape(labels.answer)}</h4>${blocks(section.answer)}</div>` : ""}
        ${section.grading.length || section.score !== undefined ? `<div class="grading"><h4>${escape(labels.grading)}</h4>${section.score !== undefined ? `<p>${escape(labels.score)}: ${grade(section.score)}</p>` : ""}${blocks(section.grading)}</div>` : ""}</section>`).join("")}</article>`).join("");
  return exportDocumentHtml(document.title, data.locale, body, `${css}\n.markdown p,.markdown li{unicode-bidi:plaintext}.markdown,.course,h1,h2,h3,h4,header p{overflow-wrap:anywhere}`);
}
function indexHtml(data: StudentCourseExportBundle, css: string) {
  const date = new Intl.DateTimeFormat(data.locale, { timeZone: data.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(data.exportedAt));
  const rows = [
    ...data.documents.map(document => [document.title, studentCoursePdfPath(document)]),
    ...data.files.map(file => [file.path.at(-1) ?? data.labels.file, file.path.map(studentCourseArchiveName).join("/")])
  ];
  return exportDocumentHtml(data.labels.contents, data.locale, `<article><header><p class="course">${escape(data.subjectTitle)}</p><h1>${escape(data.courseTitle)}</h1>
    <h2>${escape(data.labels.contents)}</h2><p>${escape(data.studentName)}</p><p class="meta">${escape(data.labels.exported)} ${escape(date)}</p></header>
    ${blockHtml({ kind: "table", headers: [data.labels.contents, data.labels.file], rows })}</article>`, css);
}

export async function createStudentCourseExportFile(loadData: (signal: AbortSignal) => Promise<StudentCourseExportBundle>, user: CurrentUser, locale: string, signal?: AbortSignal) {
  return withAnswerExportRenderer(user, locale, signal, async ({ render, css, signal: scoped }) => {
    const data = await loadData(scoped);
    const files: Record<string, Uint8Array> = Object.create(null);
    let total = 0;
    const prefix = `Course-${studentCourseArchiveName(data.courseTitle)}`;
    const add = (name: string, bytes: Uint8Array) => {
      scoped.throwIfAborted();
      if (Buffer.byteLength(name) > 3200 || Object.hasOwn(files, name)) throw new AppError(409, "COURSE_EXPORT_CHANGED", "An export path is unavailable or duplicated.");
      total += bytes.byteLength;
      if (total > 128_000_000 || Object.keys(files).length >= 4000) throw new AppError(413, "COURSE_EXPORT_TOO_LARGE", "This course exceeds the export limit.");
      files[name] = bytes;
    };
    add(`${prefix}/000-${studentCourseArchiveName(data.labels.contents)}.pdf`, await render(indexHtml(data, css), true, data.authorizeImage, data.hasSafeExamBrowserAccess));
    for (const directory of data.directories) add(`${prefix}/${directory.map(studentCourseArchiveName).join("/")}/`, new Uint8Array());
    for (const file of data.files) add(`${prefix}/${file.path.map(studentCourseArchiveName).join("/")}`, file.bytes);
    for (const document of data.documents) {
      scoped.throwIfAborted();
      const seen = new Set<string>();
      const attachments = [...(document.promptPdfs ?? []), ...document.attempts.flatMap(attempt => attempt.sections.flatMap(section => section.promptPdfs ?? []))].filter(attachment => {
        const hash = createHash("sha256").update(attachment.bytes).digest("hex");
        if (seen.has(hash)) return false;
        seen.add(hash); return true;
      });
      const printed = await render(studentCourseDocumentHtml(data, document, css), !attachments.length, data.authorizeImage, data.hasSafeExamBrowserAccess);
      const bytes = attachments.length ? await mergeAnswerPdfParts([{ bytes: printed }, ...attachments.map(attachment => ({ bytes: attachment.bytes, attachment: true }))], document.title) : printed;
      add(`${prefix}/${studentCoursePdfPath(document)}`, bytes);
    }
    scoped.throwIfAborted();
    await data.revalidate();
    scoped.throwIfAborted();
    const bytes = zipSync(files, { level: 1 });
    if (bytes.byteLength > 128_000_000) throw new AppError(413, "COURSE_EXPORT_TOO_LARGE", "This course exceeds the export limit.");
    return { bytes, mime: "application/zip", fileName: `${studentCourseArchiveName(data.courseTitle)}.zip` };
  });
}
