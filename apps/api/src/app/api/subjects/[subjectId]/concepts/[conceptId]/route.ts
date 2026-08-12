import { NextRequest } from "next/server";
import { deleteSubjectKnowledgeConcept, getSubjectKnowledgeConceptDeletionImpact, updateSubjectKnowledgeConcept } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ subjectId: string; conceptId: string }> };
export function OPTIONS() { return options(); }
export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId, conceptId } = await params;
    return json({ impact: await getSubjectKnowledgeConceptDeletionImpact(user, subjectId, conceptId) });
  });
}
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
    return json({ ok: true, impact: await deleteSubjectKnowledgeConcept(user, subjectId, conceptId) });
  });
}
