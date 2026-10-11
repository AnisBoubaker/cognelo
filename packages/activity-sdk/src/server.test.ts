import { describe, expect, it, vi } from "vitest";
import {
  getAssignedGroupActivityAttemptSource,
  listServerActivityPlugins,
  listPluginRoutes,
  resolveCompositeExecutionActionHandler,
  resolveCompositeExecutionSubmissionHandler,
  resolveBankActivityVariationHandler,
  resolvePluginGradingHandler,
  resolvePluginGradeCompletionHandler,
  resolvePluginStudentGradeReportHandler,
  resolvePluginAiFeedbackHandler,
  resolvePluginAiGradingBatchHandler,
  resolvePluginRoute,
  resolveCoursePluginRouteAuthorization,
  resolvePluginHostCapability,
  resolveStudentPreviewExecutionHandler,
  registerServerActivityPlugin,
  validateStudentPreviewServerContracts,
  runBankActivityDeletedHooks,
  runBankActivityDeletedHooksForPlugins,
  runActivityAttemptDeletedHooksForPlugins,
  runCourseActivityDeletedHooksForPlugins,
  runCourseActivityCreatedFromBankVersionHooksForPlugins,
  type ServerActivityRecord,
  type ServerActivityPlugin
} from "./server";
import { listActivityDefinitions, registerActivityPlugin } from "./index";

const user = {
  id: "user-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher" as const]
};

const activity: ServerActivityRecord = {
  id: "activity-1",
  bankActivityId: "bank-activity-1",
  activityVersionId: "version-1",
  title: "Activity",
  description: "",
  lifecycle: "published",
  activityType: {
    key: "placeholder",
    name: "Placeholder",
    description: ""
  }
};

const activityTypeKey = "sdk-test-interactive";
const routeHandler = vi.fn(async () => ({}));
const gradingHandler = vi.fn(async () => ({ rawScore: 1, rawMaxScore: 1 }));
const previewHandler = vi.fn(async () => ({}));

registerActivityPlugin({
  key: "sdk-test-plugin",
  packageName: "@example/sdk-test-plugin",
  name: "SDK test plugin",
  db: { namespace: "sdk_test", tables: [] },
  activities: [{
    key: activityTypeKey,
    name: "SDK test activity",
    description: "Test-only activity.",
    studentView: { mode: "interactive", execution: "plugin" }
  }]
});

const testServerPlugin: ServerActivityPlugin = {
  key: "sdk-test-plugin",
  hostCapabilities: {
    "sdk-test-capability": async () => ["supported"]
  },
  routes: [{
    path: "sdk-test/run",
    activityTypeKeys: [activityTypeKey],
    courseAuthorization: { GET: "view_gradebook" },
    methods: { GET: routeHandler, POST: routeHandler }
  }],
  grading: { gradeAttempt: gradingHandler },
  studentGradeReport: { activityTypeKeys: [activityTypeKey], getReport: async () => ({}) },
  gradeCompletion: { activityTypeKeys: [activityTypeKey], getCompletions: async () => ({}) },
  aiFeedback: {
    evaluateAttempt: async () => ({
      feedbackRef: "feedback-1",
      feedbackVersion: 1,
      feedbackHash: "hash",
      feedback: {}
    }),
    batchGrading: {
      getInstructions: () => "",
      updateInstructions: () => undefined,
      isTemplateComplete: () => true
    }
  },
  compositeExecution: {
    activityTypeKeys: [activityTypeKey],
    submit: async () => ({ state: {}, gradingResult: { rawScore: 1, rawMaxScore: 1 } }),
    actions: { run: async () => ({}) }
  },
  studentPreview: {
    activityTypeKeys: [activityTypeKey],
    actions: { run: previewHandler }
  },
  bankVariation: {
    activityTypeKeys: [activityTypeKey],
    createVariation: async () => undefined
  },
  hooks: {
    onBankActivityDeleted: async () => undefined
  }
};

registerServerActivityPlugin(testServerPlugin);

describe("server activity SDK", () => {
  it("keeps every registered activity's Student view server contract consistent", () => {
    expect(() => validateStudentPreviewServerContracts(
      listActivityDefinitions(),
      listServerActivityPlugins()
    )).not.toThrow();
  });

  it("extracts assigned group activity attempt source from plugin route context", () => {
    expect(
      getAssignedGroupActivityAttemptSource({
        user,
        courseId: "course-1",
        groupId: "group-1",
        activityId: "activity-1",
        path: ["parsons", "attempt"],
        activity
      })
    ).toEqual({
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1"
    });

    expect(() =>
      getAssignedGroupActivityAttemptSource({
        user,
        courseId: "course-1",
        activityId: "activity-1",
        path: ["parsons", "attempt"],
        activity
      })
    ).toThrow("Assigned group activity attempts require course and group route context.");
  });

  it("resolves plugin routes by normalized path and activity type", () => {
    expect(resolvePluginRoute(activityTypeKey, ["sdk-test", "run"])?.path).toBe("sdk-test/run");
    expect(resolvePluginRoute("unknown", ["sdk-test", "run"])).toBeNull();
  });

  it("rejects undispatchable routes and unsafe gradebook authorization declarations", () => {
    expect(() => registerServerActivityPlugin({
      key: "missing-types",
      routes: [{ path: "missing/types", methods: { GET: vi.fn() } }]
    })).toThrow("must declare activity type keys");
    expect(() => registerServerActivityPlugin({
      key: "unsafe-gradebook-write",
      routes: [{
        path: "unsafe/write",
        activityTypeKeys: ["placeholder"],
        courseAuthorization: { POST: "view_gradebook" },
        methods: { POST: vi.fn() }
      }]
    })).toThrow("limited to GET routes");
  });

  it("lets plugins declare gradebook-read authorization without host route knowledge", () => {
    expect(resolveCoursePluginRouteAuthorization(["sdk-test", "run"], "GET")).toBe("view_gradebook");
    expect(resolveCoursePluginRouteAuthorization(["sdk-test", "run"], "POST")).toBe("manage_course");
    expect(resolveCoursePluginRouteAuthorization(["missing"], "GET")).toBeUndefined();
  });

  it("lists registered plugin routes for API dispatch introspection", () => {
    const routes = listPluginRoutes();
    expect(routes.every((route) => route.activityTypeKeys.length > 0)).toBe(true);
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginKey: "sdk-test-plugin",
          path: "sdk-test/run"
        })
      ])
    );
  });

  it("resolves plugin grading handlers by activity type", () => {
    expect(resolvePluginGradingHandler(activityTypeKey)).toBeTypeOf("function");
    expect(resolvePluginGradingHandler("placeholder")).toBeNull();
  });

  it("resolves host capabilities without importing their plugin into the host", () => {
    expect(resolvePluginHostCapability("sdk-test-capability")).toBeTypeOf("function");
    expect(resolvePluginHostCapability("missing-capability")).toBeNull();
  });

  it("resolves release-gated student grade reports by activity type", () => {
    expect(resolvePluginStudentGradeReportHandler(activityTypeKey)).toBeTypeOf("function");
    expect(resolvePluginStudentGradeReportHandler("placeholder")).toBeNull();
  });

  it("resolves plugin-owned grade completion handlers by activity type", () => {
    expect(resolvePluginGradeCompletionHandler(activityTypeKey)).toBeTypeOf("function");
    expect(resolvePluginGradeCompletionHandler("placeholder")).toBeNull();
  });

  it("resolves plugin-owned AI feedback handlers only for supported activity types", () => {
    expect(resolvePluginAiFeedbackHandler(activityTypeKey)).toBeTypeOf("function");
    expect(resolvePluginAiFeedbackHandler("placeholder")).toBeNull();
  });

  it("resolves guided batch grading only for AI-grading plugins that implement it", () => {
    expect(resolvePluginAiGradingBatchHandler(activityTypeKey)).toMatchObject({
      getInstructions: expect.any(Function),
      updateInstructions: expect.any(Function),
      isTemplateComplete: expect.any(Function)
    });
    expect(resolvePluginAiGradingBatchHandler("mcq")).toBeNull();
    expect(resolvePluginAiGradingBatchHandler("placeholder")).toBeNull();
  });

  it("resolves composite execution handlers by activity type without coupling the Test runtime to a plugin", () => {
    expect(resolveCompositeExecutionSubmissionHandler(activityTypeKey)).toBeTypeOf("function");
    expect(resolveCompositeExecutionActionHandler(activityTypeKey, "run")).toBeTypeOf("function");
    expect(resolveCompositeExecutionActionHandler(activityTypeKey, "submit")).toBeNull();
    expect(resolveCompositeExecutionSubmissionHandler("placeholder")).toBeNull();
  });

  it("resolves only explicitly stateless Student view handlers", () => {
    expect(resolveStudentPreviewExecutionHandler(activityTypeKey, "run")).toBeTypeOf("function");
    expect(resolveStudentPreviewExecutionHandler(activityTypeKey, "submit")).toBeNull();
    expect(resolveStudentPreviewExecutionHandler("placeholder", "submit")).toBeNull();
  });

  it("rejects missing, mismatched, and duplicate Student view server registrations", () => {
    const definition = { key: "interactive", studentView: { mode: "interactive", execution: "plugin" } } as const;
    const handler = vi.fn(async () => ({}));

    expect(() => validateStudentPreviewServerContracts([definition], [])).toThrow(
      "Interactive plugin activity type is missing Student view server actions: interactive"
    );
    expect(() => validateStudentPreviewServerContracts(
      [{ key: "read-only", studentView: { mode: "read_only" } }],
      [{ key: "plugin", studentPreview: { activityTypeKeys: ["read-only"], actions: { submit: handler } } }]
    )).toThrow("Activity type cannot register plugin Student view actions: read-only");
    expect(() => validateStudentPreviewServerContracts(
      [definition],
      [
        { key: "first", studentPreview: { activityTypeKeys: ["interactive"], actions: { submit: handler } } },
        { key: "second", studentPreview: { activityTypeKeys: ["interactive"], actions: { submit: handler } } }
      ]
    )).toThrow("Activity type has duplicate Student view server registrations: interactive");
  });

  it("resolves bank variation handlers for every Test-capable activity plugin", () => {
    expect(resolveBankActivityVariationHandler(activityTypeKey)).toBeTypeOf("function");
    expect(resolveBankActivityVariationHandler("placeholder")).toBeNull();
  });

  it("runs bank deletion hooks without requiring every plugin to implement one", async () => {
    await expect(
      runBankActivityDeletedHooks({
        user,
        activityBankId: "bank-1",
        bankActivityId: "bank-activity-1",
        activityTypeKey
      })
    ).resolves.toBeUndefined();
  });

  it("runs course copy hooks in plugin order with injectable plugin lists", async () => {
    const calls: string[] = [];
    const plugins: ServerActivityPlugin[] = [
      {
        key: "first",
        hooks: {
          onCourseActivityCreatedFromBankVersion: vi.fn(async () => {
            calls.push("first");
          })
        }
      },
      { key: "no-hooks" },
      {
        key: "second",
        hooks: {
          onCourseActivityCreatedFromBankVersion: vi.fn(async () => {
            calls.push("second");
          })
        }
      }
    ];

    await runCourseActivityCreatedFromBankVersionHooksForPlugins(plugins, {
      user,
      courseId: "course-1",
      activity,
      bankActivityId: "bank-activity-1",
      activityVersionId: "version-1"
    });

    expect(calls).toEqual(["first", "second"]);
    expect(plugins[0].hooks?.onCourseActivityCreatedFromBankVersion).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: "course-1", activity })
    );
  });

  it("runs course activity deletion hooks in plugin order", async () => {
    const calls: string[] = [];
    const plugins: ServerActivityPlugin[] = [
      { key: "first", hooks: { onCourseActivityDeleted: vi.fn(async () => { calls.push("first"); }) } },
      { key: "no-hooks" },
      { key: "second", hooks: { onCourseActivityDeleted: vi.fn(async () => { calls.push("second"); }) } }
    ];

    await runCourseActivityDeletedHooksForPlugins(plugins, {
      user,
      courseId: "course-1",
      activityId: "activity-1",
      activityTypeKey: "placeholder"
    });

    expect(calls).toEqual(["first", "second"]);
  });

  it("stops hook execution and propagates failures", async () => {
    const afterFailure = vi.fn();
    const plugins: ServerActivityPlugin[] = [
      {
        key: "first",
        hooks: {
          onBankActivityDeleted: vi.fn(async () => {
            throw new Error("copy cleanup failed");
          })
        }
      },
      {
        key: "second",
        hooks: {
          onBankActivityDeleted: afterFailure
        }
      }
    ];

    await expect(
      runBankActivityDeletedHooksForPlugins(plugins, {
        user,
        activityBankId: "bank-1",
        bankActivityId: "bank-activity-1",
        activityTypeKey: "placeholder"
      })
    ).rejects.toThrow("copy cleanup failed");
    expect(afterFailure).not.toHaveBeenCalled();
  });

  it("runs attempt deletion hooks only for the owning plugin", async () => {
    const matchingHook = vi.fn();
    const otherHook = vi.fn();
    const plugins: ServerActivityPlugin[] = [
      {
        key: "coding-homework-grader",
        hooks: {
          onActivityAttemptDeleted: matchingHook
        }
      },
      {
        key: "parsons",
        hooks: {
          onActivityAttemptDeleted: otherHook
        }
      },
      { key: "mcq" }
    ];

    await runActivityAttemptDeletedHooksForPlugins(plugins, {
      user,
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      pluginKey: "coding-homework-grader",
      coreAttemptId: "attempt-1",
      pluginAttemptRef: "submission-1",
      reason: "Wrong file",
      deletedAt: "2026-06-19T10:00:00.000Z"
    });

    expect(matchingHook).toHaveBeenCalledWith(expect.objectContaining({ pluginAttemptRef: "submission-1" }));
    expect(otherHook).not.toHaveBeenCalled();
  });
});
