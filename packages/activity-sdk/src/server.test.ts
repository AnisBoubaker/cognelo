import { describe, expect, it, vi } from "vitest";
import {
  getAssignedGroupActivityAttemptSource,
  listPluginRoutes,
  resolveCompositeExecutionSubmissionHandler,
  resolvePluginGradingHandler,
  resolvePluginRoute,
  runBankActivityDeletedHooks,
  runBankActivityDeletedHooksForPlugins,
  runActivityAttemptDeletedHooksForPlugins,
  runCourseActivityDeletedHooksForPlugins,
  runCourseActivityCreatedFromBankVersionHooksForPlugins,
  type ServerActivityRecord,
  type ServerActivityPlugin
} from "./server";

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

describe("server activity SDK", () => {
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
    expect(resolvePluginRoute("coding-exercise", ["coding-exercises", "run"])?.path).toBe("coding-exercises/run");
    expect(resolvePluginRoute("mcq", ["coding-exercises", "run"])).toBeNull();
  });

  it("lists registered plugin routes for API dispatch introspection", () => {
    const routes = listPluginRoutes();
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginKey: "coding-exercises",
          path: "coding-exercises/run"
        })
      ])
    );
  });

  it("resolves plugin grading handlers by activity type", () => {
    expect(resolvePluginGradingHandler("parsons-problem")).toBeTypeOf("function");
    expect(resolvePluginGradingHandler("mcq")).toBeTypeOf("function");
    expect(resolvePluginGradingHandler("placeholder")).toBeNull();
  });

  it("resolves composite execution handlers by activity type without coupling the Test runtime to a plugin", () => {
    expect(resolveCompositeExecutionSubmissionHandler("mcq")).toBeTypeOf("function");
    expect(resolveCompositeExecutionSubmissionHandler("placeholder")).toBeNull();
  });

  it("runs bank deletion hooks without requiring every plugin to implement one", async () => {
    await expect(
      runBankActivityDeletedHooks({
        user,
        activityBankId: "bank-1",
        bankActivityId: "bank-activity-1",
        activityTypeKey: "placeholder"
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
