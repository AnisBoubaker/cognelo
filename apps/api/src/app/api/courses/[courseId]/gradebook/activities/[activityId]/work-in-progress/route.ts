import { NextRequest } from "next/server";
import { inspectActivityWork, inspectActivityWorkFile } from "@cognelo/core";
import { z } from "zod";
import { handleRoute, json, options, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; activityId: string }> };
export function OPTIONS() { return options(); }
export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(), { courseId, activityId } = await params;
    const query = request.nextUrl.searchParams;
    const groupId = z.string().min(1).max(200).parse(query.get("groupId")), participantId = z.string().min(1).max(200).parse(query.get("participantId"));
    const file = query.get("file");
    return json(file !== null ? await inspectActivityWorkFile(user, courseId, activityId, groupId, participantId, z.string().min(1).max(4000).parse(file))
      : await inspectActivityWork(user, courseId, activityId, groupId, participantId, query.has("testItemId") ? z.string().min(1).max(200).parse(query.get("testItemId")) : undefined));
  });
}
