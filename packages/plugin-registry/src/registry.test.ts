import { describe, expect, it } from "vitest";
import {
  getActivityDefinition,
  getActivityPlugin,
  listActivityDefinitions,
  listActivityPlugins,
  listPluginDatabaseModules,
  validateStudentViewClientContracts
} from "@cognelo/activity-sdk";
import {
  listPluginRoutes,
  listServerActivityPlugins,
  resolveBankActivityVariationHandler,
  resolveCompositeExecutionSubmissionHandler,
  resolveCoursePluginRouteAuthorization,
  resolvePluginGradingHandler,
  resolvePluginHostCapability,
  resolveStudentPreviewExecutionHandler,
  validateStudentPreviewServerContracts
} from "@cognelo/activity-sdk/server";
import {
  listContentTypeDefinitions,
  listContentTypePlugins
} from "@cognelo/content-type-sdk";
import {
  listContentTypePluginRoutes,
  listServerContentTypePlugins
} from "@cognelo/content-type-sdk/server";
import "./server";

describe("installed plugin composition", () => {
  it("registers every installed activity and content type plugin", () => {
    expect(listActivityPlugins().map((plugin) => plugin.key)).toEqual([
      "placeholder",
      "coding-homework-grader",
      "parsons",
      "mcq",
      "coding-exercises",
      "web-design-coding-exercises"
    ]);
    expect(listServerActivityPlugins().map((plugin) => plugin.key)).toEqual(listActivityPlugins().map((plugin) => plugin.key));
    expect(listActivityDefinitions().map((definition) => definition.key)).toEqual(expect.arrayContaining([
      "test",
      "placeholder",
      "coding-homework-grader",
      "parsons-problem",
      "mcq",
      "coding-exercise",
      "web-design-coding-exercise"
    ]));
    expect(listContentTypePlugins().map((plugin) => plugin.key)).toEqual([
      "github-repo-content",
      "file-content",
      "text-content"
    ]);
    expect(listServerContentTypePlugins().map((plugin) => plugin.key)).toEqual(listContentTypePlugins().map((plugin) => plugin.key));
    expect(listContentTypeDefinitions().map((definition) => definition.key)).toEqual(["github-repo", "file", "text"]);
  });

  it("keeps installed Student view contracts complete on both client and server", () => {
    const definitions = listActivityDefinitions();
    expect(() => validateStudentViewClientContracts({
      definitions,
      interactiveActivityTypeKeys: ["test", "coding-exercise", "mcq", "parsons-problem", "web-design-coding-exercise"],
      testItemActivityTypeKeys: ["coding-exercise", "mcq", "parsons-problem", "web-design-coding-exercise"]
    })).not.toThrow();
    expect(() => validateStudentPreviewServerContracts(definitions, listServerActivityPlugins())).not.toThrow();
  });

  it("exposes plugin capabilities through neutral SDK contracts", () => {
    expect(getActivityPlugin("coding-exercises")?.packageName).toBe("@cognelo/plugin-coding-exercises");
    expect(getActivityDefinition("coding-exercise")?.icon).toBe("code");
    expect(resolvePluginGradingHandler("parsons-problem")).toBeTypeOf("function");
    expect(resolvePluginGradingHandler("mcq")).toBeTypeOf("function");
    expect(resolvePluginHostCapability("programming-languages")).toBeTypeOf("function");
    expect(resolveCompositeExecutionSubmissionHandler("coding-exercise")).toBeTypeOf("function");
    expect(resolveStudentPreviewExecutionHandler("mcq", "feedback")).toBeTypeOf("function");
    expect(resolveBankActivityVariationHandler("web-design-coding-exercise")).toBeTypeOf("function");
  });

  it("keeps route authorization and database ownership declarative", () => {
    expect(listPluginRoutes().every((route) => route.activityTypeKeys.length > 0)).toBe(true);
    expect(resolveCoursePluginRouteAuthorization(["coding-exercises", "review-all"], "GET")).toBe("view_gradebook");
    expect(resolveCoursePluginRouteAuthorization(["coding-exercises", "run"], "POST")).toBe("manage_course");
    expect(listContentTypePluginRoutes().every((route) => route.contentTypeKeys.length > 0)).toBe(true);
    expect(listPluginDatabaseModules()).toContainEqual(expect.objectContaining({
      pluginKey: "mcq",
      tables: ["PluginMcqAiEvaluation"]
    }));
  });
});
