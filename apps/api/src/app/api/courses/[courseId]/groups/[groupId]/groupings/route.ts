import { NextRequest } from "next/server";
import { createStudentGrouping, listStudentGroupings } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string }> };
export function OPTIONS() { return options(); }
export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    return json(await listStudentGroupings(user, courseId, groupId));
  });
}
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    return json({ grouping: await createStudentGrouping(user, courseId, groupId, await readJson(request)) }, { status: 201 });
  });
}
