import { NextRequest } from "next/server";
import { deleteGroupActivityAssignment, updateGroupActivityAssignment } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; assignmentId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, assignmentId } = await params;
    return json({ assignment: await updateGroupActivityAssignment(user, courseId, groupId, assignmentId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, assignmentId } = await params;
    return json(await deleteGroupActivityAssignment(user, courseId, groupId, assignmentId));
  });
}
