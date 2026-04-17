import { listActivityTypes, listRegisteredActivityDefinitions } from "@cognara/core";
import { handleRoute, json, options } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    return json({
      activityTypes: await listActivityTypes(),
      registeredDefinitions: listRegisteredActivityDefinitions()
    });
  });
}
