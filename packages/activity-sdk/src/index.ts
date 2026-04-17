import { z } from "zod";

export type ActivityDefinition = {
  key: string;
  name: string;
  description: string;
  defaultConfig?: Record<string, unknown>;
  configSchema?: z.ZodTypeAny;
  metadataSchema?: z.ZodTypeAny;
};

const definitions = new Map<string, ActivityDefinition>();

export function registerActivity(definition: ActivityDefinition) {
  if (definitions.has(definition.key)) {
    throw new Error(`Activity type already registered: ${definition.key}`);
  }
  definitions.set(definition.key, definition);
}

export function getActivityDefinition(key: string) {
  return definitions.get(key);
}

export function listActivityDefinitions() {
  return Array.from(definitions.values());
}

registerActivity({
  key: "placeholder",
  name: "Placeholder activity",
  description: "A generic shell used while a pedagogical activity is being designed.",
  defaultConfig: {}
});

registerActivity({
  key: "homework-grader",
  name: "Homework grader",
  description: "Future programming assignment submission and grading workflow.",
  defaultConfig: {
    gradingMode: "manual",
    maxAttempts: 3
  },
  configSchema: z.object({
    gradingMode: z.enum(["manual", "automated", "hybrid"]).default("manual"),
    maxAttempts: z.number().int().min(1).max(100).default(3),
    repositoryTemplateUrl: z.string().url().optional()
  })
});
