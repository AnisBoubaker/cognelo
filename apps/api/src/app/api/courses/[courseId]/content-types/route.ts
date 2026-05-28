import { assertCanViewCourse, listActiveContentTypeDefinitions, listEnabledContentTypeDefinitions } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    await assertCanViewCourse(user, courseId);
    const contentTypes = await listEnabledContentTypeDefinitions();
    const activeContentTypes = await listActiveContentTypeDefinitions();
    return json({ contentTypes, activeContentTypes });
  });
}
