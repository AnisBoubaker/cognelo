import { confirmUserEmail } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function PUT(_request: Request, context: { params: Promise<{ userId: string }> }) {
  return handleRoute(async () => {
    const currentUser = await requireUser();
    const { userId } = await context.params;
    return json({ user: await confirmUserEmail(currentUser, userId) });
  });
}
