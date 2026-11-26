import { getCodingHomeworkActivityAttachment } from "./authoring";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { feedbackExportBlocks, studentSubmissionExportInput, type AnswerExportBlock, type SubmissionExportHandler, type StudentActivityExportHandler, type StudentActivityExportInput } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { prisma } from "./db-client";
import { isHomeworkFeedback } from "./rubric";
import { homeworkRubricExportBlocks } from "./rubric-export";
import { readFrozenHomeworkFile } from "./hand-in";
import { readProvidedAttachmentChunks } from "./attachment-storage";
import { downloadHomeworkProvidedFiles } from "./provided-files-download";
export const exportHomeworkSubmission: SubmissionExportHandler = async (input) => {
  const includeFeedback = input.includeGrading && input.includeAiFeedback !== false;
  const submission = input.pluginAttemptRef ? await prisma.pluginCodingHomeworkSubmission.findFirst({ where: {
    id: input.pluginAttemptRef, activityId: input.activity.id, groupId: input.groupId, kind: "final", ...(input.userId ? { userId: input.userId } : {})
  }, include: { files: { orderBy: { path: "asc" } }, questions: { orderBy: { orderIndex: "asc" } }, reviews: { orderBy: { createdAt: "desc" }, ...(input.audience === "student" ? { take: 0 } : {}) } } }) : null;
  if (!submission && input.pluginAttemptRef) throw new AppError(409, "ANSWER_EXPORT_SOURCE_MISSING", "The submitted files are unavailable.");
  if (!submission) return { answer: [{ kind: "markdown", text: input.labels.noAnswer }] };
  let reviews: Array<{ rubric: unknown; feedback: string }> = submission.reviews.filter(review => (review.metadata as Record<string, unknown>)?.status !== "staged");
  if (input.audience === "student" && includeFeedback && !isHomeworkFeedback(input.feedback)) {
    const [saved] = await prisma.$queryRaw<Array<{ id: string; bytes: number }>>`SELECT id,octet_length(rubric::text)+octet_length(feedback) AS bytes
      FROM "PluginCodingHomeworkReview" WHERE "submissionId"=${submission.id} AND COALESCE(metadata->>'status','completed')='completed'
      ORDER BY "createdAt" DESC,id DESC LIMIT 1`;
    if (saved?.bytes > 4_000_000) throw new AppError(413, "ANSWER_EXPORT_TOO_LARGE", "The saved feedback exceeds the export limit.");
    const review = saved ? await prisma.pluginCodingHomeworkReview.findUnique({ where: { id: saved.id }, select: { rubric: true, feedback: true } }) : null;
    reviews = review ? [review] : [];
  }
  const answer: AnswerExportBlock[] = [];
  for (const file of submission.files) {
    input.signal?.throwIfAborted();
    const storageRoot = path.resolve(process.cwd(), "../../storage/coding-homework-grader/submissions");
    const resolved = path.resolve(storageRoot, file.storedName);
    if (!resolved.startsWith(storageRoot + path.sep)) throw new AppError(409, "ANSWER_EXPORT_FILE_INVALID", "The stored submission file path is invalid.");
    if (file.sizeBytes > 2_000_000n) throw new AppError(413, "ANSWER_EXPORT_FILE_TOO_LARGE", "A submitted file is too large for a PDF export.");
    const bytes = input.audience === "student" ? await readFrozenHomeworkFile(file) : await readFile(resolved);
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
  if (assignment?.promptPdfAttachmentId && input.audience !== "student") {
    const attachment = await getCodingHomeworkActivityAttachment({ ownerKind: "course_activity", ownerId: input.activity.id }, assignment.promptPdfAttachmentId);
    if (!attachment.attachment) throw new AppError(409, "ANSWER_EXPORT_PROMPT_MISSING", "The assignment PDF is unavailable.");
    if (Number(attachment.attachment.sizeBytes) > 30_000_000) throw new AppError(413, "ANSWER_EXPORT_PROMPT_TOO_LARGE", "The assignment PDF is too large to include in this export.");
    promptPdfs.push({ name: attachment.attachment.originalName, bytes: new Uint8Array(await readFile(attachment.filePath)) });
  }
  const currentRubric = isHomeworkFeedback(input.feedback) ? input.feedback : reviews.map(review => review.rubric).find(isHomeworkFeedback);
  const grading = includeFeedback ? currentRubric ? homeworkRubricExportBlocks(currentRubric, input.labels) : feedbackExportBlocks(input.feedback, input.labels) : [];
  if (includeFeedback && !currentRubric && reviews[0]) grading.push(...feedbackExportBlocks(reviews[0].rubric, input.labels));
  if (includeFeedback && !currentRubric && reviews[0]?.feedback) grading.push({ kind: "markdown", title: input.labels.comments, text: reviews[0].feedback });
  return { promptPdfs, prompt: assignment?.promptMarkdown ? [{ kind: "markdown", text: assignment.promptMarkdown }] : [], answer, grading };
};

async function studentHomeworkPrompt(input: StudentActivityExportInput, includeFiles = false) {
  const assignment = await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: input.activity.id } });
  const promptPdfs: Array<{ name: string; bytes: Uint8Array }> = [];
  const files: Array<{ name: string; bytes: Uint8Array }> = [];
  if (assignment?.promptPdfAttachmentId) {
    const { attachment } = await getCodingHomeworkActivityAttachment({ ownerKind: "course_activity", ownerId: input.activity.id }, assignment.promptPdfAttachmentId);
    if (!attachment || attachment.kind !== "assignment_pdf") throw new AppError(409, "ANSWER_EXPORT_PROMPT_MISSING", "The assignment PDF is unavailable.");
    const chunks: Buffer[] = [];
    for await (const chunk of readProvidedAttachmentChunks({ ...attachment, sizeBytes: BigInt(attachment.sizeBytes) }, input.signal)) chunks.push(chunk);
    const original = { name: attachment.originalName, bytes: new Uint8Array(Buffer.concat(chunks)) };
    promptPdfs.push(original);
    if (includeFiles) files.push(original);
  }
  if (includeFiles) {
    const provided = await prisma.pluginCodingHomeworkAttachment.aggregate({ where: { ownerKind: "course_activity", ownerId: input.activity.id, kind: "provided_file" }, _sum: { sizeBytes: true }, _count: { _all: true } });
    if ((provided._sum.sizeBytes ?? 0n) > 64_000_000n || provided._count._all > 1000) throw new AppError(413, "COURSE_EXPORT_TOO_LARGE", "The provided files exceed the export limit.");
    if (provided._count._all) {
      const response = await downloadHomeworkProvidedFiles({ ownerKind: "course_activity", ownerId: input.activity.id }, input.signal, true);
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(response.headers.get("Content-Disposition") ?? "")?.[1];
      files.push({ name: encoded ? decodeURIComponent(encoded) : "provided-files.zip", bytes: new Uint8Array(await response.arrayBuffer()) });
    }
  }
  return { promptPdfs, files, prompt: assignment?.promptMarkdown ? [{ kind: "markdown" as const, text: assignment.promptMarkdown }] : [] };
}

export const exportStudentHomework: StudentActivityExportHandler = async input => {
  if (!input.attempt) return { ...await studentHomeworkPrompt(input, true), answer: [] };
  const saved = await prisma.pluginCodingHomeworkSubmission.findFirst({ where: { id: input.attempt.pluginAttemptRef ?? "", activityId: input.activity.id,
    groupId: input.groupId, userId: input.user.id, coreAttemptId: input.attempt.coreAttemptId, kind: "final", status: { not: "cancelled" } }, select: { metadata: true } });
  if (!saved || (saved.metadata as Record<string, unknown>)?.deletion) throw new AppError(409, "COURSE_EXPORT_CHANGED", "The submitted work changed. Try the export again.");
  const content = await exportHomeworkSubmission(studentSubmissionExportInput(input));
  return { ...content, ...await studentHomeworkPrompt(input) };
};
