import { NextRequest } from "next/server";
import { getSubject, updateSubject } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ subjectId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId } = await params;
    return json({ subject: await getSubject(user, subjectId) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId } = await params;
    return json({ subject: await updateSubject(user, subjectId, await readJson(request)) });
  });
}
