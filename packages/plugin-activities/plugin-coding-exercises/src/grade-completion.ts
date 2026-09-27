import type { PluginGradeCompletionHandler } from "@cognelo/activity-sdk/server";
import { getCodingExercisePrivateConfig } from "./executions";

export const getCodingExerciseGradeCompletions: PluginGradeCompletionHandler = async ({ activityId, rows }) => {
  const privateConfig = await getCodingExercisePrivateConfig({ activityId });
  const requiresRubric = privateConfig.aiFeedback.gradingEnabled;

  return Object.fromEntries(rows.map((row) => {
    const requiredComponentCount = requiresRubric ? 2 : 1;
    const rubricScore = numberValue(row.gradingResult.aiScore)
      ?? numberValue(asRecord(row.gradingResult.studentFeedback).aiScore)
      ?? numberValue(row.feedback?.aiScore);
    const isComplete = row.gradeSource === "override" || !requiresRubric || rubricScore !== null;

    return [row.participantId, {
      status: isComplete ? "complete" : "partial",
      completedComponentCount: isComplete ? requiredComponentCount : 1,
      requiredComponentCount
    }];
  }));
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
