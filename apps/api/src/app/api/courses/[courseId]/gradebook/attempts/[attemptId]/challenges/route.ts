import { NextRequest } from "next/server";
import { createGradeChallenge, listAttemptGradeChallenges } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; attemptId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    return json({ challenges: await listAttemptGradeChallenges(user, courseId, attemptId) });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    return json({ challenge: await createGradeChallenge(user, courseId, attemptId, await readJson(request)) }, { status: 201 });
  });
}
