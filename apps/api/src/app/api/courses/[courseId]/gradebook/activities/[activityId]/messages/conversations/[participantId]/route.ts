import { NextRequest } from "next/server";
import { z } from "zod";
import { ActivityBroadcastMessageInputSchema, RecordIdSchema } from "@cognelo/contracts";
import { getStaffActivityConversation, markStaffActivityConversationRead, sendStaffActivityReply } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string; participantId: string }> };
export function OPTIONS() { return options(); }
export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId, participantId } = await params;
    const before = RecordIdSchema.optional().parse(request.nextUrl.searchParams.get("before") ?? undefined);
    const attemptId = RecordIdSchema.optional().parse(request.nextUrl.searchParams.get("attemptId") ?? undefined);
    return json(await getStaffActivityConversation(user, courseId, activityId, participantId, { before, attemptId }));
  });
}
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId, participantId } = await params;
    const { body } = ActivityBroadcastMessageInputSchema.parse(await readJson(request));
    return json(await sendStaffActivityReply(user, courseId, activityId, participantId, body), { status: 201 });
  });
}
export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId, participantId } = await params;
    const { lastMessageId, attemptId } = z.object({ lastMessageId: RecordIdSchema, attemptId: RecordIdSchema.optional() }).strict().parse(await readJson(request));
    return json(await markStaffActivityConversationRead(user, courseId, activityId, participantId, lastMessageId, attemptId));
  });
}
