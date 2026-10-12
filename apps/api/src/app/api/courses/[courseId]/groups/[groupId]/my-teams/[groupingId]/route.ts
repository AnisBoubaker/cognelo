import { NextRequest } from "next/server";
import { chooseStudentTeam } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; groupingId: string }> };
export function OPTIONS() { return options(); }
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, groupingId } = await params;
    return json(await chooseStudentTeam(user, courseId, groupId, groupingId, await readJson(request)));
  });
}
