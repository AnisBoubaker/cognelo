import { AppError, getActivityContentAccess, finalizeClosedActivityContent, getLearnerActivityMessagingStatus } from "@cognelo/core";
import { requireSafeExamBrowserAccess } from "@/lib/safe-exam-browser";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };
export function OPTIONS() { return options(); }
// Receipts and access state contain no question, response, or grading content.
export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const { courseId, groupId, activityId } = await params;
    const user = await requireUser();
    const access = await getActivityContentAccess(user, courseId, groupId, activityId);
    let messaging = null;
    if (!access.locked && new URL(request.url).searchParams.has("messaging")) {
      let renewPresence = new URL(request.url).searchParams.get("messaging") === "presence";
      if (renewPresence) {
        try { await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId); }
        catch (error) {
          if (!(error instanceof AppError) || !["GROUP_ACTIVITY_NOT_AVAILABLE", "GROUP_ACTIVITY_HIDDEN", "SAFE_EXAM_BROWSER_REQUIRED"].includes(error.code)) throw error;
          renewPresence = false;
        }
      }
      try { messaging = await getLearnerActivityMessagingStatus(user, courseId, groupId, activityId, renewPresence); }
      catch (error) {
        if (!(error instanceof AppError) || !["GROUP_ACTIVITY_NOT_AVAILABLE", "GROUP_ACTIVITY_HIDDEN"].includes(error.code)) throw error;
        messaging = await getLearnerActivityMessagingStatus(user, courseId, groupId, activityId, false);
      }
    }
    return json({ access, messaging }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const { courseId, groupId, activityId } = await params;
    return json(await finalizeClosedActivityContent(await requireUser(), courseId, groupId, activityId), { headers: { "Cache-Control": "no-store" } });
  });
}
