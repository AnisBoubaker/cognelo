import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import type { Prisma } from "@prisma/client";
import {
  AppError,
  assertCanManageActivityBank,
  assertCanManageCourse,
  getActivityAttemptAvailability,
  recordActivityAttemptGradingResult,
  startActivityAttempt,
  submitActivityAttempt
} from "@cognelo/core";
import { prisma } from "@cognelo/db";
import { ensureParsonsAttempt, findLatestParsonsAttempt, listParsonsGradebookAttempts, updateParsonsAttempt } from "./attempts";
import {
  parsonsAttemptEnsureInputSchema,
  parsonsAttemptStateSchema,
  parsonsAttemptUpdateInputSchema,
  type ParsonsAttemptState
} from "./attempt-types";
import { generateParsonsProblem, parsonsGenerationInputSchema } from "./generation";
import { buildParsonsGradingResult } from "./grading";
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
      const config = parseParsonsConfig(context.activity.config);
      if (context.courseId && context.groupId && context.activity.assignment?.metadata?.assessmentMode === "summative") {
        const availability = await getActivityAttemptAvailability(context.user, {
          courseId: context.courseId,
          groupId: context.groupId,
          activityId: context.activity.id
        });
        if (!availability.canStart) {
          const latestCompletedAttempt = await findLatestParsonsAttempt({
            activityId: context.activity.id,
            userId: context.user.id,
            config,
            status: "completed"
          });
          if (latestCompletedAttempt) {
            return { attempt: latestCompletedAttempt, attemptAvailability: availability };
          }
        }
      }
      const attempt = await ensureParsonsAttempt({
        activityId: context.activity.id,
        userId: context.user.id,
        config,
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

      if (input.submit && context.courseId && context.groupId && context.activity.assignment?.metadata?.assessmentMode === "summative") {
        if (!input.result) {
          throw new AppError(400, "PARSONS_SUBMISSION_RESULT_REQUIRED", "A Parsons submission requires a grading result.");
        }
        const coreAttempt = await startActivityAttempt(context.user, {
          courseId: context.courseId,
          groupId: context.groupId,
          activityId: context.activity.id,
          pluginKey: "parsons",
          pluginVersion: "0.1.0",
          pluginAttemptRef: attempt.id,
          activityConfigFingerprint: attempt.latestState.configFingerprint,
          metadata: {
            mode: "summative",
            submittedState: attempt.latestState
          }
        });
        const submittedAttempt = await submitActivityAttempt(context.user, {
          attemptId: coreAttempt.id,
          pluginAttemptRef: attempt.id,
          metadata: {
            mode: "summative",
            submittedState: attempt.latestState
          }
        });
        const gradingResult = buildParsonsGradingResult(input.result);
        await recordActivityAttemptGradingResult(context.user, {
          attemptId: submittedAttempt.id,
          rawScore: gradingResult.rawScore,
          rawMaxScore: gradingResult.rawMaxScore,
          source: "auto",
          isPass: gradingResult.isPass,
          rawResult: {
            evaluation: input.result,
            analyticsPayload: gradingResult.analyticsPayload
          } as Prisma.InputJsonValue,
          normalizedResult: gradingResult.metadata as Prisma.InputJsonValue
        });
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
        subject,
        knowledge: input.knowledge
      });
    }
  }
};

export const parsonsStudentSubmissionsRoute: PluginRouteDefinition = {
  path: "parsons/submissions",
  activityTypeKeys: ["parsons-problem"],
  methods: {
    GET: async ({ context }) => {
      if (!context.courseId || !context.groupId) {
        throw new AppError(400, "GROUP_CONTEXT_REQUIRED", "Parsons submissions require a group activity context.");
      }
      const participant = await prisma.courseGroupParticipant.findFirst({
        where: {
          groupId: context.groupId,
          userId: context.user.id,
          role: "student"
        },
        select: { id: true, userId: true }
      });
      if (!participant?.userId) {
        throw new AppError(403, "PARTICIPANT_REQUIRED", "Only enrolled students can view submissions for this activity.");
      }

      const config = parseParsonsConfig(context.activity.config);
      const attempts = await listParsonsGradebookAttempts({
        activityId: context.activity.id,
        userId: participant.userId,
        config
      });
      const submittedStatesByPluginAttempt = await listSubmittedStatesByPluginAttempt({
        courseId: context.courseId,
        groupId: context.groupId,
        activityId: context.activity.id,
        participantId: participant.id
      });

      return {
        submissions: attempts.flatMap((attempt) => {
          const submittedState = submittedStatesByPluginAttempt.get(attempt.id);
          if (!submittedState) {
            return [];
          }
          const evaluation = submittedState.lastEvaluation ?? null;
          const grade = evaluation ? buildParsonsGradingResult(evaluation) : null;
          return [{
            attempt: {
              ...attempt,
              latestState: submittedState,
              submittedState
            },
            grade: grade
              ? {
                  rawScore: grade.rawScore,
                  rawMaxScore: grade.rawMaxScore,
                  normalizedScore: grade.rawScore * 100,
                  normalizedMaxScore: 100
                }
              : null
          }];
        })
      };
    }
  }
};

export const parsonsGradebookAttemptsRoute: PluginRouteDefinition = {
  path: "parsons/gradebook-attempts",
  activityTypeKeys: ["parsons-problem"],
  methods: {
    GET: async ({ context, request }) => {
      if (!context.courseId || !context.groupId) {
        throw new AppError(400, "GROUP_CONTEXT_REQUIRED", "Gradebook attempts require a group activity context.");
      }
      await assertCanManageCourse(context.user, context.courseId);

      const searchParams = new URL(request.url).searchParams;
      const participantId = searchParams.get("participantId");
      if (!participantId) {
        throw new AppError(400, "PARTICIPANT_REQUIRED", "A participant is required.");
      }

      const participant = await prisma.courseGroupParticipant.findFirst({
        where: {
          id: participantId,
          groupId: context.groupId,
          role: "student"
        },
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });

      if (!participant) {
        throw new AppError(404, "PARTICIPANT_NOT_FOUND", "The participant was not found.");
      }
      if (!participant.userId) {
        return {
          participant,
          attempts: []
        };
      }

      const attempts = await listParsonsGradebookAttempts({
        activityId: context.activity.id,
        userId: participant.userId,
        config: parseParsonsConfig(context.activity.config),
        includeAttempts: searchParams.get("includeAttempts") === "true"
      });
      const submittedStatesByPluginAttempt = await listSubmittedStatesByPluginAttempt({
        courseId: context.courseId,
        groupId: context.groupId,
        activityId: context.activity.id,
        participantId
      });

      return {
        participant,
        attempts: attempts.map((attempt) => {
          const submittedState = submittedStatesByPluginAttempt.get(attempt.id);
          return submittedState
            ? {
                ...attempt,
                latestState: submittedState,
                submittedState
              }
            : attempt;
        })
      };
    }
  }
};

async function listSubmittedStatesByPluginAttempt(input: {
  courseId: string;
  groupId: string;
  activityId: string;
  participantId: string;
}) {
  const coreAttempts = await prisma.activityAttempt.findMany({
    where: {
      courseId: input.courseId,
      groupId: input.groupId,
      activityId: input.activityId,
      participantId: input.participantId,
      pluginKey: "parsons",
      pluginAttemptRef: { not: null },
      lifecycle: { in: ["submitted", "graded"] }
    },
    select: {
      pluginAttemptRef: true,
      metadata: true
    },
    orderBy: [{ attemptNumber: "desc" }]
  });

  const statesByAttempt = new Map<string, ParsonsAttemptState>();
  coreAttempts.forEach((attempt) => {
    if (!attempt.pluginAttemptRef || statesByAttempt.has(attempt.pluginAttemptRef)) {
      return;
    }
    const metadata = attempt.metadata && typeof attempt.metadata === "object" && !Array.isArray(attempt.metadata) ? attempt.metadata : {};
    const submittedState = parsonsAttemptStateSchema.safeParse((metadata as Record<string, unknown>).submittedState);
    if (submittedState.success) {
      statesByAttempt.set(attempt.pluginAttemptRef, submittedState.data);
    }
  });

  return statesByAttempt;
}
