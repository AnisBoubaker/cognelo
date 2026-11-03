import { snapshotProvidedCode, readProvidedCodeBaseline, selectLearnerFunctions, excludesProvidedFunction } from "./provided-code";
import { getHomeworkQuestionLanguage, homeworkQuestionSystemPrompt } from "./question-generation-policy";
import { makeStudentQuestionContext, studentQuestionContext } from "./question-context";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  AppError,
  canManageCourse,
  generateAiAgentText,
  getCourseTeacherQuestionAuthoringAiAgentConnection,
  getCourseAiAgentConnection,
  getQuestionAuthoringAiAgentConnection
} from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { storedHomeworkAiSelection } from "./ai-selection";
import { codingHomeworkChallengePromptVersion } from "./algorithm";
import { Prisma, prisma } from "./db-client";
import { appendProcessingEvent, buildProcessingEvent, buildProcessingOperationId, processingFailureMetadata } from "./processing";

type GenerationScope = {
  activityId: string;
  courseId: string;
  groupId: string;
  user: CurrentUser;
};

type SubmissionRow = {
  id: string;
  activityId: string;
  groupId: string;
  userId: string;
  coreAttemptId: string | null;
  documentationSnapshotId: string | null;
  zipAttachmentId: string | null;
  kind: string;
  status: string;
  structureValidationSummary: unknown;
  processingError: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type SubmissionFunctionRow = {
  id: string;
  submissionId: string;
  fileId: string;
  functionName: string;
  functionCode: string;
  astText: string;
  embedding: unknown;
  nearestExamples: unknown;
  divergenceScore: number | null;
  selectedForQuestion: boolean;
  file?: { path: string; languageKey: string | null };
  createdAt: Date;
  updatedAt: Date;
};

type ChallengeQuestionRow = {
  id: string;
  submissionId: string;
  submissionFunctionId: string | null;
  orderIndex: number;
  questionText: string;
  studentAnswer: string | null;
  answerSubmittedAt: Date | null;
  generationModel: string;
  generationPromptVersion: string;
  nearestExamples: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type GenerationOptions = {
  aiConnectionKind: "course_teacher_question_authoring" | "teacher_question_authoring";
  requireManager: boolean;
  restrictToUser: boolean;
};

const challengeGenerationInputSchema = z.object({
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
  submissionId: z.string().trim().min(1).nullable().optional()
});

const generatedChallengeQuestionSchema = z.object({
  questionText: z.string().trim().min(20).max(3000)
});

export async function generateCodingHomeworkChallengeQuestions(scope: GenerationScope, input: unknown = {}) {
  return generateChallengeQuestions(scope, input, {
    aiConnectionKind: "teacher_question_authoring",
    requireManager: true,
    restrictToUser: false
  });
}

export async function generateCodingHomeworkChallengeQuestionsForStudentSubmission(scope: GenerationScope, input: unknown = {}) {
  return generateChallengeQuestions(scope, input, {
    aiConnectionKind: "course_teacher_question_authoring",
    requireManager: false,
    restrictToUser: true
  });
}

async function generateChallengeQuestions(scope: GenerationScope, input: unknown, options: GenerationOptions) {
  if (options.requireManager) {
    await assertCanGenerateQuestions(scope);
  }
  const parsed = challengeGenerationInputSchema.parse(input ?? {});
  const submission = await findSubmission(scope, parsed.submissionId ?? null, options);
  if (!submission) {
    throw new AppError(404, "CODING_HOMEWORK_SUBMISSION_NOT_FOUND", "The requested submission was not found.");
  }
  if (normalizeObject(submission.metadata).workflowVersion === 2 || submission.status === "cancelled") throw new AppError(409, "HOMEWORK_PREPARED_WORKFLOW_LOCKED", "Prepared submissions use the durable queue. Cancel the submission to allow a fresh hand-in.");
  if (submission.status !== "structure_valid" && submission.status !== "challenge_ready" && submission.status !== "failed") {
    throw new AppError(400, "CODING_HOMEWORK_SUBMISSION_NOT_READY", "Analyze a valid submission before generating challenge questions.");
  }

  const selectedFunctions = await prisma.pluginCodingHomeworkSubmissionFunction.findMany({
    where: {
      submissionId: submission.id,
      selectedForQuestion: true
    },
    include: { file: { select: { path: true, languageKey: true } } },
    orderBy: [{ divergenceScore: "desc" }, { functionName: "asc" }]
  });
  const providedCode = readProvidedCodeBaseline(normalizeObject(submission.metadata).providedCode) ?? await snapshotProvidedCode(scope.activityId);
  const candidates = selectLearnerFunctions(selectedFunctions, providedCode).eligible;
  if (!candidates.length) {
    throw new AppError(400, "CODING_HOMEWORK_CANDIDATES_EMPTY", "No new or modified candidate functions remain after excluding unchanged provided code. Analyze the student’s implementation before generating questions.");
  }
  // Old submissions acquire one compact baseline when first processed, then reuse it.
  submission.metadata = { ...normalizeObject(submission.metadata), providedCode };

  const operationId = buildProcessingOperationId("challenge-generation", submission.id);
  await prisma.pluginCodingHomeworkSubmission.update({
    where: { id: submission.id },
    data: {
      metadata: appendProcessingEvent(
        submission.metadata,
        buildProcessingEvent({
          operationId,
          stage: "challenge-generation",
          status: "started"
        })
      ) as Prisma.InputJsonValue,
      status: "processing",
      processingError: null
    }
  });

  try {
    const assignment = await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId } });
    const aiConnection = await resolveAiConnection(scope, options.aiConnectionKind, assignment?.settings);
    const questionLanguage = await getHomeworkQuestionLanguage(scope.courseId);
    const questionCount = clampQuestionCount(assignment?.questionCount ?? candidates.length, candidates.length);
    const generationCandidates = candidates.slice(0, questionCount) as SubmissionFunctionRow[];
    const generatedAt = new Date().toISOString();
    const generated: Array<Awaited<ReturnType<typeof generateOneChallengeQuestion>> & { orderIndex: number }> = [];

    for (let index = 0; index < generationCandidates.length; index += 1) {
      const candidate = generationCandidates[index];
      const excludedNames = [...new Set(providedCode.functions.map(fn => fn.name))].filter(name => name !== candidate.functionName);
      const prompt = buildChallengeQuestionPrompt({
        assignment: {
          generationInstructions: assignment?.generationInstructions ?? "",
          languageKey: assignment?.languageKey ?? "c",
          promptMarkdown: assignment?.promptMarkdown ?? "",
          questionCount: generationCandidates.length
        },
        candidate,
        locale: questionLanguage,
        orderIndex: index,
        previousQuestions: generated.map(question => question.questionText),
        excludedProvidedFunctionNames: excludedNames.slice(0, 100)
      });
      const result = await generateOneChallengeQuestion({
        candidate,
        generatedAt,
        model: aiConnection.model,
        prompt,
        aiConnection,
        excludedNames
      });
      generated.push({
        ...result,
        orderIndex: index
      });
    }

    await prisma.pluginCodingHomeworkChallengeQuestion.deleteMany({ where: { submissionId: submission.id } });
    const rows: ChallengeQuestionRow[] = [];
    for (const question of generated) {
      const row = await prisma.pluginCodingHomeworkChallengeQuestion.create({
        data: {
          generationModel: question.generationModel,
          generationPromptVersion: codingHomeworkChallengePromptVersion,
          metadata: { ...question.metadata, questionLanguage, studentCodeContext: makeStudentQuestionContext({
            code: generationCandidates[question.orderIndex].functionCode, functionName: generationCandidates[question.orderIndex].functionName,
            filePath: generationCandidates[question.orderIndex].file?.path, languageKey: assignment?.languageKey ?? "c"
          }) } as Prisma.InputJsonValue,
          nearestExamples: question.nearestExamples as Prisma.InputJsonValue,
          orderIndex: question.orderIndex,
          questionText: question.questionText,
          submissionFunctionId: question.submissionFunctionId,
          submissionId: submission.id
        }
      });
      rows.push(row);
    }

    const generation = {
      status: "ready",
      generatedAt,
      model: aiConnection.model,
      promptVersion: codingHomeworkChallengePromptVersion,
      questionCount: rows.length,
      candidateCount: candidates.length
    };
    const updatedSubmission = await prisma.pluginCodingHomeworkSubmission.update({
      where: { id: submission.id },
      data: {
        metadata: {
          ...appendProcessingEvent(
            submission.metadata,
            buildProcessingEvent({
              operationId,
              stage: "challenge-generation",
              status: "completed"
            })
          ),
          challengeGeneration: generation
        } as Prisma.InputJsonValue,
        processingError: null,
        status: "challenge_ready"
      }
    });

    return {
      generation,
      questions: rows.map(toChallengeQuestionRecord),
      submission: toSubmissionRecord(updatedSubmission)
    };
  } catch (error) {
    const failure = processingFailureMetadata(submission.metadata, "challenge-generation", error, operationId);
    await prisma.pluginCodingHomeworkSubmission.update({
      where: { id: submission.id },
      data: {
        metadata: failure.metadata as Prisma.InputJsonValue,
        processingError: failure.processingError.message,
        status: "failed"
      }
    });
    throw error;
  }
}

export function buildChallengeQuestionPrompt(input: {
  assignment: {
    generationInstructions: string;
    languageKey: string;
    promptMarkdown: string;
    questionCount: number;
  };
  candidate: SubmissionFunctionRow;
  locale: "en" | "fr" | "zh" | "ar";
  orderIndex: number;
  previousQuestions?: string[];
  excludedProvidedFunctionNames?: string[];
}) {
  const nearestExamples = normalizeArray(input.candidate.nearestExamples);
  const systemPrompt = homeworkQuestionSystemPrompt(input.locale, input.assignment.generationInstructions);
  const userPrompt = [
    "Assignment prompt:",
    input.assignment.promptMarkdown.trim() || "No assignment prompt was provided.",
    "",
    "Submitted function:",
    "```",
    makeStudentQuestionContext({ code: input.candidate.functionCode }).code,
    "```",
    "",
    "Submitted function normalized AST text:",
    input.candidate.astText.slice(0, 24_000),
    "",
    "Nearest prior reference examples for private teacher/model context only. Do not reveal them to the student:",
    JSON.stringify(nearestExamples, null, 2),
    "",
    "Unchanged provided functions that must not be questioned:",
    JSON.stringify(input.excludedProvidedFunctionNames ?? []),
    "",
    "Questions already generated for this submission (choose a distinct focus):",
    JSON.stringify(input.previousQuestions ?? []),
    "",
    `Generate challenge question ${input.orderIndex + 1} of ${input.assignment.questionCount}.`
  ].join("\n");

  return {
    systemPrompt,
    userPrompt
  };
}

async function generateOneChallengeQuestion(input: {
  aiConnection: {
    provider: "ollama" | "openai" | "codex" | "claude";
    model: string;
    baseUrl: string | null;
    apiKey: string | null;
  };
  candidate: SubmissionFunctionRow;
  generatedAt: string;
  excludedNames?: string[];
  model: string;
  prompt: { systemPrompt: string; userPrompt: string };
}) {
  let userPrompt = input.prompt.userPrompt;
  let lastPayload: unknown = null;
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateAiAgentText(input.aiConnection, {
      systemPrompt: input.prompt.systemPrompt,
      userPrompt,
      maxOutputTokens: 1200
    });
    const parsed = parseGeneratedJson(raw);
    if (!parsed.ok) {
      lastPayload = raw;
      lastIssues = [parsed.issue];
      userPrompt = `${input.prompt.userPrompt}\n\n${buildCorrectionPrompt(raw, lastIssues)}`;
      continue;
    }

    const validated = generatedChallengeQuestionSchema.safeParse(parsed.value);
    if (validated.success && !excludesProvidedFunction(validated.data.questionText, input.excludedNames ?? [])) {
      return {
        generationModel: input.model,
        questionText: validated.data.questionText,
        submissionFunctionId: input.candidate.id,
        nearestExamples: normalizeArray(input.candidate.nearestExamples),
        metadata: {
          generatedAt: input.generatedAt,
          attempts: attempt,
          promptVersion: codingHomeworkChallengePromptVersion,
          promptHash: fingerprint(`${input.prompt.systemPrompt}\n\n${input.prompt.userPrompt}`),
          prompt: input.prompt,
          functionName: input.candidate.functionName,
          divergenceScore: input.candidate.divergenceScore,
          model: input.model,
          rawResponse: raw
        }
      };
    }

    lastPayload = parsed.value;
    lastIssues = validated.success ? ["The question refers to unchanged teacher-provided code. Ask about the current eligible submitted function instead."] : validated.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`);
    userPrompt = `${input.prompt.userPrompt}\n\n${buildCorrectionPrompt(JSON.stringify(parsed.value, null, 2), lastIssues)}`;
  }

  throw new AppError(422, "CODING_HOMEWORK_CHALLENGE_GENERATION_INVALID", "The AI agent could not generate a valid challenge question.", {
    issues: lastIssues,
    payload: lastPayload
  });
}

async function assertCanGenerateQuestions(scope: GenerationScope) {
  if (await canManageCourse(scope.user, scope.courseId)) {
    return;
  }
  throw new AppError(403, "FORBIDDEN", "Only course staff can generate coding homework challenge questions.");
}

async function resolveAiConnection(scope: GenerationScope, kind: GenerationOptions["aiConnectionKind"], settings: unknown) {
  const selected = storedHomeworkAiSelection(normalizeObject(settings).questionGenerationAi);
  if (selected) return getCourseAiAgentConnection(scope.user, scope.courseId, selected, "generation");
  const connection =
    kind === "course_teacher_question_authoring"
      ? await getCourseTeacherQuestionAuthoringAiAgentConnection(scope.user, scope.courseId)
      : await getQuestionAuthoringAiAgentConnection(scope.user);

  return connection;
}

async function findSubmission(scope: GenerationScope, submissionId: string | null, options: GenerationOptions): Promise<SubmissionRow | null> {
  return prisma.pluginCodingHomeworkSubmission.findFirst({
    where: {
      ...(submissionId ? { id: submissionId } : {}),
      activityId: scope.activityId,
      groupId: scope.groupId,
      kind: "final",
      ...(options.restrictToUser ? { userId: scope.user.id } : {})
    },
    orderBy: { createdAt: "desc" }
  });
}

function parseGeneratedJson(value: string): { ok: true; value: unknown } | { ok: false; issue: string } {
  const trimmed = value.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return { ok: true, value: JSON.parse(withoutFence) };
  } catch {
    return { ok: false, issue: "Generated response is not valid JSON." };
  }
}

function buildCorrectionPrompt(payload: string, issues: string[]) {
  return [
    "The previous JSON payload was invalid. Return the full corrected JSON payload only.",
    "",
    "Validation issues:",
    ...issues.map((issue) => `- ${issue}`),
    "",
    "Previous payload:",
    payload
  ].join("\n");
}

function toSubmissionRecord(row: SubmissionRow) {
  return {
    id: row.id,
    activityId: row.activityId,
    coreAttemptId: row.coreAttemptId,
    createdAt: row.createdAt.toISOString(),
    documentationSnapshotId: row.documentationSnapshotId,
    groupId: row.groupId,
    kind: row.kind,
    metadata: normalizeObject(row.metadata),
    processingError: row.processingError,
    status: row.status,
    structureValidationSummary: normalizeObject(row.structureValidationSummary),
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
    zipAttachmentId: row.zipAttachmentId
  };
}

function toChallengeQuestionRecord(row: ChallengeQuestionRow) {
  return {
    id: row.id,
    answerSubmittedAt: row.answerSubmittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    generationModel: row.generationModel,
    generationPromptVersion: row.generationPromptVersion,
    metadata: normalizeObject(row.metadata),
    nearestExamples: normalizeArray(row.nearestExamples),
    orderIndex: row.orderIndex,
    questionText: row.questionText,
    studentAnswer: row.studentAnswer,
    submissionFunctionId: row.submissionFunctionId,
    submissionId: row.submissionId,
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toStudentChallengeQuestionRecord(row: {
  id: string;
  answerSubmittedAt?: Date | string | null;
  orderIndex: number;
  questionText: string;
  studentAnswer?: string | null;
  submissionId: string;
  metadata?: unknown;
  submissionFunction?: unknown;
}) {
  const context = studentQuestionContext(row);
  return {
    ...(context ? { context } : {}),
    id: row.id,
    answerSubmittedAt:
      row.answerSubmittedAt instanceof Date ? row.answerSubmittedAt.toISOString() : typeof row.answerSubmittedAt === "string" ? row.answerSubmittedAt : null,
    orderIndex: row.orderIndex,
    questionText: row.questionText,
    studentAnswer: row.studentAnswer ?? null,
    submissionId: row.submissionId
  };
}

export function toStudentChallengeGenerationResult(result: Awaited<ReturnType<typeof generateCodingHomeworkChallengeQuestions>>) {
  return {
    generation: {
      status: result.generation.status,
      generatedAt: result.generation.generatedAt,
      questionCount: result.generation.questionCount
    },
    questions: result.questions.map(toStudentChallengeQuestionRecord),
    submission: result.submission
  };
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function clampQuestionCount(value: number, candidateCount: number) {
  return Math.max(1, Math.min(50, candidateCount, Number.isFinite(value) ? Math.trunc(value) : candidateCount));
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
