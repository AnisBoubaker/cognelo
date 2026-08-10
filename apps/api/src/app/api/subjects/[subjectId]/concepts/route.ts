import { NextRequest } from "next/server";
import { createSubjectKnowledgeConcept } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ subjectId: string }> };
export function OPTIONS() { return options(); }
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId } = await params;
    return json({ concept: await createSubjectKnowledgeConcept(user, subjectId, await readJson(request)) }, { status: 201 });
  });
}
