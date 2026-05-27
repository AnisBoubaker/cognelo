import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { AppError, assertCanManageCourse } from "@cognelo/core";
import {
  listRecentWebDesignExerciseSubmissions,
  runWebDesignExercise,
  submitWebDesignExercise,
  webDesignExerciseRunInputSchema
} from "./executions";
import {
  getBankWebDesignExpectedResult,
  getWebDesignExpectedResult,
  listBankWebDesignExerciseTests,
  listWebDesignExerciseTests,
  replaceBankWebDesignExerciseTests,
  replaceWebDesignExerciseTests
} from "./tests";

export const webDesignExerciseTestsRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/tests",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      if (context.activityBankId) {
        return listBankWebDesignExerciseTests({
          bankActivityId: context.activity.id
        });
      }
      if (!context.courseId) {
        throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "This plugin route requires a course or activity bank context.");
      }
      await assertCanManageCourse(context.user, context.courseId);
      return listWebDesignExerciseTests({
        activityId: context.activity.id
      });
    },
    PUT: async ({ context, readJson }) => {
      if (context.activityBankId) {
        return replaceBankWebDesignExerciseTests({
          activityBankId: context.activityBankId,
          bankActivityId: context.activity.id,
          activityConfig: context.activity.config,
          user: context.user,
          input: await readJson()
        });
      }
      if (!context.courseId) {
        throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "This plugin route requires a course or activity bank context.");
      }
      return replaceWebDesignExerciseTests({
        activityId: context.activity.id,
        activityConfig: context.activity.config,
        courseId: context.courseId,
        user: context.user,
        input: await readJson()
      });
    }
  }
};

export const webDesignExerciseExpectedResultRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/expected-result",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      if (context.activityBankId) {
        return getBankWebDesignExpectedResult({
          bankActivityId: context.activity.id,
          activityConfig: context.activity.config
        });
      }
      return getWebDesignExpectedResult({
        activityId: context.activity.id,
        activityConfig: context.activity.config
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
