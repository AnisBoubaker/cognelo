import { describe, expect, it } from "vitest";
import { activityCreationConfig } from "./activity-creation-defaults";

describe("activity creation defaults", () => {
  const codingDefinition = { defaultConfig: { language: "python", prompt: "Write a program." } };

  it("uses the subject programming language for a new programming exercise", () => {
    expect(activityCreationConfig("coding-exercise", codingDefinition, "cpp")).toEqual({
      language: "cpp",
      prompt: "Write a program."
    });
  });

  it("keeps the plugin default when the subject has no programming language", () => {
    expect(activityCreationConfig("coding-exercise", codingDefinition, null)).toEqual(codingDefinition.defaultConfig);
  });

  it("does not change another activity type", () => {
    expect(activityCreationConfig("parsons-problem", codingDefinition, "rust")).toEqual(codingDefinition.defaultConfig);
  });

  it("does not mutate the registered plugin defaults", () => {
    activityCreationConfig("coding-exercise", codingDefinition, "go");
    expect(codingDefinition.defaultConfig.language).toBe("python");
  });
});
