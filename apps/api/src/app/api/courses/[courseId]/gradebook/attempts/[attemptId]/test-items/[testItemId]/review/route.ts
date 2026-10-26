import type { NextRequest } from "next/server";
import { z } from "zod";
import { getTestItemTeacherReview, saveTestItemTeacherReview } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; attemptId: string; testItemId: string }> };
const saveSchema = z.object({
  expectedUpdatedAt: z.iso.datetime(), expectedFeedbackHash: z.string().nullable(),
  feedback: z.unknown().optional(), feedbackText: z.string().max(10000).optional(),
  score: z.number().finite().min(0).optional(), reason: z.string().trim().max(1000).nullable().optional()
}).strict();

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
    return json(await saveTestItemTeacherReview(user, courseId, attemptId, testItemId, saveSchema.parse(await readJson(request))));
  });
}
