import { getActivityContentAccess, finalizeClosedActivityContent } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };
export function OPTIONS() { return options(); }
// Receipts and access state contain no question, response, or grading content.
export async function GET(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const { courseId, groupId, activityId } = await params;
    return json({ access: await getActivityContentAccess(await requireUser(), courseId, groupId, activityId) }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const { courseId, groupId, activityId } = await params;
    return json(await finalizeClosedActivityContent(await requireUser(), courseId, groupId, activityId), { headers: { "Cache-Control": "no-store" } });
  });
}
