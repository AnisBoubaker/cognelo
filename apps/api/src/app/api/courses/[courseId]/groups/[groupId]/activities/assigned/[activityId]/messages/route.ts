import { NextRequest } from "next/server";
import { z } from "zod";
import { getLearnerActivityConversation, markLearnerActivityConversationRead } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { requireSafeExamBrowserAccess } from "@/lib/safe-exam-browser";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

const readSchema = z.object({ conversationId: z.string().trim().min(1).max(191) }).strict();

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId);
    return json(await getLearnerActivityConversation(user, courseId, groupId, activityId));
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId);
    const input = readSchema.parse(await readJson(request));
    return json(await markLearnerActivityConversationRead(
      user,
      courseId,
      groupId,
      activityId,
      input.conversationId
    ));
  });
}
