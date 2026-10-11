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
  listActivityDefinitions,
  listActivityPlugins,
  listCoreActivityDefinitions,
  listPluginDatabaseModules,
  registerActivityPlugin,
  validateStudentViewClientContracts,
  type ActivityPlugin
} from "./index";

const fakePlugin: ActivityPlugin = {
  key: "fake-activity-plugin",
  packageName: "@example/fake-activity-plugin",
  name: "Fake activity plugin",
  db: {
    namespace: "fake_activity",
    tables: ["FakeActivity"],
    notes: ["Test-only manifest"]
  },
  activities: [{
    key: "fake-interactive-activity",
    name: "Fake interactive activity",
    description: "A test-only interactive activity.",
    defaultCategoryIds: ["generic", "all"],
    icon: "checklist",
    studentView: { mode: "interactive", execution: "plugin" },
    grading: {
      supportsAttempts: true,
      supportsAutoGrading: true,
      supportsManualGrading: true,
      supportsRegrading: true,
      supportsAnalyticsPayloads: true,
      supportsCompositeExecution: true
    },
    manualGrading: { rendererKey: "fake-manual-grading" },
    i18n: {
      fr: {
        name: "Activité fictive",
        description: "Une activité interactive réservée aux tests."
      }
    }
  }]
};

registerActivityPlugin(fakePlugin);

describe("activity SDK registry", () => {
  it("registers injected plugins alongside core activity definitions", () => {
    expect(listActivityPlugins().map((plugin) => plugin.key)).toContain("fake-activity-plugin");
    expect(listActivityDefinitions().map((definition) => definition.key)).toEqual(
      expect.arrayContaining(["fake-interactive-activity", "test"])
    );
  });

  it("resolves plugins by plugin key and activity type key", () => {
    expect(getActivityPlugin("fake-activity-plugin")?.packageName).toBe("@example/fake-activity-plugin");
    expect(getActivityPluginForActivityType("fake-interactive-activity")?.key).toBe("fake-activity-plugin");
    expect(getActivityDefinition("fake-interactive-activity")?.icon).toBe("checklist");
    expect(getActivityDefinition("test")?.icon).toBe("clipboard-check");
  });

  it("distinguishes core activity definitions from plugin-backed definitions", () => {
    expect(listCoreActivityDefinitions().map((definition) => definition.key)).toEqual(["test"]);
    expect(getActivityProviderForActivityType("test")).toEqual({ kind: "core", key: "test" });
    expect(getActivityProviderForActivityType("fake-interactive-activity")).toEqual({ kind: "plugin", key: "fake-activity-plugin" });
    expect(isCoreActivityType("test")).toBe(true);
    expect(getActivityDefinition("test")).toMatchObject({ creationScopes: ["course", "bank"], isEnabledByDefault: true });
  });

  it("returns localized activity messages with stable fallbacks", () => {
    expect(getActivityMessages(getActivityDefinition("fake-interactive-activity"), "fr")).toEqual({
      name: "Activité fictive",
      description: "Une activité interactive réservée aux tests.",
      defaultTitle: "Fake interactive activity"
    });
    expect(getActivityMessages({
      key: "fallback",
      name: "Fallback",
      description: "Default",
      studentView: { mode: "unsupported" }
    }, "zh")).toEqual({ name: "Fallback", description: "Default", defaultTitle: "Fallback" });
  });

  it("requires explicit, fail-closed Student view renderer registrations", () => {
    const definitions = listActivityDefinitions();
    expect(() => validateStudentViewClientContracts({
      definitions,
      interactiveActivityTypeKeys: ["test"],
      testItemActivityTypeKeys: []
    })).toThrow("Interactive activity type is missing a Student view renderer: fake-interactive-activity");

    expect(() => validateStudentViewClientContracts({
      definitions,
      interactiveActivityTypeKeys: ["test", "fake-interactive-activity"],
      testItemActivityTypeKeys: []
    })).toThrow("Test-capable activity type is missing a Student view Test-item renderer: fake-interactive-activity");

    expect(() => validateStudentViewClientContracts({
      definitions,
      interactiveActivityTypeKeys: ["test", "fake-interactive-activity"],
      testItemActivityTypeKeys: ["fake-interactive-activity"]
    })).not.toThrow();
  });

  it("supports all-category activities and explicit category assignments", () => {
    const definition = getActivityDefinition("fake-interactive-activity");
    expect(definition?.defaultCategoryIds).toEqual(["generic", "all"]);
    expect(activityDefinitionCreatesCategory(definition, "generic")).toBe(true);
    expect(activityDefinitionCreatesCategory(definition, "programming")).toBe(false);
    expect(activityDefinitionBelongsToCategory(definition, "programming")).toBe(true);
  });

  it("centralizes category definitions and falls unknown categories back to generic", () => {
    expect(listActivityCategories().map((category) => category.id)).toEqual(["generic", "programming", "miscellaneous"]);
    expect(getActivityHomeCategoryIds({ defaultCategoryIds: ["unknown-category"] })).toEqual(["generic"]);
  });

  it("exposes generic grading metadata without knowing concrete plugins", () => {
    expect(getActivityDefinition("fake-interactive-activity")?.grading).toMatchObject({
      supportsAttempts: true,
      supportsManualGrading: true,
      supportsCompositeExecution: true
    });
    expect(getActivityDefinition("fake-interactive-activity")?.manualGrading).toEqual({ rendererKey: "fake-manual-grading" });
    expect(getActivityDefinition("test")?.grading).toMatchObject({ supportsManualGrading: true, supportsRegrading: true });
  });

  it("exposes injected plugin database manifests for lifecycle management", () => {
    expect(listPluginDatabaseModules()).toContainEqual(expect.objectContaining({
      pluginKey: "fake-activity-plugin",
      namespace: "fake_activity",
      tables: ["FakeActivity"]
    }));
  });
});
