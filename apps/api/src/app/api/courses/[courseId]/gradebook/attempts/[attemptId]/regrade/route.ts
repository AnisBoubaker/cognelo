import { NextRequest } from "next/server";
import { resolvePluginGradingHandler } from "@cognelo/activity-sdk/server";
import { AppError, getActivityAttemptRegradeContext, recordActivityAttemptGradingResult, regradeTestAttempt } from "@cognelo/core";
import type { Prisma } from "@cognelo/db";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; attemptId: string }> };

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    const body = (await readJson(request)) as { reason?: unknown };
    const reason = typeof body.reason === "string" ? body.reason : null;
    const context = await getActivityAttemptRegradeContext(user, courseId, attemptId);
    if (context.activityTypeKey === "test") {
      return json({ result: await regradeTestAttempt(user, courseId, attemptId, reason) });
    }
    const gradeAttempt = resolvePluginGradingHandler(context.activityTypeKey);

    if (!gradeAttempt) {
      throw new AppError(409, "PLUGIN_REGRADING_UNAVAILABLE", "This activity type does not support automatic regrading.");
    }

    const gradingResult = await gradeAttempt({
      user,
      courseId: context.courseId,
      groupId: context.groupId,
      activityId: context.activityId,
      coreAttemptId: context.attemptId,
      pluginAttemptRef: context.pluginAttemptRef,
      activity: context.activity
    });

    return json({
      result: await recordActivityAttemptGradingResult(user, {
        attemptId: context.attemptId,
        rawScore: gradingResult.rawScore,
        rawMaxScore: gradingResult.rawMaxScore,
        source: "regrade",
        isPass: gradingResult.isPass,
        rawResult: {
          feedback: gradingResult.feedback ?? {},
          analyticsPayload: gradingResult.analyticsPayload ?? {}
        } as Prisma.InputJsonValue,
        normalizedResult: (gradingResult.metadata ?? {}) as Prisma.InputJsonValue,
        reason
      })
    });
  });
}
