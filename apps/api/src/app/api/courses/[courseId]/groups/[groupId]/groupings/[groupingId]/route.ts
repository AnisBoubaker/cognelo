import { NextRequest } from "next/server";
import { deleteStudentGrouping, updateStudentGrouping } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; groupingId: string }> };
export function OPTIONS() { return options(); }
export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, groupingId } = await params;
    return json({ grouping: await updateStudentGrouping(user, courseId, groupId, groupingId, await readJson(request)) });
  });
}
export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, groupingId } = await params;
    return json(await deleteStudentGrouping(user, courseId, groupId, groupingId, await readJson(request)));
  });
}
