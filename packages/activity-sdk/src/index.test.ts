import { describe, expect, it } from "vitest";
import {
  activityDefinitionBelongsToCategory,
  activityDefinitionCreatesCategory,
  getActivityDefinition,
  getActivityHomeCategoryIds,
  getActivityMessages,
  getActivityPlugin,
  getActivityPluginForActivityType,
  getActivityProviderForActivityType,
  isCoreActivityType,
  listActivityCategories,
  listCoreActivityDefinitions,
  listActivityDefinitions,
  listActivityPlugins,
  listPluginDatabaseModules
} from "./index";

describe("activity SDK registry", () => {
  it("registers the expected activity plugins and activity definitions", () => {
    const pluginKeys = listActivityPlugins().map((plugin) => plugin.key);
    expect(pluginKeys).toEqual(
      expect.arrayContaining(["coding-exercises", "mcq", "parsons", "placeholder", "web-design-coding-exercises"])
    );

    const definitionKeys = listActivityDefinitions().map((definition) => definition.key);
    expect(definitionKeys).toEqual(expect.arrayContaining(["coding-exercise", "mcq", "parsons-problem", "placeholder", "test"]));
  });

  it("resolves plugins by plugin key and activity type key", () => {
    expect(getActivityPlugin("coding-exercises")?.packageName).toBe("@cognelo/plugin-coding-exercises");
    expect(getActivityPluginForActivityType("coding-exercise")?.key).toBe("coding-exercises");
    expect(getActivityDefinition("coding-exercise")?.icon).toBe("code");
  });

  it("distinguishes core activity definitions from plugin-backed definitions", () => {
    expect(listCoreActivityDefinitions().map((definition) => definition.key)).toEqual(["test"]);
    expect(getActivityProviderForActivityType("test")).toEqual({ kind: "core", key: "test" });
    expect(getActivityProviderForActivityType("mcq")).toEqual({ kind: "plugin", key: "mcq" });
    expect(isCoreActivityType("test")).toBe(true);
    expect(getActivityDefinition("test")).toMatchObject({
      creationScopes: ["course"],
      isEnabledByDefault: true
    });
  });

  it("returns localized activity messages with stable fallbacks", () => {
    const definition = getActivityDefinition("coding-exercise");
    const messages = getActivityMessages(definition, "fr");
    expect(messages?.name).toBeTruthy();
    expect(messages?.description).toBeTruthy();

    const fallback = getActivityMessages({ key: "x", name: "Fallback", description: "Default" }, "zh");
    expect(fallback).toEqual({ name: "Fallback", description: "Default", defaultTitle: "Fallback" });
  });

  it("marks all-category activities and explicit category assignments", () => {
    expect(getActivityDefinition("mcq")?.defaultCategoryIds).toEqual(["generic", "all"]);
    expect(getActivityDefinition("coding-exercise")?.defaultCategoryIds).toContain("programming");
    expect(getActivityDefinition("placeholder")?.defaultCategoryIds).toContain("miscellaneous");
  });

  it("centralizes category definitions and falls unknown categories back to generic", () => {
    expect(listActivityCategories().map((category) => category.id)).toEqual(["generic", "programming", "miscellaneous"]);
    expect(listActivityCategories().map((category) => category.labelKey)).toEqual([
      "activityCategories.generic",
      "activityCategories.programming",
      "activityCategories.miscellaneous"
    ]);
    expect(getActivityHomeCategoryIds({ defaultCategoryIds: ["unknown-category"] })).toEqual(["generic"]);
    expect(activityDefinitionCreatesCategory(getActivityDefinition("mcq"), "generic")).toBe(true);
    expect(activityDefinitionCreatesCategory(getActivityDefinition("mcq"), "programming")).toBe(false);
    expect(activityDefinitionBelongsToCategory(getActivityDefinition("mcq"), "programming")).toBe(true);
  });

  it("exposes grading capability metadata on gradable activity definitions", () => {
    expect(getActivityDefinition("parsons-problem")?.grading).toEqual(
      expect.objectContaining({
        supportsAttempts: true,
        supportsAutoGrading: true,
        supportsManualGrading: true,
        supportsAnalyticsPayloads: true,
        supportsCompositeExecution: true
      })
    );
    expect(getActivityDefinition("parsons-problem")?.manualGrading).toEqual(
      expect.objectContaining({
        rendererKey: "parsons-manual-grading"
      })
    );
    expect(getActivityDefinition("mcq")?.grading).toEqual(
      expect.objectContaining({
        supportsAttempts: true,
        supportsAutoGrading: true,
        supportsManualGrading: true
      })
    );
    expect(getActivityDefinition("mcq")?.manualGrading).toEqual(
      expect.objectContaining({
        rendererKey: "mcq-manual-grading"
      })
    );
    expect(getActivityDefinition("coding-exercise")?.grading?.supportsCompositeExecution).toBe(true);
    expect(getActivityDefinition("web-design-coding-exercise")?.grading?.supportsCompositeExecution).toBe(true);
    expect(getActivityDefinition("coding-homework-grader")?.grading?.supportsCompositeExecution).not.toBe(true);
  });

  it("exposes plugin database manifests for lifecycle management", () => {
    const modules = listPluginDatabaseModules();
    expect(modules.map((module) => module.pluginKey)).toContain("placeholder");
    expect(
      modules.every(
        (module) =>
          module.namespace &&
          Array.isArray(module.tables) &&
          (module.tables.length === 0 || Array.isArray(module.migrations) || Array.isArray(module.notes))
      )
    ).toBe(true);
  });
});
