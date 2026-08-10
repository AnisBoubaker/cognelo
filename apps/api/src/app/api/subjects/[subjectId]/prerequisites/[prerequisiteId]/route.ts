import { NextRequest } from "next/server";
import { deleteSubjectKnowledgePrerequisite } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ subjectId: string; prerequisiteId: string }> };
export function OPTIONS() { return options(); }
export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { subjectId, prerequisiteId } = await params;
    await deleteSubjectKnowledgePrerequisite(user, subjectId, prerequisiteId);
    return json({ ok: true });
  });
}
