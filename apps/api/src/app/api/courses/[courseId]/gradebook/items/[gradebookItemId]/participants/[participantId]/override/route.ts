import { NextRequest } from "next/server";
import { z } from "zod";
import { overrideGradebookGrade } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; gradebookItemId: string; participantId: string }> };

const overrideInputSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number().positive().optional(),
  isPass: z.boolean().nullable().optional(),
  reason: z.string().max(1000).nullable().optional(),
  feedbackText: z.string().max(4000).nullable().optional()
});

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, gradebookItemId, participantId } = await params;
    const input = overrideInputSchema.parse(await readJson(request));
    return json({
      grade: await overrideGradebookGrade(user, courseId, {
        gradebookItemId,
        participantId,
        score: input.score,
        maxScore: input.maxScore,
        isPass: input.isPass,
        reason: input.reason,
        feedbackText: input.feedbackText
      })
    });
  });
}
