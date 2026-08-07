import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveCompositeExecutionActionHandler } from "@cognelo/activity-sdk/server";
import { AppError, assertActivityTypePluginEnabled, getTestItemExecutionContext } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = {
  params: Promise<{
    courseId: string;
    groupId: string;
    activityId: string;
    testItemId: string;
    action: string;
  }>;
};

const inputSchema = z.object({
  parentAttemptId: z.string().min(1),
  sessionId: z.string().min(1).max(200),
  payload: z.unknown()
});

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId, testItemId, action } = await params;
    const input = inputSchema.parse(await readJson(request));
    const context = await getTestItemExecutionContext(
      user,
      courseId,
      groupId,
      activityId,
      input.parentAttemptId,
      testItemId,
      { sessionId: input.sessionId }
    );
    const activityTypeKey = context.item.activity.activityType.key;
    await assertActivityTypePluginEnabled(activityTypeKey);
    const handler = resolveCompositeExecutionActionHandler(activityTypeKey, action);
    if (!handler) {
      throw new AppError(404, "TEST_ITEM_ACTION_NOT_FOUND", "This Test activity does not support the requested action.");
    }
    const result = await handler({
      user,
      courseId,
      groupId,
      parentAttemptId: input.parentAttemptId,
      testItemId,
      activity: {
        id: context.item.activity.id,
        title: context.item.activity.title,
        description: context.item.activity.description,
        lifecycle: context.item.activity.lifecycle,
        config: (context.item.activity.config as Record<string, unknown> | null) ?? undefined,
        metadata: (context.item.activity.metadata as Record<string, unknown> | null) ?? undefined,
        activityType: {
          key: activityTypeKey,
          name: context.item.activity.activityType.name,
          description: context.item.activity.activityType.description
        }
      },
      payload: input.payload
    });
    return json(result);
  });
}
