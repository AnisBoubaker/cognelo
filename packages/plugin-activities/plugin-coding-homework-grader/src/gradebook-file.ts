import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { AppError, assertCanGradeGroup } from "@cognelo/core";
import { prisma as coreDb } from "@cognelo/db";
import { prisma } from "./db-client";
import { readFrozenHomeworkFile } from "./hand-in";
import { isCodingHomeworkSubmissionDeleted } from "./submission-deletion";

/** Read one retained file from the exact learner/submission being reviewed. */
export const codingHomeworkGradebookFileRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/gradebook-file", activityTypeKeys: ["coding-homework-grader"],
  methods: { GET: async ({ context, request }) => {
    if (!context.courseId || !context.groupId) throw new AppError(400, "GROUP_CONTEXT_REQUIRED", "Submission files require a course and group context.");
    await assertCanGradeGroup(context.user, context.courseId, context.groupId);
    const params = new URL(request.url).searchParams;
    const participantId = params.get("participantId"), submissionId = params.get("attemptId"), filePath = params.get("path");
    if (!participantId || !submissionId || !filePath) throw new AppError(400, "HOMEWORK_REVIEW_FILE_REQUIRED", "Select a participant, submission and file.");
    const participant = await coreDb.courseGroupParticipant.findFirst({ where: { id: participantId, groupId: context.groupId, role: "student" }, select: { userId: true } });
    if (!participant?.userId) throw new AppError(404, "PARTICIPANT_NOT_FOUND", "The participant was not found.");
    const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({ where: { id: submissionId, activityId: context.activity.id, groupId: context.groupId, userId: participant.userId, kind: "final" } });
    if (!submission || isCodingHomeworkSubmissionDeleted(submission.metadata)) throw new AppError(404, "HOMEWORK_SUBMISSION_NOT_FOUND", "The submitted work was not found.");
    if (submission.coreAttemptId && !await coreDb.activityAttempt.findFirst({ where: { id: submission.coreAttemptId, courseId: context.courseId, groupId: context.groupId, activityId: context.activity.id, participantId, pluginKey: "coding-homework-grader" }, select: { id: true } })) {
      throw new AppError(404, "HOMEWORK_SUBMISSION_NOT_FOUND", "The submitted work was not found.");
    }
    const file = await prisma.pluginCodingHomeworkSubmissionFile.findUnique({ where: { submissionId_path: { submissionId, path: filePath } } });
    if (!file) throw new AppError(404, "HOMEWORK_FILE_NOT_FOUND", "The submitted file was not found.");
    return { path: file.path, text: (await readFrozenHomeworkFile(file)).toString("utf8").slice(0, 2_000_000) };
  } }
};
