import { NextRequest } from "next/server";
import { ActivityBroadcastMessageInputSchema, RecordIdSchema } from "@cognelo/contracts";
import { getActivityMessagingStatus, getActivityMessagingOverview, sendActivityBroadcast } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const groupId = request.nextUrl.searchParams.get("groupId");
    if (request.nextUrl.searchParams.get("summary") === "1") return json({ messaging: await getActivityMessagingStatus(user, courseId, activityId, groupId) });
    return json({ messaging: await getActivityMessagingOverview(user, courseId, activityId, groupId, undefined, RecordIdSchema.optional().parse(request.nextUrl.searchParams.get("before") ?? undefined)) });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const groupId = request.nextUrl.searchParams.get("groupId");
    const input = ActivityBroadcastMessageInputSchema.parse(await readJson(request));
    return json(await sendActivityBroadcast(user, courseId, activityId, input.body, groupId), { status: 201 });
  });
}
