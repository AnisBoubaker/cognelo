import { getMediaMaintenanceOverview, runMediaMaintenance } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    return json({ overview: await getMediaMaintenanceOverview(user) });
  });
}

export async function POST() {
  return handleRoute(async () => {
    const user = await requireUser();
    return json(await runMediaMaintenance(user));
  });
}
