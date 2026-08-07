import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveCompositeExecutionSubmissionHandler } from "@cognelo/activity-sdk/server";
import {
  AppError,
  assertActivityTypePluginEnabled,
  getTestItemExecutionContext,
  getTestRuntime,
  submitTestAttempt,
  submitTestItemAttemptResult
} from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

const inputSchema = z.object({ parentAttemptId: z.string().min(1) });

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    const input = inputSchema.parse(await readJson(request));
    const runtime = await getTestRuntime(user, courseId, groupId, activityId, "attempt");
    if (!runtime.attempt || runtime.attempt.id !== input.parentAttemptId || runtime.attempt.lifecycle !== "started") {
      throw new AppError(404, "TEST_ATTEMPT_NOT_FOUND", "The active Test attempt was not found.");
    }

    for (const item of runtime.test.items) {
      if (item.itemAttempt?.lifecycle === "submitted" || item.itemAttempt?.lifecycle === "graded") {
        continue;
      }
      const context = await getTestItemExecutionContext(
        user,
        courseId,
        groupId,
        activityId,
        input.parentAttemptId,
        item.id
      );
      const activityTypeKey = context.item.activity.activityType.key;
      await assertActivityTypePluginEnabled(activityTypeKey);
      const handler = resolveCompositeExecutionSubmissionHandler(activityTypeKey);
      if (!handler) {
        throw new AppError(409, "TEST_ITEM_COMPOSITE_UNSUPPORTED", `${context.item.activity.title} does not support Test submission yet.`);
      }
      const execution = await handler({
        user,
        courseId,
        groupId,
        parentAttemptId: input.parentAttemptId,
        testItemId: item.id,
        activity: {
          id: context.item.activity.id,
          bankActivityId: context.item.activity.bankActivityId,
          activityVersionId: context.item.activity.activityVersionId,
          title: context.item.activity.title,
          description: context.item.activity.description,
          lifecycle: context.item.activity.lifecycle,
          config: asRecord(context.item.activity.config),
          metadata: asRecord(context.item.activity.metadata),
          activityType: {
            key: activityTypeKey,
            name: context.item.activity.activityType.name,
            description: context.item.activity.activityType.description
          }
        },
        payload: item.itemAttempt?.state ?? {}
      });
      await submitTestItemAttemptResult(
        user,
        courseId,
        groupId,
        activityId,
        input.parentAttemptId,
        item.id,
        execution
      );
    }

    return json({ runtime: await submitTestAttempt(user, courseId, groupId, activityId, input.parentAttemptId) });
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
