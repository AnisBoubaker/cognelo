import { resolveStudentPreviewExecutionHandler } from "@cognelo/activity-sdk/server";
import { AppError, getGroupAssignedActivityForStudentPreview } from "@cognelo/core";
import type { NextRequest } from "next/server";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string; action: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId, action } = await params;
    const activity = await getGroupAssignedActivityForStudentPreview(user, courseId, groupId, activityId);
    const handler = resolveStudentPreviewExecutionHandler(activity.activityType.key, action);
    if (!handler) {
      throw new AppError(404, "STUDENT_PREVIEW_ACTION_UNAVAILABLE", "This activity does not support that Student view action.");
    }
    return json(await handler({
      user,
      courseId,
      groupId,
      activity: {
        ...activity,
        config: asRecord(activity.config),
        metadata: asRecord(activity.metadata),
        assignment: {
          ...activity.assignment,
          config: asRecord(activity.assignment.config),
          metadata: asRecord(activity.assignment.metadata)
        }
      },
      payload: await readJson(request)
    }));
  });
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
