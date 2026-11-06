import { readHomeworkSubmissionPolicy, readHomeworkSubmissionTiming } from "./submission-policy";
import { acceptHomeworkSubmissionTiming, automaticHomeworkTiming, assertAutomaticHomeworkDraft, type AutomaticHomeworkHandIn } from "./submission-window";
import { snapshotProvidedCode } from "./provided-code";
import { studentQuestionContextInclude } from "./question-context";
import { getHomeworkQuestionLanguage } from "./question-generation-policy";
import { getHomeworkQuestionConnection } from "./ai-selection";
import { lockHomeworkUploadBudget } from "./upload-budget";
import { scheduleHomeworkDeadline } from "./deadline";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma as coreDb, type Prisma as CorePrisma } from "@cognelo/db";
import { AppError, activityTeamworkEnabled, lockActivityTeamwork, snapshotAiModelSelection, getActivityAttemptAvailability, resolveActivityTeamContext, enqueueBackgroundJob, startActivityAttempt, assignmentTimeLimitMinutes, assignmentAttemptExpiresAt, getTimedActivityRuntime, openStoredMaterial } from "@cognelo/core";
import { prisma } from "./db-client";
import { assertHomeworkStudentScope, lockHomeworkWorkflow, assertHomeworkDraftWritable, getHomeworkRequirements, readHomeworkDraftEntries, homeworkStorageRoot, json, record, type HomeworkStudentScope } from "./file-preparation";
import { lockHomeworkSettings } from "./workflow-settings";
import { validateCodingHomeworkArchive, codingHomeworkSubmissionReadiness } from "./validation";
import { startCodingHomeworkProcessingWorker, codingHomeworkProcessingQueue, codingHomeworkSubmissionProcessingHandlerKey } from "./background-processing";
import { toStudentChallengeQuestionRecord } from "./generation";

const activeWhere = (scope: HomeworkStudentScope) => ({ activityId: scope.activityId, groupId: scope.groupId, userId: scope.user.id, kind: "final" as const });
export async function handInHomework(scope: HomeworkStudentScope, input: unknown, automatic?: AutomaticHomeworkHandIn) {
  const activity = automatic ? await coreDb.activity.findFirstOrThrow({ where: { id: scope.activityId, courseId: scope.courseId }, include: { activityType: true } }) : await assertHomeworkStudentScope(scope);
  if (activity.activityType.key !== "coding-homework-grader") throw new AppError(404, "HOMEWORK_NOT_FOUND", "Coding Homework was not found.");
  if (activityTeamworkEnabled(activity.metadata)) return (await import("./team-submissions")).handInTeamHomework(scope, input, automatic);
  const data = z.object({ expectedRevision: z.number().int().min(0), acknowledgeIncomplete: z.boolean().default(false), locale: z.enum(["en", "fr", "zh", "ar"]).default("en") }).strict().parse(input);
  const availability = automatic ? null : await getActivityAttemptAvailability(scope.user, scope);
  if (availability && !availability.canStart) throw new AppError(409, availability.reason ?? "HOMEWORK_ATTEMPT_UNAVAILABLE", "A new submission is not currently available.");
  const submissionId = randomUUID(); let committed = false;
  const directory = path.join(homeworkStorageRoot(), "submissions", submissionId);
  try {
    await prisma.$transaction(async tx => {
      await lockActivityTeamwork(tx, scope.activityId);
      if (automatic) await resolveActivityTeamContext(scope.user, scope.courseId, scope.groupId, scope.activityId, tx);
      const [currentActivity] = await tx.$queryRaw<Array<{ metadata: unknown }>>`SELECT metadata FROM "Activity" WHERE id=${scope.activityId}`;
      if (activityTeamworkEnabled(currentActivity?.metadata)) throw new AppError(409, "HOMEWORK_TEAM_MODE_CHANGED", "The team settings changed. Reload this activity.");
      await lockHomeworkSettings(tx, scope.activityId); await lockHomeworkWorkflow(tx, scope);
      const latest = await tx.pluginCodingHomeworkSubmission.findFirst({ where: activeWhere(scope), orderBy: { createdAt: "desc" } });
      if (latest && latest.status !== "cancelled" && !record(latest.metadata).deletion && record(latest.metadata).draftRevision === data.expectedRevision) return;
      await assertHomeworkDraftWritable(tx, scope);
      const assignment = await tx.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId } });
      const settings = record(assignment?.settings);
      if (!assignment || settings.submissionsEnabled !== true || typeof settings.preparedSnapshotId !== "string") throw new AppError(409, "HOMEWORK_SUBMISSIONS_CLOSED", "Your teacher has not enabled final submissions yet.");
      if (automatic) automaticHomeworkTiming(settings, automatic); else acceptHomeworkSubmissionTiming(settings);
      const draft = await tx.pluginCodingHomeworkDraft.findUnique({ where: { activityId_groupId_userId: { activityId: scope.activityId, groupId: scope.groupId, userId: scope.user.id } } });
      if (!draft || draft.revision !== data.expectedRevision) throw new AppError(409, "HOMEWORK_DRAFT_CONFLICT", "Your prepared files changed. Reload them before submitting.");
      if (automatic) assertAutomaticHomeworkDraft(draft, latest, automatic);
      const entries = await readHomeworkDraftEntries(draft); const requirements = await getHomeworkRequirements(scope.activityId);
      const validation = await validateCodingHomeworkArchive({ entries, requirements, archiveSizeBytes: entries.reduce((sum, file) => sum + file.uncompressedSize, 0) });
      const readiness = codingHomeworkSubmissionReadiness(validation);
      await lockHomeworkUploadBudget(tx, scope.activityId, scope.user.id, entries.reduce((sum, file) => sum + file.uncompressedSize, 0));
      if (!readiness.canSubmit) throw new AppError(400, "HOMEWORK_FILES_INVALID", "Your work cannot be submitted until the file safety issues are resolved.");
      if (readiness.requiresAcknowledgement && !data.acknowledgeIncomplete && !automatic) throw new AppError(409, "HOMEWORK_INCOMPLETE_ACKNOWLEDGEMENT_REQUIRED", "Confirm that you are submitting incomplete work.", { issues: readiness.incomplete });
      const providedCode = await snapshotProvidedCode(scope.activityId, tx);
      const questionLanguage = await getHomeworkQuestionLanguage(scope.courseId);
      const questionGenerationAi = snapshotAiModelSelection(await getHomeworkQuestionConnection(scope, settings));
      const submissionTiming = automatic ? automaticHomeworkTiming(settings, automatic) : acceptHomeworkSubmissionTiming(settings);
      await tx.pluginCodingHomeworkSubmission.create({ data: { id: submissionId, ...activeWhere(scope), status: "uploaded", documentationSnapshotId: settings.preparedSnapshotId,
        structureValidationSummary: json(validation), metadata: json({ workflowVersion: 2, providedCode, questionGenerationAi, draftRevision: draft.revision, handInAt: submissionTiming.submittedAt, submissionTiming, ...(automatic ? { automaticHandIn: { cutoff: automatic.cutoff, recoveredAt: new Date().toISOString(), triggeredBy: automatic.triggeredBy, acknowledgementSource: "automatic_deadline" } } : {}), incompleteAcknowledged: readiness.requiresAcknowledgement, questionLanguage, requirements, folders: draft.folders,
          assignment: { candidateLimit: assignment.candidateLimit, languageKey: assignment.languageKey, promptMarkdown: assignment.promptMarkdown, generationInstructions: assignment.generationInstructions, questionCount: assignment.questionCount, retrievedExampleCount: assignment.retrievedExampleCount } }) } });
      await mkdir(path.join(directory, "files"), { recursive: true, mode: 0o750 });
      for (const entry of entries) {
        if (entry.isDirectory || !entry.content || !validation.validFiles.includes(entry.path)) continue;
        const storedName = `${submissionId}/files/${randomUUID()}-source`;
        await writeFile(path.join(homeworkStorageRoot(), "submissions", storedName), entry.content, { flag: "wx", mode: 0o640 });
        await tx.pluginCodingHomeworkSubmissionFile.create({ data: { submissionId, path: entry.path, languageKey: /\.(c|h)$/i.test(entry.path) ? "c" : null,
          sizeBytes: BigInt(entry.content.length), sha256: createHash("sha256").update(entry.content).digest("hex"), storedName } });
      }
      await enqueueBackgroundJob({ queue: codingHomeworkProcessingQueue, handlerKey: codingHomeworkSubmissionProcessingHandlerKey,
        idempotencyKey: `submission:${submissionId}`, maxAttempts: 3,
        metadata: { workflowVersion: 2, activityId: scope.activityId, groupId: scope.groupId, courseId: scope.courseId, userId: scope.user.id,
          concurrencyGroup: scope.activityId, concurrencyLimit: Math.max(1, Math.min(4, Number(settings.generationConcurrency ?? 2))) },
        payload: { ...scope, submissionId, questionLanguage, mode: "student", workflowVersion: 2 } }, tx);
    }, { timeout: 30_000, maxWait: 30_000 });
    committed = true; startCodingHomeworkProcessingWorker();
    return automatic ? null : getHomeworkWorkspace(scope);
  } finally { if (!committed) await rm(directory, { recursive: true, force: true }); }
}
export async function getHomeworkWorkspace(scope: HomeworkStudentScope) {
  const activity = await assertHomeworkStudentScope(scope);
  const automaticIssues = await (await import("./automatic-hand-in")).recoverHomeworkForStudent(scope);
  if (activityTeamworkEnabled(activity.metadata)) return { ...await (await import("./team-submissions")).getTeamHomeworkWorkspace(scope), automaticSubmissionIssue: automaticIssues.length > 0 };

  const [assignment, submission] = await Promise.all([
    prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId } }),
    prisma.pluginCodingHomeworkSubmission.findFirst({ where: activeWhere(scope), orderBy: { createdAt: "desc" }, include: { files: { orderBy: { path: "asc" } } } })
  ]);
  const active = submission && submission.status !== "cancelled" && !record(submission.metadata).deletion && submission.status !== "invalid_structure" ? submission : null;
  const job = active ? await coreDb.backgroundJob.findUnique({ where: { queue_idempotencyKey: { queue: codingHomeworkProcessingQueue, idempotencyKey: `submission:${active.id}` } } }) : null;
  const position = job?.status === "queued" ? 1 + await coreDb.backgroundJob.count({ where: { queue: job.queue, status: "queued", createdAt: { lt: job.createdAt } } }) : null;
  const canReadQuestions = Boolean(active && record(active.metadata).assessmentStartedAt);
  return { automaticSubmissionIssue: automaticIssues.length > 0, submissionPolicy: readHomeworkSubmissionPolicy(assignment?.settings), submissionsEnabled: record(assignment?.settings).submissionsEnabled === true,
    submission: active ? { automaticHandIn: Boolean(record(active.metadata).automaticHandIn), submissionTiming: readHomeworkSubmissionTiming(active.metadata), id: active.id, status: active.status, createdAt: active.createdAt.toISOString(), started: canReadQuestions, coreAttemptId: active.coreAttemptId,
      processingStatus: job?.status ?? null, generationIssue: record(job?.error).code === "HOMEWORK_NO_ELIGIBLE_CODE" ? "no_eligible_code" as const : null, queuePosition: position, questionCount: Number(record(record(active.metadata).assignment).questionCount ?? assignment?.questionCount ?? 3),
      files: active.files.map(file => ({ path: file.path, sizeBytes: Number(file.sizeBytes) })),
      incompleteAcknowledged: record(active.metadata).incompleteAcknowledged === true } : null,
    previousCancelled: submission?.status === "cancelled" };
}
/** This route remains SEB-guarded; the public workspace never returns challenge text. */
export async function getStartedHomeworkQuestions(scope: HomeworkStudentScope) {
  const activity = await assertHomeworkStudentScope(scope);
  const teamSubmission = activityTeamworkEnabled(activity.metadata) ? await (await import("./team-submissions")).getCurrentTeamHomeworkSubmission(scope) : null;
  if (activityTeamworkEnabled(activity.metadata) && !teamSubmission) throw new AppError(409, "HOMEWORK_ASSESSMENT_NOT_STARTED", "Click Answer challenge questions to begin.");
  const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({ where: { ...activeWhere(scope), ...(teamSubmission ? { id: teamSubmission.id } : {}) }, orderBy: { createdAt: "desc" }, include: { questions: { orderBy: { orderIndex: "asc" }, include: studentQuestionContextInclude } } });
  if (!submission || submission.status === "cancelled" || record(submission.metadata).deletion || !submission.coreAttemptId || !record(submission.metadata).assessmentStartedAt) throw new AppError(409, "HOMEWORK_ASSESSMENT_NOT_STARTED", "Click Answer challenge questions to begin.");
  if (teamSubmission) await (await import("./team-submissions")).assertCurrentTeamSubmissionAccess(scope, submission);
  return { questions: submission.questions.map(toStudentChallengeQuestionRecord), status: submission.status, submissionId: submission.id };
}
export async function startHomeworkAnswering(scope: HomeworkStudentScope, expectedSubmissionId?: string | null) {
  const activity = await assertHomeworkStudentScope(scope);
  const start = async (tx: CorePrisma.TransactionClient, teamSubmissionId: string | null = null) => {
    await lockHomeworkWorkflow(tx, scope);
    const [submission] = await tx.$queryRaw<Array<{ id: string; status: string; metadata: unknown; coreAttemptId: string | null }>>`SELECT id, status, metadata, "coreAttemptId" FROM "PluginCodingHomeworkSubmission"
      WHERE "activityId"=${scope.activityId} AND "groupId"=${scope.groupId} AND "userId"=${scope.user.id} AND kind='final' AND (${teamSubmissionId}::text IS NULL OR id=${teamSubmissionId}) ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`;
    if (!submission || record(submission.metadata).deletion || submission.status !== "challenge_ready") throw new AppError(409, "HOMEWORK_QUESTIONS_NOT_READY", "Wait until your challenge questions are ready.");
    if (record(submission.metadata).assessmentStartedAt) return;
    const startedAt = new Date().toISOString();
    const attempt = submission.coreAttemptId ? await tx.activityAttempt.findUniqueOrThrow({ where: { id: submission.coreAttemptId } }) : await startActivityAttempt(scope.user, { ...scope,
      pluginKey: "coding-homework-grader", pluginVersion: "0.1.0", pluginAttemptRef: submission.id,
      metadata: json({ ...(record(submission.metadata).workspaceId ? { teamwork: { workspaceId: record(submission.metadata).workspaceId, groupingId: record(submission.metadata).groupingId, teamId: record(submission.metadata).teamId, sharedSourceId: record(submission.metadata).sharedSourceId } } : {}), assessmentStartedAt: startedAt, submissionId: submission.id, timeLimitSnapshotMinutes: assignmentTimeLimitMinutes(activity.assignment.metadata) }) }, tx);
    if (attempt.lifecycle !== "started") throw new AppError(409, "HOMEWORK_ATTEMPT_CLOSED", "This answering attempt is already closed.");
    const deadline = assignmentAttemptExpiresAt(attempt.startedAt, assignmentTimeLimitMinutes(activity.assignment.metadata), activity.assignment.availableUntil) ?? activity.assignment.availableUntil;
    if (deadline) await scheduleHomeworkDeadline(scope, attempt.id, deadline, tx);
    const metadata = json({ ...record(submission.metadata), assessmentStartedAt: attempt.startedAt.toISOString() });
    await tx.$executeRaw`UPDATE "PluginCodingHomeworkSubmission" SET "coreAttemptId"=${attempt.id}, metadata=${JSON.stringify(metadata)}::jsonb, "updatedAt"=NOW() WHERE id=${submission.id}`;
  };
  if (activityTeamworkEnabled(activity.metadata)) {
    const { withHomeworkTeamWorkspace } = await import("./team-workspaces");
    const { currentTeamSubmission } = await import("./team-submissions");
    const { teamworkTransaction } = await import("@cognelo/core");
    await withHomeworkTeamWorkspace(scope, async (tx, access) => {
      const submission = await currentTeamSubmission(teamworkTransaction(tx), access);
      if (!submission) throw new AppError(409, "HOMEWORK_NOT_SUBMITTED", "Your team has not submitted its work.");
      if (submission.id !== expectedSubmissionId) throw new AppError(409, "HOMEWORK_MEMBERSHIP_CHANGED", "Your answering participation changed. Reload before starting.");
      await start(tx, submission.id);
    });
  } else await coreDb.$transaction(tx => start(tx));
  return { ...await getStartedHomeworkQuestions(scope), runtime: await getTimedActivityRuntime(scope.user, scope.courseId, scope.groupId, scope.activityId) };
}
export async function readFrozenHomeworkFile(file: { storedName: string; sizeBytes: bigint; sha256: string }) {
  const segments = file.storedName.split("/");
  if (segments.length < 2 || segments.some(segment => !/^[a-zA-Z0-9._-]+$/.test(segment) || segment === ".." || segment === ".")) throw new AppError(409, "HOMEWORK_FILE_INVALID", "Invalid stored source reference.");
  const handle = await openStoredMaterial(path.join(homeworkStorageRoot(), "submissions"), segments.slice(0, -1), segments.at(-1)!);
  try {
    if ((await handle.stat()).size > 8 * 1024 * 1024) throw new AppError(413, "HOMEWORK_FILE_LIMIT", "The source file exceeds its read limit.");
    const bytes = await handle.readFile();
    if (BigInt(bytes.length) !== file.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new AppError(409, "HOMEWORK_FILE_CHANGED", "The frozen source file could not be verified.");
    return bytes;
  } finally { await handle.close(); }
}
export async function getFrozenHomeworkFile(scope: HomeworkStudentScope, filePath: string) {
  const activity = await assertHomeworkStudentScope(scope);
  const submission = activityTeamworkEnabled(activity.metadata) ? await (await import("./team-submissions")).getCurrentTeamHomeworkSubmission(scope) : await prisma.pluginCodingHomeworkSubmission.findFirst({ where: activeWhere(scope), orderBy: { createdAt: "desc" } });
  if (!submission) throw new AppError(404, "HOMEWORK_NOT_SUBMITTED", "No submitted work was found.");
  const file = await prisma.pluginCodingHomeworkSubmissionFile.findUnique({ where: { submissionId_path: { submissionId: submission.id, path: filePath } } });
  if (!file) throw new AppError(404, "HOMEWORK_FILE_NOT_FOUND", "The file was not found.");
  const bytes = await readFrozenHomeworkFile(file);
  if (submission.workspaceId) await (await import("./team-submissions")).assertCurrentTeamSubmissionAccess(scope, submission);
  return { path: file.path, text: bytes.toString("utf8").slice(0, 2_000_000) };
}
