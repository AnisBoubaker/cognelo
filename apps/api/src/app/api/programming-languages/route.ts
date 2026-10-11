import { resolvePluginHostCapability } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    await requireUser();
    const listProgrammingLanguages = resolvePluginHostCapability<Array<{ key: string; label: string }>>("programming-languages");
    if (!listProgrammingLanguages) {
      throw new AppError(503, "PROGRAMMING_LANGUAGES_UNAVAILABLE", "No installed activity plugin provides programming languages.");
    }
    return json({ languages: await listProgrammingLanguages() });
  });
}
