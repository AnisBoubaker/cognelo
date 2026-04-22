import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { assertCanManageCourse } from "@cognelo/core";
import {
  codingExerciseRunInputSchema,
  codingExerciseSubmitInputSchema,
  listRecentCodingExerciseExecutions,
  runCodingExercise,
  submitCodingExercise
} from "./executions";
import { listCodingExerciseHiddenTests, replaceCodingExerciseHiddenTests } from "./hidden-tests";

export const codingExerciseRunRoute: PluginRouteDefinition = {
  path: "coding-exercises/run",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const executions = await listRecentCodingExerciseExecutions({
        activityId: context.activity.id,
        userId: context.user.id
      });

      return { executions };
    },
    POST: async ({ context, readJson }) => {
      const input = codingExerciseRunInputSchema.parse(await readJson());
      const execution = await runCodingExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        activityConfig: context.activity.config,
        input
      });

      return { execution };
    }
  }
};

export const codingExerciseSubmitRoute: PluginRouteDefinition = {
  path: "coding-exercises/submit",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const executions = await listRecentCodingExerciseExecutions({
        activityId: context.activity.id,
        userId: context.user.id
      });

      return { executions: executions.filter((execution) => execution.kind === "submit") };
    },
    POST: async ({ context, readJson }) => {
      const input = codingExerciseSubmitInputSchema.parse(await readJson());
      const execution = await submitCodingExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        activityConfig: context.activity.config,
        input
      });

      return { execution };
    }
  }
};

export const codingExerciseHiddenTestsRoute: PluginRouteDefinition = {
  path: "coding-exercises/hidden-tests",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      await assertCanManageCourse(context.user, context.courseId);
      const result = await listCodingExerciseHiddenTests({
        activityId: context.activity.id
      });

      return result;
    },
    PUT: async ({ context, readJson }) => {
      const result = await replaceCodingExerciseHiddenTests({
        activityId: context.activity.id,
        courseId: context.courseId,
        activityConfig: context.activity.config,
        user: context.user,
        input: await readJson()
      });

      return result;
    }
  }
};
