import { snapshotProvidedCode, readProvidedCodeBaseline, selectLearnerFunctions, cSourceFingerprint, unchangedProvidedFunctionNames } from "./provided-code";
import { parseChallengeQuestionResponse } from "./question-response";
import { getHomeworkQuestionLanguage, homeworkQuestionSystemPrompt } from "./question-generation-policy";
import { makeStudentQuestionContext, type StudentQuestionContext } from "./question-context";
import { getHomeworkQuestionConnection, storedHomeworkAiSelection } from "./ai-selection";
import { randomUUID } from "node:crypto";
import { prisma as coreDb } from "@cognelo/db";
import { NonRetryableBackgroundJobError, createPreparedMaterialSearch, generateAiAgentText, getCourseAiAgentConnection, lockActivityTeamwork, lockStudentGroupingWorkspaces, teamworkTransaction, type BackgroundJobRecord } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { prisma } from "./db-client";
import { readFrozenHomeworkFile } from "./hand-in";
import { record, json, lockHomeworkWorkflow } from "./file-preparation";
import { parseCodingHomeworkSourceFiles } from "./parsers";

export async function processPreparedHomework(job: BackgroundJobRecord) {
  const submissionId = String(job.payload.submissionId);
  const scope = { activityId: String(job.payload.activityId), courseId: String(job.payload.courseId), groupId: String(job.payload.groupId), user: job.payload.user as CurrentUser };
  const submission = await prisma.pluginCodingHomeworkSubmission.findUnique({ where: { id: submissionId }, include: { files: true, documentationSnapshot: true } });
  if (!submission || submission.status === "cancelled" || record(submission.metadata).deletion) return { cancelled: true };
  if (["challenge_ready", "ready_for_grading", "graded"].includes(submission.status)) return { submissionId, alreadyReady: true };
  const metadata = record(submission.metadata), settings = record(metadata.assignment);
  const team = submission.workspaceId ? await import("./team-submissions") : null;
  if (team) {
    await team.assertTeamGenerationCurrent(teamworkTransaction(prisma), submission);
    scope.user = { ...scope.user, id: await team.currentTeamGenerationActor(submission) };
  }
  const current = await coreDb.user.findUnique({ where: { id: scope.user.id }, select: { isActive: true, email: true, name: true, firstName: true, lastName: true, roles: { include: { role: true } } } });
  if (!current?.isActive) throw new NonRetryableBackgroundJobError("The submitting account is no longer active.");
  scope.user = { id: scope.user.id, email: current.email, name: current.name, firstName: current.firstName, lastName: current.lastName, roles: current.roles.map(entry => entry.role.key) as CurrentUser["roles"] };
  const leaseIsCurrent = async () => {
    const row = await coreDb.backgroundJob.findUnique({ where: { id: job.id } });
    if (!row || row.status !== "running" || row.lockedBy !== job.lockedBy) throw new NonRetryableBackgroundJobError("This generation job was cancelled or replaced.", "HOMEWORK_JOB_REPLACED");
  };
  await leaseIsCurrent();
  await prisma.pluginCodingHomeworkSubmission.updateMany({ where: { id: submissionId, status: { in: ["uploaded", "processing", "failed"] } }, data: { status: "processing", processingError: null } });
  try {
    const sources = [];
    for (const file of submission.files.filter(file => file.languageKey === "c")) sources.push({ path: file.path, languageKey: "c", content: (await readFrozenHomeworkFile(file)).toString("utf8") });
    const parsed = await parseCodingHomeworkSourceFiles(sources);
    const providedCode = readProvidedCodeBaseline(metadata.providedCode) ?? await snapshotProvidedCode(scope.activityId);
    if (!metadata.providedCode) await prisma.pluginCodingHomeworkSubmission.updateMany({ where: { id: submissionId, status: "processing" }, data: { metadata: json({ ...metadata, providedCode }) } });
    const comparison = selectLearnerFunctions(parsed.functions, providedCode);
    const candidates = comparison.eligible.slice(0, Math.max(1, Math.min(50, Number(settings.candidateLimit ?? 5))));
    const fallbackSources = sources.filter(file => !providedCode.files.includes(cSourceFingerprint(file.content)));
    if (!candidates.length && (parsed.functions.length > 0 || providedCode.functions.length > 0 || !fallbackSources.length)) {
      throw new NonRetryableBackgroundJobError("No new or modified function could be identified for challenge questions. Unchanged teacher-provided code is excluded; review the student's implementation before requesting a new submission.", "HOMEWORK_NO_ELIGIBLE_CODE");
    }
    const snapshot = record(submission.documentationSnapshot?.metadata);
    const indexes = Array.isArray(snapshot.indexIds) ? snapshot.indexIds.filter((id): id is string => typeof id === "string") : [];
    const search = await createPreparedMaterialSearch(scope.user, scope.courseId, indexes, scope.groupId, storedHomeworkAiSelection(snapshot.embeddingAi) ? record(snapshot.embeddingAi) : undefined);
    const pinnedModel = storedHomeworkAiSelection(metadata.questionGenerationAi);
    const connection = pinnedModel ? await getCourseAiAgentConnection(scope.user, scope.courseId, pinnedModel, "generation", true) : await getHomeworkQuestionConnection(scope);
    const questionCount = Math.max(1, Math.min(20, Number(settings.questionCount ?? 3)));
    const generated: Array<{ text: string; functionIndex: number | null; matches: unknown[]; context: StudentQuestionContext }> = [];
    const questionLanguage = await getHomeworkQuestionLanguage(scope.courseId, metadata.questionLanguage);
    const systemPrompt = homeworkQuestionSystemPrompt(questionLanguage, String(settings.generationInstructions ?? ""));
    const fallbackSource = candidates.length ? "" : fallbackSources.map(file => `${file.path}\n${file.content}`).join("\n");
    for (let index = 0; index < questionCount; index++) {
      await leaseIsCurrent();
      const functionIndex = candidates.length ? index % candidates.length : null;
      const candidate = functionIndex !== null ? candidates[functionIndex] : null;
      const source = candidate?.functionCode ?? fallbackSource.slice(0, 20_000);
      const matches = indexes.length ? await search.search(source.slice(0, 1800) || String(settings.promptMarkdown).slice(0, 1800), Number(settings.retrievedExampleCount ?? 3)) : [];
      const context = makeStudentQuestionContext({ code: source, filePath: candidate?.sourcePath, functionName: candidate?.functionName, truncated: !candidate && fallbackSource.length > 20_000, languageKey: String(settings.languageKey ?? "c") });
      const excludedNames = unchangedProvidedFunctionNames(providedCode, comparison.eligible);
      const questionRequest = { excludedProvidedFunctionNames: excludedNames.slice(0, 100), assignment: settings.promptMarkdown, submittedFunction: candidate?.functionName,
        submittedFile: candidate?.sourcePath, submittedCode: context.code, privateReferenceContext: matches.map(match => ({ title: match.title, text: match.text })),
        questionNumber: index + 1, totalQuestions: questionCount, previousQuestions: generated.map(question => question.text) };
      let questionText = "";
      let correction: { previousResponse: string; feedback: string } | undefined;
      const rejected: string[] = [];
      for (let retry = 0; retry < 3 && !questionText; retry++) {
        await leaseIsCurrent();
        const userPrompt = JSON.stringify({ ...questionRequest, ...(correction ? { correction } : {}) });
        const output = await generateAiAgentText(connection, { systemPrompt, userPrompt, maxOutputTokens: 1200 });
        const result = parseChallengeQuestionResponse(output, { excludedNames, targetFunction: candidate?.functionName, previousQuestions: questionRequest.previousQuestions });
        if (result.ok) questionText = result.text;
        else { rejected.push(result.reason); correction = { previousResponse: output.slice(0, 4000), feedback: result.feedback }; }
      }
      if (!questionText) throw new NonRetryableBackgroundJobError(`Question ${index + 1} could not be generated after 3 attempts (${rejected.join(", ")}). ${correction?.feedback ?? "The model response was invalid."}`, "HOMEWORK_QUESTION_INVALID");
      generated.push({ text: questionText, functionIndex, matches, context });
    }
    // Publish the complete question set atomically, under the same lock used by teacher cancellation.
    await prisma.$transaction(async tx => {
      if (submission.workspaceId) {
        await lockActivityTeamwork(tx, scope.activityId);
        const workspace = await tx.pluginCodingHomeworkWorkspace.findUnique({ where: { id: submission.workspaceId } });
        if (!workspace) throw new NonRetryableBackgroundJobError("The shared submission was erased.", "HOMEWORK_JOB_REPLACED");
        await lockStudentGroupingWorkspaces(tx, workspace.groupingId);
        await team!.assertTeamGenerationCurrent(teamworkTransaction(tx), submission);
      }
      await lockHomeworkWorkflow(tx, scope);
      const [lease] = await tx.$queryRaw<Array<{ status: string; lockedBy: string | null }>>`SELECT status, "lockedBy" FROM "BackgroundJob" WHERE id=${job.id} FOR UPDATE`;
      const current = await tx.pluginCodingHomeworkSubmission.findUniqueOrThrow({ where: { id: submissionId } });
      if (lease?.status !== "running" || lease.lockedBy !== job.lockedBy || current.status === "cancelled" || record(current.metadata).deletion) throw new NonRetryableBackgroundJobError("Generation was cancelled or replaced.");
      await tx.pluginCodingHomeworkChallengeQuestion.deleteMany({ where: { submissionId } });
      await tx.pluginCodingHomeworkSubmissionFunction.deleteMany({ where: { submissionId } });
      const functionIds: string[] = [];
      for (const candidate of candidates) {
        const file = submission.files.find(file => file.path === candidate.sourcePath)!;
        const fn = await tx.pluginCodingHomeworkSubmissionFunction.create({ data: { id: randomUUID(), submissionId, fileId: file.id, functionName: candidate.functionName, functionCode: candidate.functionCode, astText: candidate.astText, selectedForQuestion: true } });
        functionIds.push(fn.id);
      }
      for (const [orderIndex, question] of generated.entries()) await tx.pluginCodingHomeworkChallengeQuestion.create({ data: { submissionId, orderIndex, questionText: question.text,
        submissionFunctionId: question.functionIndex !== null ? functionIds[question.functionIndex] : null, generationModel: connection.model, generationPromptVersion: "prepared-homework-v6", nearestExamples: json(question.matches), metadata: json({ generatedAt: new Date().toISOString(), questionLanguage, studentCodeContext: question.context }) } });
      await tx.pluginCodingHomeworkSubmission.update({ where: { id: submissionId }, data: { status: "challenge_ready", processingError: null,
        metadata: json({ ...record(current.metadata), providedCode, excludedProvidedFunctionCount: comparison.excluded.length, questionLanguage, challengeGeneration: { questionCount, generatedAt: new Date().toISOString() }, parserDiagnostics: parsed.diagnostics }) } });
      if (submission.kind === "team_source") await team!.publishSharedTeamQuestions(teamworkTransaction(tx), submission);
    }, { timeout: 30_000 });
    return { submissionId, generatedQuestionCount: generated.length, submissionStatus: "challenge_ready" };
  } catch (error) {
    const lease = await coreDb.backgroundJob.findUnique({ where: { id: job.id } });
    if (lease?.status === "running" && lease.lockedBy === job.lockedBy) await prisma.pluginCodingHomeworkSubmission.updateMany({ where: { id: submissionId, status: "processing" }, data: { status: "failed", processingError: error instanceof Error ? error.message.slice(0, 1000) : "Question generation failed." } });
    throw error;
  }
}
