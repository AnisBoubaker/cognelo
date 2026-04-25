import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { assertCanManageCourse } from "@cognelo/core";
import {
  listRecentWebDesignExerciseSubmissions,
  runWebDesignExercise,
  submitWebDesignExercise,
  webDesignExerciseRunInputSchema
} from "./executions";
import { listWebDesignExerciseTests, replaceWebDesignExerciseTests } from "./tests";

export const webDesignExerciseTestsRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/tests",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      await assertCanManageCourse(context.user, context.courseId);
      return listWebDesignExerciseTests({
        activityId: context.activity.id
      });
    },
    PUT: async ({ context, readJson }) => {
      return replaceWebDesignExerciseTests({
        activityId: context.activity.id,
        courseId: context.courseId,
        user: context.user,
        input: await readJson()
      });
    }
  }
};

export const webDesignExerciseRunRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/run",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const submissions = await listRecentWebDesignExerciseSubmissions({
        activityId: context.activity.id,
        userId: context.user.id,
        kind: "run"
      });

      return { submissions };
    },
    POST: async ({ context, readJson }) => {
      const input = webDesignExerciseRunInputSchema.parse(await readJson());
      const submission = await runWebDesignExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        input
      });

      return { submission };
    }
  }
};

export const webDesignExerciseSubmitRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/submit",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const submissions = await listRecentWebDesignExerciseSubmissions({
        activityId: context.activity.id,
        userId: context.user.id,
        kind: "submit"
      });

      return { submissions };
    },
    POST: async ({ context, readJson }) => {
      const input = webDesignExerciseRunInputSchema.parse(await readJson());
      const submission = await submitWebDesignExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        input
      });

      return { submission };
    }
  }
};
