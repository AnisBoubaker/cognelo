import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import {
  codingExerciseGeneratePromptRoute,
  codingExerciseGenerateRubricRoute,
  codingExerciseGenerateSolutionRoute,
  codingExerciseGenerateTestsRoute,
  codingExerciseHistoryRoute,
  codingExerciseHiddenTestsRoute,
  codingExerciseRunRoute,
  codingExerciseReviewAllRoute,
  codingExerciseSubmitRoute
} from "./routes";
import { copyBankCodingExerciseData, copyBankCodingExerciseDataToCourseActivity, copyCourseCodingExerciseData, copyCourseCodingExerciseDataToBankActivity, deleteBankCodingExerciseData, deleteCourseCodingExerciseData } from "./hidden-tests";
import {
  codingExerciseRunInputSchema,
  codingExerciseSubmitInputSchema,
  runCodingExercise,
  submitCodingExercise
} from "./executions";
import { AppError } from "@cognelo/core";
import { createCodingExerciseTeacherFeedbackDraft, evaluateCodingExerciseAttemptWithAi, getCodingExerciseAiFeedbackTeacherSubmission, reviseCodingExerciseAiFeedback, snapshotCodingExerciseAiFeedbackConfig } from "./ai-feedback";
import { regradeCodingExerciseAttempt } from "./regrading";

export const codingExercisesServerPlugin: ServerActivityPlugin = {
  key: "coding-exercises",
  routes: [
    codingExerciseRunRoute,
    codingExerciseReviewAllRoute,
    codingExerciseSubmitRoute,
    codingExerciseHistoryRoute,
    codingExerciseHiddenTestsRoute,
    codingExerciseGeneratePromptRoute,
    codingExerciseGenerateSolutionRoute,
    codingExerciseGenerateRubricRoute,
    codingExerciseGenerateTestsRoute
  ],
  grading: {
    gradeAttempt: async ({ user, courseId, groupId, activityId, coreAttemptId, pluginAttemptRef, activity }) => {
      if (!pluginAttemptRef) {
        throw new AppError(409, "CODING_EXERCISE_SUBMISSION_REQUIRED", "This attempt does not reference a coding exercise submission.");
      }
      return regradeCodingExerciseAttempt({
        user, courseId, groupId, activityId, coreAttemptId, executionId: pluginAttemptRef, activity
      });
    }
  },
  aiFeedback: {
    evaluateAttempt: async ({ user, courseId, groupId, activityId, coreAttemptId, pluginAttemptRef, activity, triggerKind }) => {
      if (!pluginAttemptRef) {
        throw new AppError(409, "CODING_EXERCISE_SUBMISSION_REQUIRED", "This attempt does not reference a coding exercise submission.");
      }
      return evaluateCodingExerciseAttemptWithAi({
        user,
        courseId,
        groupId,
        activityId,
        coreAttemptId,
        executionId: pluginAttemptRef,
        activity,
        assessmentMode: "summative",
        triggerKind
      });
    },
    teacherReview: {
      createFeedbackDraft: async ({ activityId, pluginAttemptRef }) => {
        if (!pluginAttemptRef) {
          throw new AppError(409, "CODING_EXERCISE_SUBMISSION_REQUIRED", "This attempt does not reference a coding exercise submission.");
        }
        return createCodingExerciseTeacherFeedbackDraft({ activityId, executionId: pluginAttemptRef });
      },
      getSubmission: async ({ activityId, pluginAttemptRef, activity }) => {
        if (!pluginAttemptRef) {
          throw new AppError(409, "CODING_EXERCISE_SUBMISSION_REQUIRED", "This attempt does not reference a coding exercise submission.");
        }
        return getCodingExerciseAiFeedbackTeacherSubmission({ activityId, executionId: pluginAttemptRef, activity });
      },
      reviseFeedback: ({ currentFeedback, feedback, pluginAttemptRef }) => {
        const revisedFeedback = reviseCodingExerciseAiFeedback(currentFeedback, feedback);
        const combinedScore = numberValue(revisedFeedback.combinedScore);
        const rubricScoreChanged = haveRubricScoresChanged(currentFeedback.criteria, revisedFeedback.criteria);
        return {
          feedback: revisedFeedback,
          ...(revisedFeedback.gradingEnabled === true && combinedScore !== null && rubricScoreChanged ? {
            gradingResult: {
              rawScore: combinedScore,
              rawMaxScore: 100,
              analyticsPayload: {
                deterministicScore: revisedFeedback.deterministicScore,
                aiScore: revisedFeedback.aiScore,
                combinedScore,
                feedbackRef: revisedFeedback.feedbackRef
              },
              metadata: {
                kind: "coding-exercise",
                ...(pluginAttemptRef ? { executionId: pluginAttemptRef } : {}),
                deterministicScore: revisedFeedback.deterministicScore,
                aiScore: revisedFeedback.aiScore,
                combinedScore
              }
            }
          } : {})
        };
      }
    }
  },
  compositeExecution: {
    activityTypeKeys: ["coding-exercise"],
    actions: {
      run: async ({ activity, payload, user }) => ({
        execution: await runCodingExercise({
          activityId: activity.id,
          userId: user.id,
          activityConfig: activity.config,
          input: codingExerciseRunInputSchema.parse(payload)
        })
      })
    },
    submit: async ({ activity, payload, user }) => {
      const input = codingExerciseSubmitInputSchema.parse(payload);
      const execution = await submitCodingExercise({
        activityId: activity.id,
        userId: user.id,
        activityConfig: activity.config,
        input
      });
      await snapshotCodingExerciseAiFeedbackConfig({ activityId: activity.id, executionId: execution.id });
      const earnedWeight = numberValue(execution.resultSummary.earnedWeight);
      const totalWeight = numberValue(execution.resultSummary.totalWeight);
      if (earnedWeight === null || totalWeight === null || totalWeight <= 0) {
        throw new AppError(409, "CODING_EXERCISE_RESULT_INVALID", "The coding exercise did not return a valid weighted result.");
      }
      return {
        state: { sourceCode: input.sourceCode, executionId: execution.id },
        gradingResult: {
          rawScore: earnedWeight,
          rawMaxScore: totalWeight,
          analyticsPayload: execution.resultSummary,
          metadata: { kind: "coding-exercise", executionId: execution.id }
        }
      };
    }
  },
  hooks: {
    onCourseActivityPublishedToBank: async ({ activity, bankActivityId }) => {
      if (activity.activityType.key === "coding-exercise") await copyCourseCodingExerciseDataToBankActivity({ activityId: activity.id, bankActivityId });
    },
    onCourseActivityDuplicated: async ({ sourceActivityId, activity }) => {
      if (activity.activityType.key === "coding-exercise") {
        await copyCourseCodingExerciseData({ sourceActivityId, activityId: activity.id });
      }
    },
    onCourseActivityCreatedFromBankVersion: async ({ activity, bankActivityId }) => {
      if (activity.activityType.key !== "coding-exercise") {
        return;
      }

      await copyBankCodingExerciseDataToCourseActivity({
        bankActivityId,
        activityId: activity.id
      });
    },
    onBankActivityDeleted: async ({ activityTypeKey, bankActivityId }) => {
      if (activityTypeKey !== "coding-exercise") {
        return;
      }

      await deleteBankCodingExerciseData({ bankActivityId });
    },
    onBankActivityDuplicated: async ({ activityTypeKey, sourceBankActivityId, bankActivityId }) => {
      if (activityTypeKey === "coding-exercise") {
        await copyBankCodingExerciseData({ sourceBankActivityId, bankActivityId });
      }
    },
    onCourseActivityDeleted: async ({ activityTypeKey, activityId }) => {
      if (activityTypeKey === "coding-exercise") {
        await deleteCourseCodingExerciseData({ activityId });
      }
    }
  }
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function haveRubricScoresChanged(currentValue: unknown, revisedValue: unknown) {
  const current = rubricScoresById(currentValue);
  const revised = rubricScoresById(revisedValue);
  return revised.size !== current.size || [...revised].some(([id, score]) => current.get(id) !== score);
}

function rubricScoresById(value: unknown) {
  const scores = new Map<string, number>();
  if (!Array.isArray(value)) return scores;
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const criterion = entry as Record<string, unknown>;
    const score = numberValue(criterion.scorePercent);
    if (typeof criterion.id === "string" && score !== null) scores.set(criterion.id, score);
  });
  return scores;
}
