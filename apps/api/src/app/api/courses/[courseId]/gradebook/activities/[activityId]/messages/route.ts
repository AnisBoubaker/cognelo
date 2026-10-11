import { NextRequest } from "next/server";
import { ActivityBroadcastMessageInputSchema } from "@cognelo/contracts";
import { getActivityMessagingOverview, sendActivityBroadcast } from "@cognelo/core";
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
    return json({ messaging: await getActivityMessagingOverview(user, courseId, activityId, groupId) });
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
