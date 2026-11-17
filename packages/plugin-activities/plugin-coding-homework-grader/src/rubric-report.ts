import type { PluginStudentGradeReportHandler } from "@cognelo/activity-sdk/server";
import { prisma as coreDb } from "@cognelo/db";
import { prisma } from "./db-client";
import { studentQuestionContext, studentQuestionContextInclude } from "./question-context";
import { record } from "./file-preparation";

/** The learner's released result, never model artifacts, directions, solutions or private config. */
export const getHomeworkStudentGradeReport: PluginStudentGradeReportHandler = async input => {
  if (input.testItemId) return null;
  const grade = await coreDb.grade.findFirst({ where: { isActive: true, userId: input.user.id,
    gradebookItemId: input.gradebookItemId, gradebookItem: { courseId: input.courseId, groupId: input.groupId, activityId: input.activityId, gradesReleased: true },
    participant: { userId: input.user.id, groupId: input.groupId, role: "student" } }, include: { selectedAttempt: true } });
  const attempt = grade?.selectedAttempt ?? (grade && ["manual", "override"].includes(grade.source) ? await coreDb.activityAttempt.findFirst({ where: { gradebookItemId: grade.gradebookItemId, participantId: grade.participantId, userId: input.user.id, assessmentMode: "summative", lifecycle: { in: ["submitted", "graded"] } }, orderBy: { attemptNumber: "desc" } }) : null);
  if (!attempt || attempt.userId !== input.user.id || attempt.assessmentMode !== "summative" || !["submitted", "graded"].includes(attempt.lifecycle)) return null;
  const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({ where: { id: attempt.pluginAttemptRef ?? "", coreAttemptId: attempt.id, activityId: input.activityId,
    groupId: input.groupId, userId: input.user.id, kind: "final", status: { not: "cancelled" } },
    include: { questions: { orderBy: { orderIndex: "asc" }, include: studentQuestionContextInclude } } });
  if (!submission || record(submission.metadata).deletion) return null;
  return { kind: "coding-homework-grader", questions: submission.questions.map(question => ({ id: question.id, questionText: question.questionText,
    studentAnswer: question.studentAnswer ?? "", context: studentQuestionContext(question) })) };
};
