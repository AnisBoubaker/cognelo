import { NextRequest } from "next/server";
import { z } from "zod";
import { getTestRuntime, startOrResumeTestAttempt } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

export const dynamic = "force-dynamic";
const sessionSchema = z.object({ sessionId: z.string().min(1).max(200) });

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const view = searchParams.get("view") === "previous" ? "previous" : "attempt";
    return json({ runtime: await getTestRuntime(user, courseId, groupId, activityId, view, searchParams.get("sessionId")) });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    const { sessionId } = sessionSchema.parse(await readJson(request));
    return json({ runtime: await startOrResumeTestAttempt(user, courseId, groupId, activityId, sessionId) }, { status: 201 });
  });
}
