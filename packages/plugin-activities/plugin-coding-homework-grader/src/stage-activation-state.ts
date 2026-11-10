import { submissionStageActivationResolver } from "@cognelo/core";
import { prisma as coreDb } from "@cognelo/db";
import type { PluginTeamworkTransaction } from "@cognelo/activity-sdk/server";
import { homeworkSubmissionStages } from "./submission-stages";
import { homeworkQuestionsEnabled } from "./question-policy";
import { readHomeworkSubmissionPolicy } from "./submission-policy";
import { record } from "./file-preparation";

export const questionStageLocksReferences = (settings: Record<string, unknown>) => typeof settings.questionsStageEnabled === "boolean" ? settings.questionsStageEnabled : settings.submissionsEnabled === true;
export function homeworkStageConfiguration(value: unknown) {
  const settings = record(value), questions = homeworkQuestionsEnabled(settings);
  return { stages: homeworkSubmissionStages.map(stage => ({ ...stage, active: stage.id !== "questions" || questions })),
    defaults: { files: { ...readHomeworkSubmissionPolicy(settings), enabled: settings.submissionsEnabled === true }, questions: { enabled: typeof settings.questionsStageEnabled === "boolean" ? settings.questionsStageEnabled : true } } };
}
export async function homeworkStageEnabled(scope: { activityId: string; groupId: string; user: { id: string } }, stageId: "files" | "questions", transaction?: PluginTeamworkTransaction) {
  const query = transaction?.query ?? coreDb.$queryRaw.bind(coreDb);
  const [assignment] = await query<Array<{ settings: unknown }>>`SELECT settings FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${scope.activityId}`;
  return submissionStageActivationResolver({ $queryRaw: query }, scope.activityId, homeworkStageConfiguration(assignment?.settings))({ groupId: scope.groupId, userId: scope.user.id, stageId });
}
