import { NextRequest } from "next/server";
import { removeGroupParticipant } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; participantId: string }> };

export function OPTIONS() {
  return options();
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, participantId } = await params;
    return json(await removeGroupParticipant(user, courseId, groupId, participantId));
  });
}
