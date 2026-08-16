import { NextRequest } from "next/server";
import { duplicateCourseContentItem } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; contentItemId: string }> };
export function OPTIONS() { return options(); }
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, contentItemId } = await params;
    return json(await duplicateCourseContentItem(user, courseId, contentItemId, await readJson(request)), { status: 201 });
  });
}
