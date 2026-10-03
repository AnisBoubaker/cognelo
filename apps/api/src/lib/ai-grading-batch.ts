import { AppError } from "@cognelo/core";

export function validateAiGradingTemplateAttemptIds(targetAttemptId: string, templateAttemptIds: readonly string[]) {
  const uniqueTemplateIds = [...new Set(templateAttemptIds)];
  if (uniqueTemplateIds.length !== templateAttemptIds.length) {
    throw new AppError(400, "AI_BATCH_TEMPLATE_DUPLICATE", "Each grading template may be selected only once.");
  }
  if (uniqueTemplateIds.includes(targetAttemptId)) {
    throw new AppError(400, "AI_BATCH_TEMPLATE_TARGET_MATCH", "A selected grading template cannot be graded again in the same batch.");
  }
  return uniqueTemplateIds;
}
