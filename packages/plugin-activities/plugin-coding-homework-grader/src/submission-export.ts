import { getCodingHomeworkActivityAttachment } from "./authoring";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { feedbackExportBlocks, type AnswerExportBlock, type SubmissionExportHandler } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { prisma } from "./db-client";
export const exportHomeworkSubmission: SubmissionExportHandler = async (input) => {
  const submission = input.pluginAttemptRef ? await prisma.pluginCodingHomeworkSubmission.findFirst({ where: {
    id: input.pluginAttemptRef, activityId: input.activity.id, groupId: input.groupId, kind: "final", ...(input.userId ? { userId: input.userId } : {})
  }, include: { files: { orderBy: { path: "asc" } }, questions: { orderBy: { orderIndex: "asc" } }, reviews: { orderBy: { createdAt: "desc" }, take: 1 } } }) : null;
  if (!submission && input.pluginAttemptRef) throw new AppError(409, "ANSWER_EXPORT_SOURCE_MISSING", "The submitted files are unavailable.");
  if (!submission) return { answer: [{ kind: "markdown", text: input.labels.noAnswer }] };
  const answer: AnswerExportBlock[] = [];
  const root = path.resolve(process.cwd(), "../../storage/coding-homework-grader/submissions");
  for (const file of submission.files) {
    const resolved = path.resolve(root, file.storedName);
    if (!resolved.startsWith(root + path.sep)) throw new AppError(409, "ANSWER_EXPORT_FILE_INVALID", "The stored submission file path is invalid.");
    if (file.sizeBytes > 2_000_000n) throw new AppError(413, "ANSWER_EXPORT_FILE_TOO_LARGE", "A submitted file is too large for a PDF export.");
    const bytes = await readFile(resolved);
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { text = `${input.labels.file}: ${file.path} (${file.sizeBytes} bytes)`; }
    if (text.includes("\0")) text = `${input.labels.file}: ${file.path} (${file.sizeBytes} bytes)`;
    answer.push({ kind: "code", title: file.path, language: file.languageKey ?? "text", text });
  }
  for (const [index, question] of submission.questions.entries()) {
    if (input.includePrompt) answer.push({ kind: "markdown", title: `${input.labels.question} ${index + 1}`, text: question.questionText });
    answer.push({ kind: "markdown", title: `${input.labels.answer} ${index + 1}`, text: question.studentAnswer ?? input.labels.noAnswer });
  }
  const assignment = input.includePrompt ? await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: input.activity.id } }) : null;
  const promptPdfs = [];
  if (assignment?.promptPdfAttachmentId) {
    const attachment = await getCodingHomeworkActivityAttachment({ ownerKind: "course_activity", ownerId: input.activity.id }, assignment.promptPdfAttachmentId);
    if (!attachment.attachment) throw new AppError(409, "ANSWER_EXPORT_PROMPT_MISSING", "The assignment PDF is unavailable.");
    if (Number(attachment.attachment.sizeBytes) > 30_000_000) throw new AppError(413, "ANSWER_EXPORT_PROMPT_TOO_LARGE", "The assignment PDF is too large to include in this export.");
    promptPdfs.push({ name: attachment.attachment.originalName, bytes: new Uint8Array(await readFile(attachment.filePath)) });
  }
  const grading = input.includeGrading ? feedbackExportBlocks(input.feedback, input.labels) : [];
  if (input.includeGrading && submission.reviews[0]) grading.push(...feedbackExportBlocks(submission.reviews[0].rubric, input.labels));
  if (input.includeGrading && submission.reviews[0]?.feedback) grading.push({ kind: "markdown", title: input.labels.comments, text: submission.reviews[0].feedback });
  return { promptPdfs, prompt: assignment?.promptMarkdown ? [{ kind: "markdown", text: assignment.promptMarkdown }] : [], answer, grading };
};
