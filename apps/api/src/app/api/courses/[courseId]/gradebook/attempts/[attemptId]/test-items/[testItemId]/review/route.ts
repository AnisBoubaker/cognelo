import type { NextRequest } from "next/server";
import { TestItemReviewInputSchema } from "@cognelo/contracts";
import { getTestItemTeacherReview, saveTestItemTeacherReview } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; attemptId: string; testItemId: string }> };

export function OPTIONS() { return options(); }

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId, testItemId } = await params;
    return json({ review: await getTestItemTeacherReview(user, courseId, attemptId, testItemId) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId, testItemId } = await params;
    return json(await saveTestItemTeacherReview(user, courseId, attemptId, testItemId, TestItemReviewInputSchema.parse(await readJson(request))));
  });
}
