import { randomUUID } from "node:crypto";
import type { PluginAiGradingInstructionsContext, PluginAiGradingInstructionsHandler } from "@cognelo/activity-sdk/server";
import { codingExerciseAiFeedbackConfigSchema, parseCodingExercisePrivateConfig } from "./coding-exercises";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
async function readPrivateConfig({ scope, activityId, transaction }: PluginAiGradingInstructionsContext) {
  const rows = scope === "course"
    ? await transaction.query<Array<{ privateConfig: unknown }>>`SELECT "privateConfig" FROM "PluginCodingExerciseReferenceSolution" WHERE "activityId" = ${activityId}`
    : await transaction.query<Array<{ privateConfig: unknown }>>`SELECT "privateConfig" FROM "PluginBankCodingExerciseReferenceSolution" WHERE "bankActivityId" = ${activityId}`;
  return record(rows[0]?.privateConfig);
}

export const codingExerciseGradingInstructions: PluginAiGradingInstructionsHandler = {
  activityTypeKeys: ["coding-exercise"],
  getInstructions: async input => parseCodingExercisePrivateConfig(await readPrivateConfig(input)).aiFeedback.instructions,
  replaceInstructions: async input => {
    const { scope, activityId, instructions, transaction } = input;
    const before = await readPrivateConfig(input);
    codingExerciseAiFeedbackConfigSchema.parse({ ...parseCodingExercisePrivateConfig(before).aiFeedback, instructions });
    // Update only the nested instruction field; keep the rubric, weights, solution and tests intact.
    const patch = JSON.stringify({ instructions });
    const initial = JSON.stringify({ aiFeedback: { instructions } });
    if (scope === "course") {
      await transaction.execute`INSERT INTO "PluginCodingExerciseReferenceSolution"
        ("id", "activityId", "sourceCode", "privateConfig", "validationSummary", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${activityId}, '', ${initial}::jsonb, '{}'::jsonb, NOW(), NOW())
        ON CONFLICT ("activityId") DO UPDATE SET
          "privateConfig" = jsonb_set("PluginCodingExerciseReferenceSolution"."privateConfig", '{aiFeedback}',
            COALESCE("PluginCodingExerciseReferenceSolution"."privateConfig"->'aiFeedback', '{}'::jsonb) || ${patch}::jsonb),
          "updatedAt" = NOW()`;
      await transaction.execute`INSERT INTO "PluginCodingExerciseAuthoringRevision"
        ("id", "activityId", "actorUserId", "previousValue", "nextValue", "createdAt")
        VALUES (${randomUUID()}, ${activityId}, ${input.actorUserId}, ${JSON.stringify({ privateConfig: before })}::jsonb,
          ${JSON.stringify({ privateConfig: { ...before, aiFeedback: { ...record(before.aiFeedback), instructions } } })}::jsonb, NOW())`;
    } else {
      await transaction.execute`INSERT INTO "PluginBankCodingExerciseReferenceSolution"
        ("id", "bankActivityId", "sourceCode", "privateConfig", "validationSummary", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${activityId}, '', ${initial}::jsonb, '{}'::jsonb, NOW(), NOW())
        ON CONFLICT ("bankActivityId") DO UPDATE SET
          "privateConfig" = jsonb_set("PluginBankCodingExerciseReferenceSolution"."privateConfig", '{aiFeedback}',
            COALESCE("PluginBankCodingExerciseReferenceSolution"."privateConfig"->'aiFeedback', '{}'::jsonb) || ${patch}::jsonb),
          "updatedAt" = NOW()`;
    }
  }
};
