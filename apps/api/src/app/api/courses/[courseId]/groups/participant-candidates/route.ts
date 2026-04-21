import { NextRequest } from "next/server";
import { lookupGroupParticipantCandidate } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    const email = request.nextUrl.searchParams.get("email") ?? "";
    return json({ candidate: await lookupGroupParticipantCandidate(user, courseId, email) });
  });
}
