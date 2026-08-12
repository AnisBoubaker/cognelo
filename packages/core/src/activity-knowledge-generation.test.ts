import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateQuestionAuthoringText: vi.fn() }));
vi.mock("./ai-agents", () => ({ generateQuestionAuthoringText: mocks.generateQuestionAuthoringText }));

import { activityKnowledgeGenerationPrompt, suggestActivityKnowledgeSelections } from "./activity-knowledge-generation";

const user = { id: "teacher-1" } as Parameters<typeof suggestActivityKnowledgeSelections>[0]["user"];
const catalog = {
  mode: "suggest" as const,
  concepts: [{ id: "loops", title: "Loops", skills: ["Trace a loop", "Write a counted loop"] }]
};

describe("activity knowledge generation", () => {
  beforeEach(() => mocks.generateQuestionAuthoringText.mockReset());

  it("adds the full catalog boundary and distinguishes explicitly selected skills", () => {
    const prompt = activityKnowledgeGenerationPrompt({
      mode: "selected",
      concepts: [
        { id: "loops", title: "Loops", skills: ["Trace a loop", "Write a counted loop"] },
        { id: "arrays", title: "Arrays", skills: ["Index an array"] }
      ],
      selectedConcepts: [{ id: "loops", title: "Loops", skills: ["Trace a loop"] }]
    });
    expect(prompt).toContain("defines the intended subject boundary");
    expect(prompt).toContain("- Index an array");
    expect(prompt).toContain("must specifically assess or practice these selected learning skills");
    expect(prompt.match(/- Trace a loop/g)).toHaveLength(2);
    expect(prompt.match(/- Write a counted loop/g)).toHaveLength(1);
  });

  it("provides the catalog boundary in suggest and ignore modes without selected targets", () => {
    for (const mode of ["suggest", "ignore"] as const) {
      const prompt = activityKnowledgeGenerationPrompt({
        mode,
        concepts: [{ id: "loops", title: "Loops", skills: ["Trace a loop"] }]
      });
      expect(prompt).toContain("defines the intended subject boundary");
      expect(prompt).toContain("- Trace a loop");
      expect(prompt).not.toContain("specifically assess or practice");
    }
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
    await expect(suggestActivityKnowledgeSelections({ user, knowledge: { mode: "ignore", concepts: catalog.concepts }, generatedActivity: "Anything" })).resolves.toBeUndefined();
    expect(mocks.generateQuestionAuthoringText).not.toHaveBeenCalled();
  });
});
