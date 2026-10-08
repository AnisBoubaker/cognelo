import { getCourseContentItemDeletionImpact } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; contentItemId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, contentItemId } = await params;
    return json({ impact: await getCourseContentItemDeletionImpact(user, courseId, contentItemId) });
  });
}
