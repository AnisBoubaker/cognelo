import { NextRequest } from "next/server";
import { deleteSubjectKnowledgeSkill, getSubjectKnowledgeSkillDeletionImpact } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ subjectId: string; conceptId: string; skillId: string }> };
export function OPTIONS() { return options(); }

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId, conceptId, skillId } = await params;
    return json({ impact: await getSubjectKnowledgeSkillDeletionImpact(user, subjectId, conceptId, skillId) });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId, conceptId, skillId } = await params;
    return json({ ok: true, impact: await deleteSubjectKnowledgeSkill(user, subjectId, conceptId, skillId, await readJson(request)) });
  });
}
