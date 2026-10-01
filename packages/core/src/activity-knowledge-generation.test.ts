import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanManageActivityBank: vi.fn(),
  findActivityBank: vi.fn(),
  generateQuestionAuthoringText: vi.fn()
}));
vi.mock("@cognelo/db", () => ({ prisma: { activityBank: { findUnique: mocks.findActivityBank } } }));
vi.mock("./ai-agents", () => ({ generateQuestionAuthoringText: mocks.generateQuestionAuthoringText }));
vi.mock("./subjects", () => ({ assertCanManageActivityBank: mocks.assertCanManageActivityBank }));

import {
  activityKnowledgeGenerationPrompt,
  getBankActivityVariationGenerationContext,
  suggestActivityKnowledgeSelections
} from "./activity-knowledge-generation";

const user = { id: "teacher-1" } as Parameters<typeof suggestActivityKnowledgeSelections>[0]["user"];
const catalog = {
  mode: "suggest" as const,
  concepts: [{
    id: "loops",
    title: "Loops",
    skills: ["Trace a loop", "Write a counted loop"],
    skillIds: ["trace-loop", "write-loop"],
    misconceptions: ["A loop condition is checked after every body execution"],
    misconceptionIds: ["condition-order"]
  }]
};

describe("activity knowledge generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanManageActivityBank.mockResolvedValue(undefined);
  });

  it("preserves exact activity selections even when a selected concept is no longer active in the catalog", async () => {
    mocks.findActivityBank.mockResolvedValue({
      subject: {
        title: "Programming",
        description: "Introductory programming",
        teachingLanguage: "fr",
        knowledgeConcepts: [{
          id: "active-concept",
          title: "Active concept",
          skills: "",
          skillRecords: [{ id: "active-skill", title: "Active skill" }]
        }]
      },
      activities: [{
        knowledgeConcepts: [{
          conceptId: "inactive-concept",
          selectsAllSkills: false,
          selectedSkills: ["Legacy selected skill"],
          selectedSkillIds: [],
          concept: {
            id: "inactive-concept",
            title: "Inactive selected concept",
            skills: "Legacy selected skill\nOther skill",
            skillRecords: []
          }
        }]
      }]
    });

    await expect(getBankActivityVariationGenerationContext(user, "bank-1", "activity-1")).resolves.toEqual({
      locale: "fr",
      subject: { title: "Programming", description: "Introductory programming" },
      knowledge: {
        mode: "selected",
        concepts: [{ id: "active-concept", title: "Active concept", skills: ["Active skill"], skillIds: ["active-skill"], misconceptions: [], misconceptionIds: [] }],
        selectedConcepts: [{
          id: "inactive-concept",
          title: "Inactive selected concept",
          skills: ["Legacy selected skill"],
          skillIds: ["inactive-concept:legacy-skill-1"],
          misconceptions: [],
          misconceptionIds: []
        }]
      }
    });
  });

  it("adds the full catalog boundary and distinguishes explicitly selected skills", () => {
    const prompt = activityKnowledgeGenerationPrompt({
      mode: "selected",
      concepts: [
        { id: "loops", title: "Loops", skills: ["Trace a loop", "Write a counted loop"], skillIds: ["trace-loop", "write-loop"] },
        { id: "arrays", title: "Arrays", skills: ["Index an array"], skillIds: ["index-array"] }
      ],
      selectedConcepts: [{ id: "loops", title: "Loops", skills: ["Trace a loop"], skillIds: ["trace-loop"] }]
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
        concepts: [{ id: "loops", title: "Loops", skills: ["Trace a loop"], skillIds: ["trace-loop"] }]
      });
      expect(prompt).toContain("defines the intended subject boundary");
      expect(prompt).toContain("- Trace a loop");
      expect(prompt).not.toContain("specifically assess or practice");
    }
  });

  it("filters and deduplicates suggestions against the catalog as explicit skill snapshots", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(JSON.stringify({
      selections: [
        { conceptId: "loops", skills: ["Trace a loop", "Invented skill"], misconceptions: ["A loop condition is checked after every body execution", "Invented misconception"] },
        { conceptId: "loops", skills: ["Trace a loop", "Write a counted loop"] },
        { conceptId: "unknown", skills: ["Anything"] }
      ]
    }));

    await expect(suggestActivityKnowledgeSelections({ user, knowledge: catalog, generatedActivity: "A loop exercise" })).resolves.toEqual([{
      conceptId: "loops",
      selectsAllSkills: false,
      selectedSkills: ["Trace a loop", "Write a counted loop"],
      selectedSkillIds: ["trace-loop", "write-loop"],
      selectedMisconceptions: ["A loop condition is checked after every body execution"],
      selectedMisconceptionIds: ["condition-order"]
    }]);
  });

  it("does not call AI when knowledge links are ignored", async () => {
    await expect(suggestActivityKnowledgeSelections({ user, knowledge: { mode: "ignore", concepts: catalog.concepts }, generatedActivity: "Anything" })).resolves.toBeUndefined();
    expect(mocks.generateQuestionAuthoringText).not.toHaveBeenCalled();
  });
});
