import { getWebDesignExpectedResult } from "./tests";
import { webDesignExpectedResultTokenPattern, webDesignPromptIncludesExpectedResult } from "./web-design-coding-exercises";
import { AppError } from "@cognelo/core";
import { exportRecord, exportText, feedbackExportBlocks, type AnswerExportBlock, type SubmissionExportHandler } from "@cognelo/activity-sdk/server";
import { prisma } from "./db-client";
export const exportWebDesignSubmission: SubmissionExportHandler = async (input) => {
  const id = input.pluginAttemptRef ?? exportText(input.state?.submissionId);
  const submission = id ? await prisma.pluginWebDesignExerciseSubmission.findFirst({ where: { id, activityId: input.activity.id, ...(input.userId ? { userId: input.userId } : {}) }, include: { testResults: { orderBy: { createdAt: "asc" } } } }) : null;
  const source = submission?.files ?? input.state?.files ?? input.metadata.submittedFiles ?? exportRecord(input.metadata.timedOutDraft).files;
  const files = Array.isArray(source) ? source.map(exportRecord) : [];
  if (id && !submission && !Array.isArray(source)) throw new AppError(409, "ANSWER_EXPORT_SOURCE_MISSING", "The submitted files are unavailable.");
  const answer: AnswerExportBlock[] = files.map((file) => ({ kind: "code", title: exportText(file.path), text: exportText(file.content ?? file.starterCode), language: exportText(file.language) }));
  const grading: AnswerExportBlock[] = input.includeGrading ? feedbackExportBlocks(input.feedback, input.labels) : [];
  if (input.includeGrading && submission?.testResults.length) grading.unshift({ kind: "table", title: input.labels.tests,
    headers: [input.labels.test, input.labels.result, input.labels.score, input.labels.comments], rows: submission.testResults.map((row) => [row.name, row.status === "completed" && (row.score ?? 0) >= row.weight ? input.labels.passed : input.labels.failed, `${row.score ?? "-"} / ${row.weight}`, row.message ?? ""]) });
  const rawPrompt = exportText(input.activity.config?.prompt);
  let prompt = rawPrompt;
  if (input.includePrompt && webDesignPromptIncludesExpectedResult(rawPrompt)) {
    const image = await getWebDesignExpectedResult({ activityId: input.activity.id, activityConfig: input.activity.config });
    prompt = rawPrompt.replace(webDesignExpectedResultTokenPattern, image.imageDataUrl ? `![${input.labels.prompt}](${image.imageDataUrl})` : input.labels.unavailable);
  }
  return { replaceDescription: Boolean(rawPrompt && rawPrompt === input.activity.description), prompt: input.includePrompt && prompt ? [{ kind: "markdown", text: prompt }] : [], answer: answer.length ? answer : [{ kind: "markdown", text: input.labels.noAnswer }], grading };
};
