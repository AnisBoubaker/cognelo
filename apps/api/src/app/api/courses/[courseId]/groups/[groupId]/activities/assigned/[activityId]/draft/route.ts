import { NextRequest } from "next/server";
import { z } from "zod";
import {
  clearActivityResponseDraft,
  getActivityResponseDraft,
  saveActivityResponseDraft
} from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { requireSafeExamBrowserAccess } from "@/lib/safe-exam-browser";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

const draftInputSchema = z.object({
  state: z.record(z.unknown())
});

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId);
    const draft = await getActivityResponseDraft(user, courseId, groupId, activityId);
    return json({ draft });
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId);
    const input = draftInputSchema.parse(await readJson(request));
    const draft = await saveActivityResponseDraft(user, courseId, groupId, activityId, input.state);
    return json({ draft });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId);
    return json(await clearActivityResponseDraft(user, courseId, groupId, activityId));
  });
}
