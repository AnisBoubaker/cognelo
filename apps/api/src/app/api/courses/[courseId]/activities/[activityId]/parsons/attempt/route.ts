import { NextRequest } from "next/server";
import { AppError, getActivity } from "@cognara/core";
import { parseParsonsConfig } from "@cognara/plugin-parsons";
import {
  ensureParsonsAttempt,
  parsonsAttemptEnsureInputSchema,
  parsonsAttemptUpdateInputSchema,
  updateParsonsAttempt
} from "@cognara/plugin-parsons/server";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const activity = await getActivity(user, courseId, activityId);
    if (activity.activityType.key !== "parsons-problem") {
      throw new AppError(400, "INVALID_ACTIVITY_TYPE", "This endpoint is only available for Parsons activities.");
    }

    const input = parsonsAttemptEnsureInputSchema.parse(await readJson(request));
    const attempt = await ensureParsonsAttempt({
      activityId: activity.id,
      userId: user.id,
      config: parseParsonsConfig((activity.config as Record<string, unknown> | null) ?? undefined),
      forceNew: input.forceNew
    });

    return json({ attempt });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const activity = await getActivity(user, courseId, activityId);
    if (activity.activityType.key !== "parsons-problem") {
      throw new AppError(400, "INVALID_ACTIVITY_TYPE", "This endpoint is only available for Parsons activities.");
    }

    const input = parsonsAttemptUpdateInputSchema.parse(await readJson(request));
    const attempt = await updateParsonsAttempt({
      activityId: activity.id,
      userId: user.id,
      config: parseParsonsConfig((activity.config as Record<string, unknown> | null) ?? undefined),
      input
    });

    if (!attempt) {
      throw new AppError(409, "ATTEMPT_STATE_INVALID", "The Parsons attempt could not be updated.");
    }

    return json({ attempt });
  });
}
