import { NextRequest } from "next/server";
import { deleteContentItem, updateContentItem } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; contentItemId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, contentItemId } = await params;
    return json({ contentItem: await updateContentItem(user, courseId, contentItemId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, contentItemId } = await params;
    return json(await deleteContentItem(user, courseId, contentItemId));
  });
}
