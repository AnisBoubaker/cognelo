import { readFile } from "node:fs/promises";
import type { ContentEmbeddingDiagnostic, ContentEmbeddingDocument } from "@cognelo/content-type-sdk/server";
import { codingHomeworkAttachmentPath } from "./authoring";
import { prisma } from "./db-client";
import { parseCodingHomeworkSourceFiles } from "./parsers";

const MAX_EXTRACTABLE_BYTES = 2 * 1024 * 1024;

export async function getCodingHomeworkActivityReferenceDocuments(activityId: string) {
  const assignment = await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId } });
  const attachments = await prisma.pluginCodingHomeworkAttachment.findMany({
    where: {
      ownerKind: "course_activity",
      ownerId: activityId,
      OR: [
        { kind: "provided_file" },
        ...(assignment?.promptPdfAttachmentId ? [{ id: assignment.promptPdfAttachmentId, kind: "assignment_pdf" as const }] : [])
      ]
    },
    orderBy: [{ kind: "asc" }, { originalName: "asc" }]
  });
  const documents: ContentEmbeddingDocument[] = [];
  const diagnostics: ContentEmbeddingDiagnostic[] = [];

  if (assignment?.promptMarkdown.trim()) {
    documents.push({
      id: `${activityId}:assignment-prompt`,
      sourceId: activityId,
      title: "Assignment prompt",
      text: assignment.promptMarkdown,
      kind: "markdown",
      languageKey: null,
      path: null,
      metadata: { activityOwned: true, sourceKind: "assignment_prompt" }
    });
  }

  for (const attachment of attachments) {
    if (attachment.sizeBytes > BigInt(MAX_EXTRACTABLE_BYTES)) {
      diagnostics.push({
        code: "CODING_HOMEWORK_ACTIVITY_FILE_TOO_LARGE_FOR_EXTRACTION",
        message: `${attachment.originalName} is too large for local reference extraction.`,
        severity: "warning",
        metadata: { attachmentId: attachment.id, sizeBytes: Number(attachment.sizeBytes) }
      });
      continue;
    }
    const bytes = await readFile(codingHomeworkAttachmentPath(attachment.storedName));
    const extracted = extractAttachmentText(bytes, attachment.mimeType ?? "application/octet-stream", attachment.originalName);
    diagnostics.push(...extracted.diagnostics.map((diagnostic) => ({ ...diagnostic, metadata: { attachmentId: attachment.id } })));
    if (!extracted.text.trim()) {
      continue;
    }

    const languageKey = languageKeyForFile(attachment.originalName);
    if (languageKey === "c") {
      const parsed = await parseCodingHomeworkSourceFiles([{ content: extracted.text, languageKey, path: attachment.originalName }]);
      diagnostics.push(...parsed.diagnostics.map((diagnostic) => ({ ...diagnostic, metadata: { attachmentId: attachment.id } })));
      if (parsed.functions.length) {
        documents.push(
          ...parsed.functions.map((fn, index) => ({
            id: `${attachment.id}:function:${index}:${fn.functionName}`,
            sourceId: activityId,
            title: `${attachment.originalName}: ${fn.functionName}`,
            text: fn.astText,
            kind: "code" as const,
            languageKey: fn.languageKey,
            path: attachment.originalName,
            metadata: {
              activityOwned: true,
              attachmentId: attachment.id,
              functionCode: fn.functionCode,
              functionName: fn.functionName,
              sourceKind: "provided_file"
            }
          }))
        );
        continue;
      }
    }

    documents.push({
      id: `${attachment.id}:file`,
      sourceId: activityId,
      title: attachment.originalName,
      text: extracted.text,
      kind: languageKey ? "code" : "plain_text",
      languageKey,
      path: attachment.originalName,
      metadata: {
        activityOwned: true,
        attachmentId: attachment.id,
        sourceKind: attachment.kind === "assignment_pdf" ? "assignment_pdf" : "provided_file"
      }
    });
  }

  return { sourceId: activityId, documents, diagnostics };
}

function extractAttachmentText(bytes: Buffer, mimeType: string, fileName: string) {
  if (isPlainTextFile(mimeType, fileName)) {
    return { text: bytes.toString("utf8"), diagnostics: [] as ContentEmbeddingDiagnostic[] };
  }
  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    const text = extractSimplePdfText(bytes);
    return {
      text,
      diagnostics: [
        {
          code: text.trim() ? "CODING_HOMEWORK_PDF_TEXT_EXTRACTED" : "CODING_HOMEWORK_PDF_TEXT_EXTRACTION_EMPTY",
          message: text.trim()
            ? `Extracted text from activity PDF ${fileName}.`
            : `No text could be extracted from activity PDF ${fileName} by the basic local extractor.`,
          severity: text.trim() ? ("info" as const) : ("warning" as const)
        }
      ]
    };
  }
  return {
    text: "",
    diagnostics: [
      {
        code: "CODING_HOMEWORK_ACTIVITY_FILE_EXTRACTION_UNSUPPORTED",
        message: `${fileName} is available to students but is not a supported text/code reference format.`,
        severity: "warning" as const
      }
    ]
  };
}

function isPlainTextFile(mimeType: string, fileName: string) {
  return (
    mimeType.startsWith("text/") ||
    ["application/json", "application/javascript", "application/typescript", "application/xml"].includes(mimeType) ||
    /\.(c|cc|cpp|css|csv|h|hpp|html|java|js|json|md|py|ts|tsx|txt|xml)$/i.test(fileName)
  );
}

function languageKeyForFile(fileName: string) {
  if (/\.(c|h)$/i.test(fileName)) return "c";
  if (/\.(cc|cpp|hpp)$/i.test(fileName)) return "cpp";
  if (/\.py$/i.test(fileName)) return "python";
  if (/\.(js|jsx)$/i.test(fileName)) return "javascript";
  if (/\.(ts|tsx)$/i.test(fileName)) return "typescript";
  if (/\.java$/i.test(fileName)) return "java";
  return null;
}

function extractSimplePdfText(bytes: Buffer) {
  const raw = bytes.toString("latin1");
  const matches = raw.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
  return matches
    .map((match) =>
      match.slice(1, -1).replace(/\\([nrtbf()\\])/g, (_, escaped: string) => {
        if (escaped === "n") return "\n";
        if (escaped === "r") return "\r";
        if (escaped === "t") return "\t";
        if (escaped === "b" || escaped === "f") return " ";
        return escaped;
      })
    )
    .join("\n")
    .replace(/\s+\n/g, "\n")
    .trim();
}
