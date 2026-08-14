import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { AppError, assertCanManageActivityBank, assertCanManageCourse } from "@cognelo/core";
import {
  codingExerciseRunInputSchema,
  codingExerciseSubmitInputSchema,
  listCodingExerciseReviewExecutions,
  listRecentCodingExerciseExecutions,
  runCodingExercise,
  submitCodingExercise
} from "./executions";
import {
  codingExercisePromptGenerationInputSchema,
  codingExerciseSolutionGenerationInputSchema,
  codingExerciseTestsGenerationInputSchema,
  generateCodingExercisePrompt,
  generateCodingExerciseSolution,
  generateCodingExerciseTests
} from "./generation";
import {
  listBankCodingExerciseHiddenTests,
  listCodingExerciseHiddenTests,
  replaceBankCodingExerciseHiddenTests,
  replaceCodingExerciseHiddenTests
} from "./hidden-tests";
import { prisma } from "@cognelo/db";

function requireCourseId(courseId: string | undefined) {
  if (!courseId) {
    throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "This plugin route requires a course context.");
  }
  return courseId;
}

function requireActivityBankId(activityBankId: string | undefined) {
  if (!activityBankId) {
    throw new AppError(400, "ACTIVITY_BANK_CONTEXT_REQUIRED", "This plugin route requires an activity bank context.");
  }
  return activityBankId;
}

type SubjectContext = {
  title: string;
  description: string;
};

export const codingExerciseReviewAllRoute: PluginRouteDefinition = {
  path: "coding-exercises/review-all",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const courseId = requireCourseId(context.courseId);
      await assertCanManageCourse(context.user, courseId);
      const participants = await prisma.courseGroupParticipant.findMany({
        where: { group: { courseId }, role: "student", userId: { not: null } },
        select: { id: true, userId: true }
      });
      const executions = await listCodingExerciseReviewExecutions({ activityId: context.activity.id, userIds: participants.flatMap((participant) => participant.userId ? [participant.userId] : []) });
      const byUserId = new Map(executions.map((execution) => [execution.userId, execution]));
      return { submissions: participants.flatMap((participant) => participant.userId && byUserId.has(participant.userId) ? [{ participantId: participant.id, execution: byUserId.get(participant.userId) }] : []) };
    }
  }
};

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

  throw new AppError(400, "SUBJECT_CONTEXT_REQUIRED", "Subject context is required for coding exercise generation.");
}

async function assertCanManageGenerationContext(context: { user: Parameters<typeof assertCanManageCourse>[0]; activityBankId?: string; courseId?: string }) {
  if (context.activityBankId) {
    await assertCanManageActivityBank(context.user, context.activityBankId);
    return;
  }
  if (context.courseId) {
    await assertCanManageCourse(context.user, context.courseId);
    return;
  }
  throw new AppError(400, "ACTIVITY_CONTEXT_REQUIRED", "Coding exercise generation requires a course or activity bank context.");
}

export const codingExerciseRunRoute: PluginRouteDefinition = {
  path: "coding-exercises/run",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const executions = await listRecentCodingExerciseExecutions({
        activityId: context.activity.id,
        userId: context.user.id
      });

      return { executions };
    },
    POST: async ({ context, readJson }) => {
      const input = codingExerciseRunInputSchema.parse(await readJson());
      const execution = await runCodingExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        activityConfig: context.activity.config,
        input
      });

      return { execution };
    }
  }
};

export const codingExerciseSubmitRoute: PluginRouteDefinition = {
  path: "coding-exercises/submit",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const executions = await listRecentCodingExerciseExecutions({
        activityId: context.activity.id,
        userId: context.user.id
      });

      return { executions: executions.filter((execution) => execution.kind === "submit") };
    },
    POST: async ({ context, readJson }) => {
      const input = codingExerciseSubmitInputSchema.parse(await readJson());
      const execution = await submitCodingExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        activityConfig: context.activity.config,
        input
      });

      return { execution };
    }
  }
};

export const codingExerciseHiddenTestsRoute: PluginRouteDefinition = {
  path: "coding-exercises/hidden-tests",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      if (context.activityBankId) {
        await assertCanManageActivityBank(context.user, context.activityBankId);
        return listBankCodingExerciseHiddenTests({
          bankActivityId: context.activity.id
        });
      }

      const courseId = requireCourseId(context.courseId);
      await assertCanManageCourse(context.user, courseId);
      const result = await listCodingExerciseHiddenTests({
        activityId: context.activity.id
      });

      return result;
    },
    PUT: async ({ context, readJson }) => {
      if (context.activityBankId) {
        return replaceBankCodingExerciseHiddenTests({
          activityBankId: requireActivityBankId(context.activityBankId),
          bankActivityId: context.activity.id,
          activityConfig: context.activity.config,
          user: context.user,
          input: await readJson()
        });
      }

      const courseId = requireCourseId(context.courseId);
      const result = await replaceCodingExerciseHiddenTests({
        activityId: context.activity.id,
        courseId,
        activityConfig: context.activity.config,
        user: context.user,
        input: await readJson()
      });

      return result;
    }
  }
};

export const codingExerciseGeneratePromptRoute: PluginRouteDefinition = {
  path: "coding-exercises/generate-prompt",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = codingExercisePromptGenerationInputSchema.parse(await readJson());
      await assertCanManageGenerationContext(context);
      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);

      return generateCodingExercisePrompt({
        user: context.user,
        description: input.description,
        language: input.language,
        locale: input.locale,
        subject,
        knowledge: input.knowledge
      });
    }
  }
};

export const codingExerciseGenerateSolutionRoute: PluginRouteDefinition = {
  path: "coding-exercises/generate-solution",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = codingExerciseSolutionGenerationInputSchema.parse(await readJson());
      await assertCanManageGenerationContext(context);
      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);

      return generateCodingExerciseSolution({
        user: context.user,
        description: input.description,
        prompt: input.prompt,
        language: input.language,
        locale: input.locale,
        subject,
        knowledge: input.knowledge
      });
    }
  }
};

export const codingExerciseGenerateTestsRoute: PluginRouteDefinition = {
  path: "coding-exercises/generate-tests",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = codingExerciseTestsGenerationInputSchema.parse(await readJson());
      await assertCanManageGenerationContext(context);
      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);

      return generateCodingExerciseTests({
        user: context.user,
        description: input.description,
        prompt: input.prompt,
        language: input.language,
        locale: input.locale,
        subject,
        referenceSolution: input.referenceSolution,
        templateSource: input.templateSource,
        templateVisibleLineNumbers: input.templateVisibleLineNumbers,
        knowledge: input.knowledge
      });
    }
  }
};
