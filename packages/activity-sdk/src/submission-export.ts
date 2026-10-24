import type { CurrentUser } from "@cognelo/contracts";
import type { ServerActivityRecord } from "./server";

export type AnswerExportBlock =
  | { kind: "markdown"; text: string; title?: string }
  | { kind: "code"; text: string; title?: string; language?: string }
  | { kind: "table"; headers: string[]; rows: string[][]; title?: string };
export type AnswerExportLabels = {
  prompt: string; answer: string; grading: string; question: string; choices: string; correctAnswer: string;
  noAnswer: string; unavailable: string; tests: string; test: string; result: string; score: string;
  passed: string; failed: string; comments: string; rubric: string; criterion: string; weight: string;
  summary: string; strengths: string; improvements: string; file: string;
};
export type SubmissionExportInput = {
  user: CurrentUser; courseId: string; groupId: string; participantId: string; userId: string | null;
  coreAttemptId: string; pluginAttemptRef: string | null; activity: ServerActivityRecord;
  metadata: Record<string, unknown>; state: Record<string, unknown> | null; feedback: Record<string, unknown>;
  includePrompt: boolean; includeGrading: boolean; labels: AnswerExportLabels;
};
export type SubmissionExportContent = { replaceDescription?: boolean; promptPdfs?: Array<{ name: string; bytes: Uint8Array }>; prompt?: AnswerExportBlock[]; answer: AnswerExportBlock[]; grading?: AnswerExportBlock[] };
export type SubmissionExportHandler = (input: SubmissionExportInput) => Promise<SubmissionExportContent>;
export const exportRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const exportText = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";

/** Only human-facing saved feedback. Never serialize raw model/provider/provenance objects. */
export function feedbackExportBlocks(value: unknown, labels: AnswerExportLabels): AnswerExportBlock[] {
  const feedback = exportRecord(value);
  const blocks: AnswerExportBlock[] = [];
  for (const key of ["summary", "strengths", "improvements"] as const) {
    const text = Array.isArray(feedback[key]) ? feedback[key].map(exportText).filter(Boolean).map((line) => `- ${line}`).join("\n") : exportText(feedback[key]);
    if (text) blocks.push({ kind: "markdown", title: labels[key], text });
  }
  for (const key of ["feedbackText", "comments"]) if (typeof feedback[key] === "string" && feedback[key]) blocks.push({ kind: "markdown", title: labels.comments, text: feedback[key] as string });
  if (Array.isArray(feedback.criteria) && feedback.criteria.length) blocks.push({ kind: "table", title: labels.rubric,
    headers: [labels.criterion, labels.weight, labels.score, labels.comments], rows: feedback.criteria.map((raw) => {
      const row = exportRecord(raw);
      return [exportText(row.title), row.weightPercent == null ? "" : `${exportText(row.weightPercent)}%`, row.scorePercent == null ? "" : `${exportText(row.scorePercent)}%`, exportText(row.feedback)];
    }) });
  if (Array.isArray(feedback.questionFeedback)) for (const raw of feedback.questionFeedback) {
    const row = exportRecord(raw);
    const text = exportText(row.explanation) || exportText(row.feedback);
    if (text) blocks.push({ kind: "markdown", title: `${labels.question} ${exportText(row.questionId)}`, text });
  }
  return blocks;
}
