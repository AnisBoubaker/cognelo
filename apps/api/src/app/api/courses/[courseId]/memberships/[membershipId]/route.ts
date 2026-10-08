import { removeCourseMembership } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; membershipId: string }> };

export function OPTIONS() {
  return options();
}

export async function DELETE(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, membershipId } = await params;
    return json(await removeCourseMembership(user, courseId, membershipId));
  });
}
