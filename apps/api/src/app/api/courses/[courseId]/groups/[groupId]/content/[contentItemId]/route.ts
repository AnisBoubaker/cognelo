import { NextRequest } from "next/server";
import { deleteContentItem, updateGroupContentItem } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; contentItemId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, contentItemId } = await params;
    return json({ contentItem: await updateGroupContentItem(user, courseId, groupId, contentItemId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, contentItemId } = await params;
    return json(await deleteContentItem(user, courseId, contentItemId, { groupId }));
  });
}
