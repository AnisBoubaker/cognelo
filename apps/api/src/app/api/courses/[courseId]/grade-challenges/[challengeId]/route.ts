import { NextRequest } from "next/server";
import { getServerEnv } from "@cognelo/config";
import { resolveGradeChallenge } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; challengeId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, challengeId } = await params;
    const env = getServerEnv();
    return json({
      challenge: await resolveGradeChallenge(
        user,
        courseId,
        challengeId,
        await readJson(request),
        env.EMAIL_CREDENTIALS_ENCRYPTION_KEY
      )
    });
  });
}
