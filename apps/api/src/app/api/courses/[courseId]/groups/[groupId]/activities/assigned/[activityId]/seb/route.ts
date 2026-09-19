import { NextRequest } from "next/server";
import { getServerEnv } from "@cognelo/config";
import { createSafeExamBrowserLaunchToken, getGroupAssignedActivityAccess } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";
import {
  buildSafeExamBrowserConfiguration,
  hasSafeExamBrowserAccess,
  SAFE_EXAM_BROWSER_DOWNLOAD_URL
} from "@/lib/safe-exam-browser";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    const access = await getGroupAssignedActivityAccess(user, courseId, groupId, activityId);
    const accessGranted = access.canBypass || !access.requiresSafeExamBrowser || await hasSafeExamBrowserAccess(user, {
      courseId,
      groupId,
      activityId
    });
    return json({
      access: {
        title: access.title,
        requiresSafeExamBrowser: access.requiresSafeExamBrowser,
        accessGranted,
        downloadSafeExamBrowserUrl: SAFE_EXAM_BROWSER_DOWNLOAD_URL
      }
    });
  });
}

export async function POST(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    const access = await getGroupAssignedActivityAccess(user, courseId, groupId, activityId);
    if (!access.requiresSafeExamBrowser) {
      return json({ launch: null });
    }
    const token = await createSafeExamBrowserLaunchToken(
      { userId: user.id, courseId, groupId, activityId },
      getServerEnv().JWT_SECRET
    );
    const config = buildSafeExamBrowserConfiguration({ courseId, groupId, activityId }, token);
    return json({
      launch: {
        launchUrl: config.launchUrl,
        downloadUrl: config.downloadUrl,
        expiresInSeconds: 600
      }
    });
  });
}
