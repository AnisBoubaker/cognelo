import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { AppError, assertCanManageActivityBank, assertCanManageCourse } from "@cognelo/core";
import { prisma } from "@cognelo/db";
import { ensureParsonsAttempt, updateParsonsAttempt } from "./attempts";
import { parsonsAttemptEnsureInputSchema, parsonsAttemptUpdateInputSchema } from "./attempt-types";
import { generateParsonsProblem, parsonsGenerationInputSchema } from "./generation";
import { parseParsonsConfig } from "./parsons";

type SubjectContext = {
  title: string;
  description: string;
};

async function assertCanManageGenerationContext(context: { user: Parameters<typeof assertCanManageCourse>[0]; activityBankId?: string; courseId?: string }) {
  if (context.activityBankId) {
    await assertCanManageActivityBank(context.user, context.activityBankId);
    return;
  }
  if (context.courseId) {
    await assertCanManageCourse(context.user, context.courseId);
    return;
  }
  throw new AppError(400, "ACTIVITY_CONTEXT_REQUIRED", "Parsons generation requires a course or activity bank context.");
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

  throw new AppError(400, "SUBJECT_CONTEXT_REQUIRED", "Subject context is required for Parsons generation.");
}

export const parsonsAttemptRoute: PluginRouteDefinition = {
  path: "parsons/attempt",
  activityTypeKeys: ["parsons-problem"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = parsonsAttemptEnsureInputSchema.parse(await readJson());
      const attempt = await ensureParsonsAttempt({
        activityId: context.activity.id,
        userId: context.user.id,
        config: parseParsonsConfig(context.activity.config),
        forceNew: input.forceNew
      });

      return { attempt };
    },
    PATCH: async ({ context, readJson }) => {
      const input = parsonsAttemptUpdateInputSchema.parse(await readJson());
      const attempt = await updateParsonsAttempt({
        activityId: context.activity.id,
        userId: context.user.id,
        config: parseParsonsConfig(context.activity.config),
        input
      });

      if (!attempt) {
        throw new AppError(409, "ATTEMPT_STATE_INVALID", "The Parsons attempt could not be updated.");
      }

      return { attempt };
    }
  }
};

export const parsonsGenerateRoute: PluginRouteDefinition = {
  path: "parsons/generate",
  activityTypeKeys: ["parsons-problem"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = parsonsGenerationInputSchema.parse(await readJson());
      await assertCanManageGenerationContext(context);
      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);

      return generateParsonsProblem({
        user: context.user,
        description: input.description,
        language: input.language,
        locale: input.locale,
        subject
      });
    }
  }
};
