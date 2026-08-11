import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateQuestionAuthoringText: vi.fn() }));
vi.mock("./ai-agents", () => ({ generateQuestionAuthoringText: mocks.generateQuestionAuthoringText }));

import { selectedSkillsGenerationPrompt, suggestActivityKnowledgeSelections } from "./activity-knowledge-generation";

const user = { id: "teacher-1" } as Parameters<typeof suggestActivityKnowledgeSelections>[0]["user"];
const catalog = {
  mode: "suggest" as const,
  concepts: [{ id: "loops", title: "Loops", skills: ["Trace a loop", "Write a counted loop"] }]
};

describe("activity knowledge generation", () => {
  beforeEach(() => mocks.generateQuestionAuthoringText.mockReset());

  it("adds only explicitly selected skills to generation prompts", () => {
    expect(selectedSkillsGenerationPrompt({
      mode: "selected",
      concepts: [{ id: "loops", title: "Loops", skills: ["Trace a loop"] }]
    })).toContain("- Trace a loop");
    expect(selectedSkillsGenerationPrompt({ mode: "ignore" })).toBe("");
  });

  it("filters and deduplicates suggestions against the catalog as explicit skill snapshots", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(JSON.stringify({
      selections: [
        { conceptId: "loops", skills: ["Trace a loop", "Invented skill"] },
        { conceptId: "loops", skills: ["Trace a loop", "Write a counted loop"] },
        { conceptId: "unknown", skills: ["Anything"] }
      ]
    }));

    await expect(suggestActivityKnowledgeSelections({ user, knowledge: catalog, generatedActivity: "A loop exercise" })).resolves.toEqual([{
      conceptId: "loops",
      selectsAllSkills: false,
      selectedSkills: ["Trace a loop", "Write a counted loop"]
    }]);
  });

  it("does not call AI when knowledge links are ignored", async () => {
    await expect(suggestActivityKnowledgeSelections({ user, knowledge: { mode: "ignore" }, generatedActivity: "Anything" })).resolves.toBeUndefined();
    expect(mocks.generateQuestionAuthoringText).not.toHaveBeenCalled();
  });
});
