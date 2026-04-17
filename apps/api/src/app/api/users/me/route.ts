import { getMe } from "@cognara/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    return json({ user: await getMe(user) });
  });
}
