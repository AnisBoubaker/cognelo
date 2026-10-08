import { getStudentPreviewWorkspace } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    return json({ workspace: await getStudentPreviewWorkspace(user, courseId, groupId) });
  });
}
