import { getApplicationTime } from "@cognelo/core";
import { handleRoute, json, options } from "@/lib/http";
export function OPTIONS() { return options(); }
// Public clock/timezone only; no private settings or account information.
export async function GET() {
  return handleRoute(async () => json(await getApplicationTime(), { headers: { "Cache-Control": "no-store" } }));
}
