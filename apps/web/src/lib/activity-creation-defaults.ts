import type { ActivityDefinition, SubjectProgrammingLanguage } from "@/lib/api";
import { subjectMultipleProgrammingLanguages } from "@cognelo/contracts";

export function activityCreationConfig(
  activityTypeKey: string,
  definition: Pick<ActivityDefinition, "defaultConfig"> | undefined,
  programmingLanguage: SubjectProgrammingLanguage | null | undefined
) {
  const config = { ...(definition?.defaultConfig ?? {}) };
  if (activityTypeKey === "coding-exercise") {
    config.language = programmingLanguage && programmingLanguage !== subjectMultipleProgrammingLanguages
      ? programmingLanguage
      : "";
  }
  return config;
}
