import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { createSafeExamBrowserSession, safeExamBrowserAccessCookie } from "@/lib/safe-exam-browser";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

const inputSchema = z.object({
  token: z.string().min(1),
  configKeyHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  version: z.string().max(300).optional()
});

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const routeScope = await params;
    const input = inputSchema.parse(await readJson(request));
    const session = await createSafeExamBrowserSession(user, input.token, request, input.configKeyHash);
    if (
      session.scope.courseId !== routeScope.courseId ||
      session.scope.groupId !== routeScope.groupId ||
      session.scope.activityId !== routeScope.activityId
    ) {
      throw new AppError(403, "SAFE_EXAM_BROWSER_LAUNCH_SCOPE_INVALID", "This launch link belongs to another activity.");
    }
    const response = json({ accessGranted: true });
    response.cookies.set(safeExamBrowserAccessCookie(session.accessToken));
    return response;
  });
}
