import { AppError } from "@cognelo/core";
import { exportRecord, exportText, feedbackExportBlocks, type AnswerExportBlock, type SubmissionExportHandler } from "@cognelo/activity-sdk/server";
import { prisma } from "./db-client";
import { getLatestCodingExerciseTestResult } from "./executions";
export const exportCodingSubmission: SubmissionExportHandler = async (input) => {
  const ref = input.pluginAttemptRef ?? exportText(input.state?.executionId);
  const execution = ref ? await prisma.pluginCodingExerciseExecution.findFirst({ where: { id: ref, activityId: input.activity.id, ...(input.userId ? { userId: input.userId } : {}) } }) : null;
  const source = execution?.sourceCode ?? input.state?.sourceCode ?? input.metadata.submittedSourceCode ?? exportRecord(input.metadata.timedOutDraft).sourceCode;
  if (ref && !execution && typeof source !== "string") throw new AppError(409, "ANSWER_EXPORT_SOURCE_MISSING", "The submitted source is unavailable.");
  const grading: AnswerExportBlock[] = [];
  if (input.includeGrading) {
    if (execution) {
      const latest = await getLatestCodingExerciseTestResult({ activityId: input.activity.id, executionId: execution.id, originalResultSummary: execution.resultSummary });
      const summary = exportRecord(latest.resultSummary);
      if (Array.isArray(summary.tests) && summary.tests.length) grading.push({ kind: "table", title: input.labels.tests,
        headers: [input.labels.test, input.labels.result, input.labels.weight, input.labels.comments], rows: summary.tests.map((value) => {
          const row = exportRecord(value);
          return [exportText(row.name), row.passed === true ? input.labels.passed : input.labels.failed, exportText(row.weight), exportText(row.message)];
        }) });
    }
    const savedFeedback = Object.keys(input.feedback).length || !execution ? null : await prisma.pluginCodingExerciseAiEvaluation.findFirst({
      where: { activityId: input.activity.id, executionId: execution.id, status: "completed" }, orderBy: { version: "desc" }, select: { sanitizedFeedback: true }
    });
    grading.push(...feedbackExportBlocks(savedFeedback?.sanitizedFeedback ?? input.feedback, input.labels));
  }
  return { prompt: input.includePrompt && typeof input.activity.config?.prompt === "string" && input.activity.config.prompt !== input.activity.description ? [{ kind: "markdown", text: input.activity.config.prompt }] : [], answer: [{ kind: "code", text: typeof source === "string" ? source : input.labels.noAnswer, language: exportText(input.activity.config?.language) }], grading };
};
