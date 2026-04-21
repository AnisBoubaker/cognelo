import { NextRequest } from "next/server";
import { addGroupParticipant } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string }> };

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    return json({ participant: await addGroupParticipant(user, courseId, groupId, await readJson(request)) }, { status: 201 });
  });
}
