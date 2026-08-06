import { z } from "zod";
import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import {
  AppError,
  assertCanManageActivityBank,
  assertCanManageCourse,
  generateQuestionAuthoringText,
  getActivityAttemptAvailability,
  recordActivityAttemptGradingResult,
  startActivityAttempt,
  submitActivityAttempt
} from "@cognelo/core";
import { prisma, type Prisma } from "@cognelo/db";
import { buildMcqGradingResultFromConfig } from "./grading";
import { parseMcqSource, type McqAnswerState, type McqParseError } from "./mcq";

const mcqGenerateInputSchema = z.object({
  description: z.string().min(10).max(4000),
  defaultCodeLanguage: z.string().min(1).max(40).default("none"),
  instructions: z.string().max(4000).default(""),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
  questionCount: z.number().int().min(1).max(20).default(5)
});

const mcqSubmissionInputSchema = z.object({
  answers: z.record(z.array(z.string().min(1).max(120)).default([]))
});

type SubjectContext = {
  title: string;
  description: string;
};

export const mcqGenerateRoute: PluginRouteDefinition = {
  path: "mcq/generate",
  activityTypeKeys: ["mcq"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = mcqGenerateInputSchema.parse(await readJson());

      if (context.activityBankId) {
        await assertCanManageActivityBank(context.user, context.activityBankId);
      } else if (context.courseId) {
        await assertCanManageCourse(context.user, context.courseId);
      } else {
        throw new AppError(400, "ACTIVITY_CONTEXT_REQUIRED", "MCQ generation requires a course or activity bank context.");
      }

      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);
      const generated = await generateValidMcqSource({
        user: context.user,
        description: input.description,
        defaultCodeLanguage: input.defaultCodeLanguage,
        instructions: input.instructions,
        locale: input.locale,
        questionCount: input.questionCount,
        subject
      });

      return generated;
    }
  }
};

export const mcqSubmissionRoute: PluginRouteDefinition = {
  path: "mcq/submission",
  activityTypeKeys: ["mcq"],
  methods: {
    GET: async ({ context }) => {
      if (!context.courseId || !context.groupId) {
        throw new AppError(400, "GROUP_CONTEXT_REQUIRED", "MCQ submissions require a group activity context.");
      }
      const participant = await findStudentParticipant(context.groupId, context.user.id);
      if (!participant) {
        throw new AppError(403, "PARTICIPANT_REQUIRED", "Only enrolled students can submit this activity.");
      }
      const submission = await findLatestMcqSubmission({
        courseId: context.courseId,
        groupId: context.groupId,
        activityId: context.activity.id,
        participantId: participant.id
      });
      const gradingResult = submission ? buildMcqGradingResultFromConfig(context.activity.config, submission.answers) : null;
      return {
        submission,
        grade: gradingResult
          ? {
              rawScore: gradingResult.rawScore,
              rawMaxScore: gradingResult.rawMaxScore,
              normalizedScore: gradingResult.rawScore,
              normalizedMaxScore: gradingResult.rawMaxScore
            }
          : null,
        availability: await getActivityAttemptAvailability(context.user, {
          courseId: context.courseId,
          groupId: context.groupId,
          activityId: context.activity.id
        })
      };
    },
    POST: async ({ context, readJson }) => {
      if (!context.courseId || !context.groupId) {
        throw new AppError(400, "GROUP_CONTEXT_REQUIRED", "MCQ submissions require a group activity context.");
      }
      if (context.activity.assignment?.metadata?.assessmentMode !== "summative") {
        throw new AppError(400, "MCQ_SUMMATIVE_REQUIRED", "Only summative MCQ activities create gradebook submissions.");
      }

      const input = mcqSubmissionInputSchema.parse(await readJson());
      const participant = await findStudentParticipant(context.groupId, context.user.id);
      if (!participant) {
        throw new AppError(403, "PARTICIPANT_REQUIRED", "Only enrolled students can submit this activity.");
      }
      const availability = await getActivityAttemptAvailability(context.user, {
        courseId: context.courseId,
        groupId: context.groupId,
        activityId: context.activity.id
      });
      if (!availability.canStart) {
        throw new AppError(409, availability.reason ?? "ATTEMPT_UNAVAILABLE", "No MCQ submission attempt is currently available.");
      }

      const gradingResult = buildMcqGradingResultFromConfig(context.activity.config, input.answers);
      const coreAttempt = await startActivityAttempt(context.user, {
        courseId: context.courseId,
        groupId: context.groupId,
        activityId: context.activity.id,
        pluginKey: "mcq",
        pluginVersion: "0.1.0",
        metadata: {
          mode: "summative",
          submittedAnswers: input.answers
        }
      });
      const submittedAttempt = await submitActivityAttempt(context.user, {
        attemptId: coreAttempt.id,
        pluginAttemptRef: coreAttempt.id,
        metadata: {
          mode: "summative",
          submittedAnswers: input.answers
        }
      });
      await recordActivityAttemptGradingResult(context.user, {
        attemptId: submittedAttempt.id,
        rawScore: gradingResult.rawScore,
        rawMaxScore: gradingResult.rawMaxScore,
        source: "auto",
        isPass: gradingResult.isPass,
        rawResult: {
          answers: input.answers,
          analyticsPayload: gradingResult.analyticsPayload ?? {}
        } as Prisma.InputJsonValue,
        normalizedResult: (gradingResult.metadata ?? {}) as Prisma.InputJsonValue
      });

      return {
        submission: toMcqSubmissionRecord(submittedAttempt.metadata, {
          id: submittedAttempt.id,
          attemptNumber: submittedAttempt.attemptNumber,
          lifecycle: submittedAttempt.lifecycle,
          submittedAt: submittedAttempt.submittedAt,
          gradedAt: submittedAttempt.gradedAt
        }),
        result: gradingResult
      };
    }
  }
};

export const mcqGradebookAttemptsRoute: PluginRouteDefinition = {
  path: "mcq/gradebook-attempts",
  activityTypeKeys: ["mcq"],
  methods: {
    GET: async ({ context, request }) => {
      if (!context.courseId || !context.groupId) {
        throw new AppError(400, "GROUP_CONTEXT_REQUIRED", "Gradebook attempts require a group activity context.");
      }
      await assertCanManageCourse(context.user, context.courseId);
      const participantId = new URL(request.url).searchParams.get("participantId");
      if (!participantId) {
        throw new AppError(400, "PARTICIPANT_REQUIRED", "A participant is required.");
      }
      const participant = await prisma.courseGroupParticipant.findFirst({
        where: { id: participantId, groupId: context.groupId, role: "student" },
        select: { id: true, userId: true, firstName: true, lastName: true, email: true }
      });
      if (!participant) {
        throw new AppError(404, "PARTICIPANT_NOT_FOUND", "The participant was not found.");
      }
      const attempts = await prisma.activityAttempt.findMany({
        where: {
          courseId: context.courseId,
          groupId: context.groupId,
          activityId: context.activity.id,
          participantId,
          pluginKey: "mcq",
          lifecycle: { in: ["submitted", "graded"] }
        },
        orderBy: [{ attemptNumber: "desc" }]
      });
      return {
        participant,
        attempts: attempts.map((attempt) => toMcqSubmissionRecord(attempt.metadata, attempt))
      };
    }
  }
};

async function findStudentParticipant(groupId: string, userId: string) {
  return prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId, role: "student" },
    select: { id: true, userId: true, firstName: true, lastName: true, email: true }
  });
}

async function findLatestMcqSubmission(input: { courseId: string; groupId: string; activityId: string; participantId: string }) {
  const attempt = await prisma.activityAttempt.findFirst({
    where: {
      courseId: input.courseId,
      groupId: input.groupId,
      activityId: input.activityId,
      participantId: input.participantId,
      pluginKey: "mcq",
      lifecycle: { in: ["submitted", "graded"] }
    },
    orderBy: [{ attemptNumber: "desc" }]
  });
  return attempt ? toMcqSubmissionRecord(attempt.metadata, attempt) : null;
}

export function submittedAnswersFromMetadata(metadata: unknown): McqAnswerState {
  const record = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  const answers = record.submittedAnswers && typeof record.submittedAnswers === "object" && !Array.isArray(record.submittedAnswers)
    ? (record.submittedAnswers as Record<string, unknown>)
    : {};
  return Object.fromEntries(
    Object.entries(answers).map(([questionId, value]) => [
      questionId,
      Array.isArray(value) ? value.filter((choiceId): choiceId is string => typeof choiceId === "string") : []
    ])
  );
}

function toMcqSubmissionRecord(
  metadata: unknown,
  attempt: { id: string; attemptNumber: number; lifecycle: string; submittedAt: Date | string | null; gradedAt: Date | string | null }
) {
  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    lifecycle: attempt.lifecycle,
    submittedAt: toIsoString(attempt.submittedAt),
    gradedAt: toIsoString(attempt.gradedAt),
    answers: submittedAnswersFromMetadata(metadata)
  };
}

function toIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.toISOString();
}

async function resolveSubjectContext(activityBankId: string | undefined, courseId: string | undefined): Promise<SubjectContext> {
  if (activityBankId) {
    const bank = await prisma.activityBank.findUnique({
      where: { id: activityBankId },
      include: { subject: true }
    });
    if (!bank) {
      throw new AppError(404, "ACTIVITY_BANK_NOT_FOUND", "Activity bank was not found.");
    }
    return {
      title: bank.subject.title,
      description: bank.subject.description
    };
  }

  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { subject: true }
    });
    if (!course) {
      throw new AppError(404, "COURSE_NOT_FOUND", "Course was not found.");
    }
    return {
      title: course.subject.title,
      description: course.subject.description
    };
  }

  throw new AppError(400, "SUBJECT_CONTEXT_REQUIRED", "Subject context is required for MCQ generation.");
}

async function generateValidMcqSource(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  description: string;
  defaultCodeLanguage: string;
  instructions: string;
  locale: "en" | "fr" | "zh" | "ar";
  questionCount: number;
  subject: SubjectContext;
}) {
  const systemPrompt = buildSystemPrompt(input);
  let userPrompt = buildInitialUserPrompt(input);
  let lastSource = "";
  let lastIssues: McqParseError[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateQuestionAuthoringText(input.user, {
      systemPrompt,
      userPrompt,
      maxOutputTokens: 6000
    });
    const source = normalizeGeneratedSource(raw);
    const parsed = parseMcqSource(source, "none");
    const issues = collectMcqIssues(source, parsed, input.questionCount, input.defaultCodeLanguage);

    if (!issues.length) {
      return { source, attempts: attempt };
    }

    lastSource = source;
    lastIssues = issues;
    userPrompt = buildCorrectionPrompt(source, issues, input);
  }

  throw new AppError(422, "MCQ_AI_GENERATION_INVALID", "The AI agent could not generate valid MCQ syntax after three attempts.", {
    issues: lastIssues,
    source: lastSource
  });
}

function buildSystemPrompt(input: {
  defaultCodeLanguage: string;
  locale: "en" | "fr" | "zh" | "ar";
  subject: SubjectContext;
}) {
  return [
    "You generate multiple-choice question activities for Cognelo.",
    "Return only the MCQ source text. Do not wrap the whole answer in Markdown fences. Do not add explanations outside the source.",
    "",
    "Required syntax:",
    "- Each question starts with a level-2 Markdown heading: `## Question N`.",
    "- The prompt follows the heading.",
    "- Choices must use task-list syntax: `- [x] correct choice` and `- [ ] incorrect choice`.",
    "- Choices may be code alternatives. For a code-only choice, write the marker on its own line and put a fenced code block immediately below it.",
    "- Every fenced code block must include an explicit language identifier after the opening backticks. Never return an unlabeled fenced code block.",
    "- Each question must include at least three choices.",
    "- Each question must include at least one correct choice.",
    "- Use one correct choice for single-answer questions and multiple `[x]` choices only when the question clearly asks for multiple answers.",
    input.defaultCodeLanguage === "none"
      ? "- This is not a programming exercise. Do not introduce programming code unless the teacher explicitly requests it; if code is requested, label every fence with the appropriate language."
      : `- The selected programming language is ${input.defaultCodeLanguage}. Every fenced code block must open with \`\`\`${input.defaultCodeLanguage}; do not use another language.`,
    "- Prefer plausible distractors and avoid ambiguous wording.",
    "- If several questions are requested, order them crescendo from simpler to more complex.",
    "",
    `Current UI/content language: ${localeName(input.locale)}.`,
    "Generate all question text and choices in that language.",
    "",
    "Subject context:",
    `Title: ${input.subject.title}`,
    `Description: ${input.subject.description || "No subject description provided."}`
  ].join("\n");
}

function buildInitialUserPrompt(input: { description: string; instructions: string; questionCount: number }) {
  return [
    `Generate exactly ${input.questionCount} valid Cognelo multiple-choice question${input.questionCount === 1 ? "" : "s"}.`,
    "",
    "Student prompt and activity context:",
    input.description.trim(),
    "",
    "Additional instructions from the teacher:",
    input.instructions.trim() || "No additional instructions were provided."
  ].join("\n\n");
}

function buildCorrectionPrompt(
  source: string,
  issues: McqParseError[],
  input: { description: string; instructions: string; questionCount: number }
) {
  return [
    "The previous MCQ source was invalid. Return the full corrected MCQ source only.",
    `The corrected source must contain exactly ${input.questionCount} question${input.questionCount === 1 ? "" : "s"}.`,
    "",
    "Student prompt and activity context:",
    input.description.trim(),
    "",
    "Additional instructions from the teacher:",
    input.instructions.trim() || "No additional instructions were provided.",
    "",
    "Validation issues:",
    ...issues.map((issue) => `- Line ${issue.line}: ${issue.message}`),
    "",
    "Invalid source:",
    source
  ].join("\n");
}

function collectMcqIssues(
  source: string,
  parsed: ReturnType<typeof parseMcqSource>,
  questionCount: number,
  generationCodeLanguage: string
): McqParseError[] {
  const issues = [...parsed.errors, ...collectFenceLanguageIssues(source, generationCodeLanguage)];
  if (!source.trim()) {
    issues.push({ line: 1, message: "Generated source is empty." });
  }
  if (!parsed.questions.length) {
    issues.push({ line: 1, message: "The activity must include at least one `## Question` section." });
  } else if (parsed.questions.length !== questionCount) {
    issues.push({
      line: 1,
      message: `The activity must include exactly ${questionCount} question${questionCount === 1 ? "" : "s"}; it currently includes ${parsed.questions.length}.`
    });
  }
  return issues;
}

function collectFenceLanguageIssues(source: string, generationCodeLanguage: string): McqParseError[] {
  const issues: McqParseError[] = [];
  let inFence = false;
  source.replace(/\r\n/g, "\n").split("\n").forEach((line, index) => {
    const fenceText = line.trim().replace(/^[-*]\s+\[(?:x|X| )\]\s*/, "");
    if (!fenceText.startsWith("```")) {
      return;
    }
    if (inFence) {
      inFence = false;
      return;
    }
    inFence = true;
    const language = fenceText.slice(3).trim().split(/\s+/)[0] ?? "";
    if (!language) {
      issues.push({ line: index + 1, message: "Every generated code fence must include an explicit programming language." });
    } else if (generationCodeLanguage !== "none" && language.toLowerCase() !== generationCodeLanguage.toLowerCase()) {
      issues.push({
        line: index + 1,
        message: `Every generated code fence must use the selected ${generationCodeLanguage} language.`
      });
    }
  });
  return issues;
}

function normalizeGeneratedSource(value: string) {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);
  return (fenceMatch?.[1] ?? trimmed).trim();
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
