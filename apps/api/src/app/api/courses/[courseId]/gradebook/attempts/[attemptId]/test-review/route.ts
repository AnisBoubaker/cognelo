import type { NextRequest } from "next/server";
import { TestAttemptReviewInputSchema } from "@cognelo/contracts";
import { getTestAttemptTeacherReview, saveTestAttemptTeacherReview } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; attemptId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    return json({ review: await getTestAttemptTeacherReview(user, courseId, attemptId) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    return json(await saveTestAttemptTeacherReview(user, courseId, attemptId, TestAttemptReviewInputSchema.parse(await readJson(request))));
  });
}
