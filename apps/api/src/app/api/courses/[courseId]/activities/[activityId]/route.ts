import { NextRequest } from "next/server";
import {
  canManageCourse,
  getActivity,
  getActivityForGradebook,
  updateActivity
} from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { deleteCourseActivityWithHooks } from "@/lib/course-activity-deletion";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json({
      activity: await (await canManageCourse(user, courseId)
        ? getActivity(user, courseId, activityId)
        : getActivityForGradebook(user, courseId, activityId))
    });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json({ activity: await updateActivity(user, courseId, activityId, await readJson(request)) });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json(await deleteCourseActivityWithHooks(user, courseId, activityId, {
      confirmRecordedAttempts: new URL(request.url).searchParams.get("confirmRecordedAttempts") === "true"
    }));
  });
}
