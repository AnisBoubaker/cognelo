import { NextRequest } from "next/server";
import { listCourseGradeChallenges } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    return json({ challenges: await listCourseGradeChallenges(user, courseId, request.nextUrl.searchParams.get("status")) });
  });
}
