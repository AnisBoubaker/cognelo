import type { ActivityDefinition, SubjectProgrammingLanguage } from "@/lib/api";

export function activityCreationConfig(
  activityTypeKey: string,
  definition: Pick<ActivityDefinition, "defaultConfig"> | undefined,
  programmingLanguage: SubjectProgrammingLanguage | null | undefined
) {
  const config = { ...(definition?.defaultConfig ?? {}) };
  if (activityTypeKey === "coding-exercise" && programmingLanguage) {
    config.language = programmingLanguage;
  }
  return config;
}
