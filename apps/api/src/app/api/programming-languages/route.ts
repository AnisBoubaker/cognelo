import { listCodingExerciseProgrammingLanguages } from "@cognelo/plugin-coding-exercises/server";
import { handleRoute, json, options, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    await requireUser();
    return json({ languages: await listCodingExerciseProgrammingLanguages() });
  });
}
