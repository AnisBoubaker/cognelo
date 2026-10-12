import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, getStoredLearnerActivityConversation, getLearnerActivityConversation, markLearnerActivityConversationRead } from "@cognelo/core";
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
    try {
      await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId);
      return json(await getLearnerActivityConversation(user, courseId, groupId, activityId));
    } catch (error) {
      if (!(error instanceof AppError) || !["GROUP_ACTIVITY_NOT_AVAILABLE", "GROUP_ACTIVITY_HIDDEN", "SAFE_EXAM_BROWSER_REQUIRED"].includes(error.code)) throw error;
      return json(await getStoredLearnerActivityConversation(user, courseId, groupId, activityId));
    }
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    // The core read marker checks ownership; it does not grant access to activity content.
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
