import { NextRequest } from "next/server";
import { AppError, listActivityLogs } from "@cognelo/core";
import { z } from "zod";
import { handleRoute, json, options, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; activityId: string }> };
export function OPTIONS() { return options(); }
export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(), { courseId, activityId } = await params;
    const cursor = request.nextUrl.searchParams.get("cursor");
    let value: unknown;
    if (cursor) {
      const bounded = z.string().max(1000).parse(cursor);
      try { value = JSON.parse(bounded); } catch { throw new AppError(400, "ACTIVITY_LOG_CURSOR_INVALID", "The log cursor is invalid."); }
    }
    const before = cursor ? z.object({ at: z.string().datetime(), id: z.string().min(1).max(300) }).strict().parse(value) : undefined;
    return json(await listActivityLogs(user, courseId, activityId, { groupId: request.nextUrl.searchParams.get("groupId") || undefined, before }));
  });
}
