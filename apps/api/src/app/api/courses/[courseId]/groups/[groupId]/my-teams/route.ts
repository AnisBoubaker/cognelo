import { NextRequest } from "next/server";
import { listMyStudentGroupings } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string }> };
export function OPTIONS() { return options(); }
export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    return json(await listMyStudentGroupings(user, courseId, groupId));
  });
}
