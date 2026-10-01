import { NextRequest } from "next/server";
import { deleteSubjectKnowledgeMisconception, getSubjectKnowledgeMisconceptionDeletionImpact } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ subjectId: string; conceptId: string; misconceptionId: string }> };
export function OPTIONS() { return options(); }

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId, conceptId, misconceptionId } = await params;
    return json({ impact: await getSubjectKnowledgeMisconceptionDeletionImpact(user, subjectId, conceptId, misconceptionId) });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId, conceptId, misconceptionId } = await params;
    return json({ ok: true, impact: await deleteSubjectKnowledgeMisconception(user, subjectId, conceptId, misconceptionId, await readJson(request)) });
  });
}
