import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { ensureParsonsAttempt, updateParsonsAttempt } from "./attempts";
import { parsonsAttemptEnsureInputSchema, parsonsAttemptUpdateInputSchema } from "./attempt-types";
import { parseParsonsConfig } from "./parsons";

export const parsonsAttemptRoute: PluginRouteDefinition = {
  path: "parsons/attempt",
  activityTypeKeys: ["parsons-problem"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = parsonsAttemptEnsureInputSchema.parse(await readJson());
      const attempt = await ensureParsonsAttempt({
        activityId: context.activity.id,
        userId: context.user.id,
        config: parseParsonsConfig(context.activity.config),
        forceNew: input.forceNew
      });

      return { attempt };
    },
    PATCH: async ({ context, readJson }) => {
      const input = parsonsAttemptUpdateInputSchema.parse(await readJson());
      const attempt = await updateParsonsAttempt({
        activityId: context.activity.id,
        userId: context.user.id,
        config: parseParsonsConfig(context.activity.config),
        input
      });

      if (!attempt) {
        throw new AppError(409, "ATTEMPT_STATE_INVALID", "The Parsons attempt could not be updated.");
      }

      return { attempt };
    }
  }
};
