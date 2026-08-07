import { NextRequest } from "next/server";
import { gradeTestItemManually } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; attemptId: string; testItemId: string }> };

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId, testItemId } = await params;
    const body = (await readJson(request)) as { score?: unknown; reason?: unknown; feedbackText?: unknown };
    return json({
      result: await gradeTestItemManually(user, courseId, attemptId, testItemId, {
        score: Number(body.score),
        reason: typeof body.reason === "string" ? body.reason : null,
        feedbackText: typeof body.feedbackText === "string" ? body.feedbackText : undefined
      })
    });
  });
}
