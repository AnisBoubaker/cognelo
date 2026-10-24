import { AppError } from "@cognelo/core";
import { exportRecord, exportText, feedbackExportBlocks, type SubmissionExportHandler } from "@cognelo/activity-sdk/server";
import { prisma } from "./db-client";
export const exportParsonsSubmission: SubmissionExportHandler = async (input) => {
  const saved = input.state ?? (input.metadata.submittedState ? exportRecord(input.metadata.submittedState) : null);
  const attempt = !saved && input.pluginAttemptRef ? await prisma.pluginParsonsAttempt.findFirst({ where: { id: input.pluginAttemptRef, activityId: input.activity.id, ...(input.userId ? { userId: input.userId } : {}) } }) : null;
  if (input.pluginAttemptRef && !saved && !attempt) throw new AppError(409, "ANSWER_EXPORT_SOURCE_MISSING", "The submitted arrangement is unavailable.");
  const state = saved ?? exportRecord(attempt?.latestState);
  const blocks = Array.isArray(state.blocks) ? state.blocks.map(exportRecord) : [];
  const text = blocks.map((block) => input.activity.config?.stripIndentation
    ? `${"  ".repeat(Math.max(0, Math.min(80, Number(block.currentIndent) || 0)))}${exportText(block.displayText).trimStart()}`
    : exportText(block.displayText)).join("\n");
  return { prompt: input.includePrompt && typeof input.activity.config?.prompt === "string" && input.activity.config.prompt !== input.activity.description ? [{ kind: "markdown", text: input.activity.config.prompt }] : [], answer: [{ kind: "code", text: text || input.labels.noAnswer, language: exportText(input.activity.config?.language) }], grading: input.includeGrading ? feedbackExportBlocks(input.feedback, input.labels) : [] };
};
