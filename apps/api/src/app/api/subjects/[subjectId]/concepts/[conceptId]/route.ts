import { NextRequest } from "next/server";
import { deleteSubjectKnowledgeConcept, updateSubjectKnowledgeConcept } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ subjectId: string; conceptId: string }> };
export function OPTIONS() { return options(); }
export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId, conceptId } = await params;
    return json({ concept: await updateSubjectKnowledgeConcept(user, subjectId, conceptId, await readJson(request)) });
  });
}
export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId, conceptId } = await params;
    await deleteSubjectKnowledgeConcept(user, subjectId, conceptId);
    return json({ ok: true });
  });
}
