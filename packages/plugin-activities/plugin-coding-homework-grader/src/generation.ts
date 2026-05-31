import { createHash } from "node:crypto";
import { z } from "zod";
import {
  AppError,
  canManageCourse,
  generateAiAgentText,
  getCourseStudentSupportAiAgentConnection,
  getQuestionAuthoringAiAgentConnection
} from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { codingHomeworkChallengePromptVersion } from "./algorithm";
import { Prisma, prisma } from "./db-client";

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
  aiConnectionKind: "course_student_support" | "teacher_question_authoring";
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
    aiConnectionKind: "course_student_support",
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
  if (submission.status !== "structure_valid" && submission.status !== "challenge_ready" && submission.status !== "failed") {
    throw new AppError(400, "CODING_HOMEWORK_SUBMISSION_NOT_READY", "Analyze a valid submission before generating challenge questions.");
  }

  const candidates = await prisma.pluginCodingHomeworkSubmissionFunction.findMany({
    where: {
      submissionId: submission.id,
      selectedForQuestion: true
    },
    orderBy: [{ divergenceScore: "desc" }, { functionName: "asc" }]
  });
  if (!candidates.length) {
    throw new AppError(400, "CODING_HOMEWORK_CANDIDATES_EMPTY", "Analyze the submission and select candidate functions before generating questions.");
  }

  await prisma.pluginCodingHomeworkSubmission.update({
    where: { id: submission.id },
    data: { status: "processing", processingError: null }
  });

  try {
    const [assignment, aiConnection] = await Promise.all([
      prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId } }),
      resolveAiConnection(scope, options.aiConnectionKind)
    ]);
    const questionCount = clampQuestionCount(assignment?.questionCount ?? candidates.length, candidates.length);
    const generationCandidates = candidates.slice(0, questionCount) as SubmissionFunctionRow[];
    const generatedAt = new Date().toISOString();
    const generated: Array<Awaited<ReturnType<typeof generateOneChallengeQuestion>> & { orderIndex: number }> = [];

    for (let index = 0; index < generationCandidates.length; index += 1) {
      const candidate = generationCandidates[index];
      const prompt = buildChallengeQuestionPrompt({
        assignment: {
          generationInstructions: assignment?.generationInstructions ?? "",
          languageKey: assignment?.languageKey ?? "c",
          promptMarkdown: assignment?.promptMarkdown ?? "",
          questionCount: generationCandidates.length
        },
        candidate,
        locale: parsed.locale,
        orderIndex: index
      });
      const result = await generateOneChallengeQuestion({
        candidate,
        generatedAt,
        model: aiConnection.model,
        prompt,
        aiConnection
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
          metadata: question.metadata as Prisma.InputJsonValue,
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
          ...normalizeObject(submission.metadata),
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
    await prisma.pluginCodingHomeworkSubmission.update({
      where: { id: submission.id },
      data: {
        processingError: error instanceof Error ? error.message : "Challenge question generation failed.",
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
}) {
  const nearestExamples = normalizeArray(input.candidate.nearestExamples);
  const systemPrompt = [
    "You generate free-response oral-defense style challenge questions for Cognelo coding homework submissions.",
    "Return only valid JSON. Do not wrap the JSON in Markdown fences. Do not add explanations.",
    "",
    "Required JSON shape:",
    "{",
    '  "questionText": "one student-facing free-response question"',
    "}",
    "",
    "Rules:",
    `- Programming language: ${input.assignment.languageKey}.`,
    `- Current UI/content language: ${localeName(input.locale)}.`,
    "- Generate the question in the current UI/content language.",
    "- Ask exactly one question.",
    "- The question must require the student to explain, justify, trace, or compare their own submitted function.",
    "- The question must be answerable from the submitted function and the assignment context.",
    "- Do not include the answer, rubric, hints, or grading criteria.",
    "- Do not quote, mention, or reveal the prior reference examples.",
    "- Do not say that similarity search, embeddings, nearest examples, or plagiarism detection were used.",
    "- Prefer questions that reveal whether the student understands their implementation choices.",
    "- Keep the question concise, normally one or two sentences."
  ].join("\n");
  const userPrompt = [
    "Assignment prompt:",
    input.assignment.promptMarkdown.trim() || "No assignment prompt was provided.",
    "",
    "Additional teacher generation notes:",
    input.assignment.generationInstructions.trim() || "No additional notes were provided.",
    "",
    "Submitted function:",
    "```",
    input.candidate.functionCode,
    "```",
    "",
    "Submitted function normalized AST text:",
    input.candidate.astText,
    "",
    "Nearest prior reference examples for private teacher/model context only. Do not reveal them to the student:",
    JSON.stringify(nearestExamples, null, 2),
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
      userPrompt = buildCorrectionPrompt(raw, lastIssues);
      continue;
    }

    const validated = generatedChallengeQuestionSchema.safeParse(parsed.value);
    if (validated.success) {
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
    lastIssues = validated.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`);
    userPrompt = buildCorrectionPrompt(JSON.stringify(parsed.value, null, 2), lastIssues);
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

async function resolveAiConnection(scope: GenerationScope, kind: GenerationOptions["aiConnectionKind"]) {
  if (kind === "course_student_support") {
    return getCourseStudentSupportAiAgentConnection(scope.user, scope.courseId);
  }
  return getQuestionAuthoringAiAgentConnection(scope.user);
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
}) {
  return {
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

function localeName(locale: "en" | "fr" | "zh" | "ar") {
  if (locale === "fr") {
    return "French";
  }
  if (locale === "zh") {
    return "Chinese";
  }
  if (locale === "ar") {
    return "Arabic";
  }
  return "English";
}
