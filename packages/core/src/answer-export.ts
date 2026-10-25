import { prisma, type Prisma } from "@cognelo/db";
import { AnswerExportRequestSchema, type AnswerExportStudent, type CurrentUser } from "@cognelo/contracts";
import { exportRecord, getSubmissionExportHandler, type AnswerExportBlock, type AnswerExportLabels, type ServerActivityRecord, type SubmissionExportInput } from "@cognelo/activity-sdk/server";
import { assertCanViewCourseGradebook } from "./authorization";
import { AppError, forbidden, notFound } from "./errors";
import { getCourseTimeSettings } from "./course-time";

export type AnswerExportSection = { promptPdfs?: Array<{ name: string; bytes: Uint8Array }>; title: string; prompt: AnswerExportBlock[]; answer: AnswerExportBlock[]; grading: AnswerExportBlock[]; score?: string | null };
export type AnswerExportDocument = { gradebookGrade?: string | null; gradebookComment?: string; participantId: string; name: string; email: string; groupTitle: string;
  attempts: Array<{ id: string; number: number; submittedAt: string | null; score?: string | null; sections: AnswerExportSection[] }> };

async function exportScope(user: CurrentUser, courseId: string, activityId: string, groupId?: string) {
  const capabilities = await assertCanViewCourseGradebook(user, courseId);
  if (groupId && capabilities.gradingGroupIds !== null && !capabilities.gradingGroupIds.includes(groupId)) throw forbidden();
  const activity = await prisma.activity.findFirst({ where: { id: activityId, courseId }, include: { activityType: true, course: { select: { title: true, subject: { select: { title: true } } } } } });
  if (!activity) throw notFound("Activity");
  if (activity.activityType.key !== "test" && !getSubmissionExportHandler(activity.activityType.key)) throw new AppError(409, "ANSWER_EXPORT_UNSUPPORTED", "Answer export is not supported for this activity type.");
  const where: Prisma.ActivityAttemptWhereInput = { courseId, activityId, lifecycle: { in: ["submitted", "graded"] },
    participant: { role: "student" }, ...(groupId ? { groupId } : capabilities.gradingGroupIds !== null ? { groupId: { in: capabilities.gradingGroupIds } } : {}) };
  return { activity, where };
}

export async function listAnswerExportStudents(user: CurrentUser, courseId: string, activityId: string, groupId?: string): Promise<AnswerExportStudent[]> {
  const { where } = await exportScope(user, courseId, activityId, groupId);
  const attempts = await prisma.activityAttempt.findMany({ where, orderBy: [{ attemptNumber: "desc" }, { id: "desc" }], select: {
    id: true, participantId: true, groupId: true, attemptNumber: true, submittedAt: true, assessmentMode: true,
    participant: { select: { firstName: true, lastName: true, email: true } }, group: { select: { title: true } }
  } });
  const students = new Map<string, AnswerExportStudent>();
  for (const attempt of attempts) {
    let student = students.get(attempt.participantId);
    if (!student) {
      student = { participantId: attempt.participantId, name: [attempt.participant.firstName, attempt.participant.lastName].filter(Boolean).join(" ") || attempt.participant.email,
        email: attempt.participant.email, groupId: attempt.groupId, groupTitle: attempt.group.title, attempts: [] };
      students.set(student.participantId, student);
    }
    student.attempts.push({ id: attempt.id, attemptNumber: attempt.attemptNumber, submittedAt: attempt.submittedAt?.toISOString() ?? null, assessmentMode: attempt.assessmentMode });
  }
  return [...students.values()].sort((a, b) => a.name.localeCompare(b.name) || a.groupTitle.localeCompare(b.groupTitle) || a.participantId.localeCompare(b.participantId));
}

export async function buildAnswerExport(user: CurrentUser, courseId: string, activityId: string, value: unknown, labels: AnswerExportLabels) {
  const input = AnswerExportRequestSchema.parse(value);
  const { activity, where } = await exportScope(user, courseId, activityId, input.groupId);
  const ids = [...new Set(input.participantIds)];
  const students = await listAnswerExportStudents(user, courseId, activityId, input.groupId);
  const selected = students.filter((student) => ids.includes(student.participantId));
  if (selected.length !== ids.length) throw new AppError(400, "ANSWER_EXPORT_SUBMISSION_REQUIRED", "Every selected student must have a submitted attempt in the permitted section.");
  const selectedAttemptIds = selected.flatMap((student) => input.attemptId
    ? student.attempts.filter((attempt) => attempt.id === input.attemptId).map((attempt) => attempt.id)
    : (input.attempts === "latest" ? student.attempts.slice(0, 1) : student.attempts).map((attempt) => attempt.id));
  if (!selectedAttemptIds.length) throw new AppError(400, "ANSWER_EXPORT_ATTEMPT_INVALID", "The selected submission does not belong to this student.");
  if (selectedAttemptIds.length > 1000) throw new AppError(413, "ANSWER_EXPORT_TOO_LARGE", "Select fewer students or attempts for this export.");
  // Check the database payload before materializing large histories in Node.
  const [size] = await prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT (COALESCE(SUM(
    octet_length(a.metadata::text)
    + COALESCE((SELECT SUM(octet_length(c.result::text) + octet_length(c.feedback::text) + octet_length(v.config::text) + octet_length(v.metadata::text))
      FROM "TestItemAttempt" c JOIN "Activity" v ON v.id = c."activityId" WHERE c."parentAttemptId" = a.id), 0)
    + COALESCE((SELECT SUM(octet_length(r.config::text) + octet_length(r.metadata::text) + octet_length(r.description))
      FROM "TestRevisionItem" r WHERE r."testRevisionId" = a."testRevisionId"), 0)
    + COALESCE((SELECT SUM(octet_length(g."normalizedResult"::text)) FROM "Grade" g WHERE g."selectedAttemptId" = a.id AND g."isActive"), 0)
    + COALESCE((SELECT octet_length(e."nextValue"::text) FROM "GradeEvent" e WHERE e."attemptId" = a.id
      AND e."eventType" IN ('auto_graded', 'manual_graded', 'overridden', 'regraded', 'submission_reopened') ORDER BY e."createdAt" DESC, e.id DESC LIMIT 1), 0)
  ), 0) + COALESCE((SELECT SUM(octet_length(g."normalizedResult"::text)) FROM "Grade" g JOIN "GradebookItem" i ON i.id = g."gradebookItemId"
    WHERE ${input.includeGrading} AND g."isActive" AND i."courseId" = ${courseId} AND i."activityId" = ${activityId} AND g."participantId" = ANY(${ids}::text[])), 0)
  )::bigint AS bytes FROM "ActivityAttempt" a WHERE a.id = ANY(${selectedAttemptIds}::text[])`;
  if (size.bytes > 32_000_000n) throw exportTooLarge();
  const budget = { remainingBytes: 64_000_000 };
  const attempts = await prisma.activityAttempt.findMany({ where: { ...where, id: { in: selectedAttemptIds }, participantId: { in: ids } }, include: {
    selectedForGrades: { where: { isActive: true }, select: { normalizedScore: true, normalizedMaxScore: true, normalizedResult: true } },
    gradeEvents: { where: { eventType: { in: ["auto_graded", "manual_graded", "overridden", "regraded", "submission_reopened"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { eventType: true, nextValue: true } },
    testRevision: { include: { items: true } }, testItemAttempts: { include: { activity: { include: { activityType: true } } } }
  } });
  if (attempts.length !== selectedAttemptIds.length) throw new AppError(409, "ANSWER_EXPORT_CHANGED", "Submissions changed. Refresh the selection and try again.");
  const { timeZone } = await getCourseTimeSettings(user, courseId);
  const currentGrades = input.includeGrading ? await prisma.grade.findMany({ where: { participantId: { in: ids }, gradebookItem: { courseId, activityId }, isActive: true },
    select: { participantId: true, normalizedScore: true, normalizedMaxScore: true, normalizedResult: true, source: true } }) : [];
  const documents: AnswerExportDocument[] = [];
  for (const student of selected) {
    const currentGrade = currentGrades.find((grade) => grade.participantId === student.participantId);
    const gradebookComment = exportRecord(exportRecord(currentGrade?.normalizedResult).studentFeedback).feedbackText;
    const document: AnswerExportDocument = { ...student, attempts: [], ...(input.includeGrading ? {
      gradebookGrade: numericScore(currentGrade?.normalizedScore, currentGrade?.normalizedMaxScore),
      ...(currentGrade?.source === "override" && typeof gradebookComment === "string" ? { gradebookComment } : {})
    } : {}) };
    for (const attempt of attempts.filter((item) => item.participantId === student.participantId).sort((a, b) => a.attemptNumber - b.attemptNumber)) {
      const metadata = exportRecord(attempt.metadata);
      const selectedGrade = attempt.selectedForGrades[0];
      const snapshot = selectedGrade ?? (attempt.gradeEvents[0]?.eventType !== "submission_reopened" ? exportRecord(attempt.gradeEvents[0]?.nextValue) : {});
      const result = exportRecord(snapshot.normalizedResult);
      const storedFeedback = exportRecord(result.studentFeedback);
      const feedback = Object.keys(storedFeedback).length ? { ...exportRecord(storedFeedback.details), ...storedFeedback } : exportRecord(metadata.teacherFeedback);
      const context = { user, userId: attempt.userId, courseId, groupId: attempt.groupId, participantId: attempt.participantId, coreAttemptId: attempt.id,
        pluginAttemptRef: attempt.pluginAttemptRef, metadata, feedback, includePrompt: input.includePrompt, includeGrading: input.includeGrading, labels };
      const sections: AnswerExportSection[] = [];
      if (activity.activityType.key === "test") {
        const manifest = exportRecord(metadata.submissionManifest ?? metadata.manifest);
        const items = Array.isArray(manifest.items) ? manifest.items.map(exportRecord) : [];
        if (!items.length) throw new AppError(409, "ANSWER_EXPORT_MANIFEST_MISSING", "The submitted Test exercise list is unavailable.");
        if (input.includePrompt && activity.description) {
          consumeExportBudget(activity.description, budget);
          sections.push({ title: activity.title, prompt: [{ kind: "markdown", text: activity.description }], answer: [], grading: [] });
        }
        for (const item of items) {
          const child = attempt.testItemAttempts.find((entry) => entry.testItemId === item.testItemId);
          if (!child) throw new AppError(409, "ANSWER_EXPORT_CHILD_MISSING", "A submitted Test exercise is unavailable.");
          const revision = attempt.testRevision?.items.find((entry) => entry.sourceTestItemId === child.testItemId);
          const childActivity: ServerActivityRecord = { ...child.activity, title: revision?.title ?? child.activity.title, description: revision?.description ?? child.activity.description,
            config: exportRecord(revision?.config ?? exportRecord(child.result).configSnapshot ?? child.activity.config), metadata: exportRecord(child.activity.metadata) };
          sections.push({ ...await projectAnswer({ ...context, activity: childActivity, pluginAttemptRef: child.pluginAttemptRef, state: exportRecord(exportRecord(child.result).state), feedback: { ...exportRecord(exportRecord(child.feedback).aiFeedback), ...exportRecord(child.feedback) } }, budget),
            title: `${sections.filter((section) => section.answer.length).length + 1}. ${childActivity.title}`,
            ...(input.includeGrading ? { score: numericScore(child.normalizedScore, child.normalizedMaxScore) } : {}) });
        }
      } else sections.push(await projectAnswer({ ...context, activity: { ...activity, config: exportRecord(activity.config), metadata: exportRecord(activity.metadata) }, state: metadata.timedOut ? exportRecord(metadata.savedResponse) : null }, budget));
      document.attempts.push({ id: attempt.id, number: attempt.attemptNumber, submittedAt: attempt.submittedAt?.toISOString() ?? null,
        ...(input.includeGrading ? { score: numericScore(snapshot.normalizedScore, snapshot.normalizedMaxScore) } : {}), sections });
    }
    documents.push(document);
  }
  return { documents, courseTitle: activity.course.title, subjectTitle: activity.course.subject.title, activityTitle: activity.title, timeZone, options: input };
}

async function projectAnswer(input: SubmissionExportInput, budget: { remainingBytes: number }): Promise<AnswerExportSection> {
  const handler = getSubmissionExportHandler(input.activity.activityType.key);
  if (!handler) throw new AppError(409, "ANSWER_EXPORT_UNSUPPORTED", "A submitted exercise type does not support answer export.");
  const content = await handler(input);
  const section: AnswerExportSection = { title: input.activity.title,
    ...(input.includePrompt && content.promptPdfs?.length ? { promptPdfs: content.promptPdfs } : {}),
    prompt: input.includePrompt ? [...(!content.replaceDescription && input.activity.description ? [{ kind: "markdown" as const, text: input.activity.description }] : []), ...(content.prompt ?? [])] : [],
    answer: content.answer, grading: input.includeGrading ? content.grading ?? [] : [] };
  consumeExportBudget(section, budget);
  return section;
}
function exportTooLarge() { return new AppError(413, "ANSWER_EXPORT_TOO_LARGE", "Select fewer students or attempts for this export."); }
function consumeExportBudget(value: unknown, budget: { remainingBytes: number }) {
  const pending = [value];
  while (pending.length) {
    const entry = pending.pop();
    if (typeof entry === "string") budget.remainingBytes -= Buffer.byteLength(entry);
    else if (ArrayBuffer.isView(entry)) budget.remainingBytes -= entry.byteLength;
    else if (entry && typeof entry === "object") for (const child of Object.values(entry)) pending.push(child);
    if (budget.remainingBytes < 0) throw exportTooLarge();
  }
}
function numericScore(score: unknown, maximum: unknown) { return typeof score === "number" && typeof maximum === "number" ? `${score} / ${maximum}` : null; }
