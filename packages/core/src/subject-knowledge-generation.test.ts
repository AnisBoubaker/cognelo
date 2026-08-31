import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mocks = vi.hoisted(() => ({
  generateQuestionAuthoringText: vi.fn(),
  subjectFindUnique: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: { subject: { findUnique: mocks.subjectFindUnique } },
  Prisma: {}
}));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: vi.fn() }));
vi.mock("./plugins", () => ({ assertActivityTypePluginEnabled: vi.fn() }));
vi.mock("./ai-agents", () => ({ generateQuestionAuthoringText: mocks.generateQuestionAuthoringText }));

const { generateSubjectKnowledgeGraph } = await import("./subjects");

const admin: CurrentUser = {
  id: "admin-1",
  email: "admin@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["admin"]
};

describe("AI subject knowledge graph generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subjectFindUnique.mockResolvedValue({ id: "subject-1", title: "Programming", teachingLanguage: "en" });
  });

  it("preserves retained concept and exact skill identities during iteration", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(JSON.stringify({
      concepts: [
        { key: "concept-variables", title: "Variables and values", skills: "Declare a variable\nChoose a type" },
        { key: "functions", title: "Functions", skills: "Call a function" }
      ],
      prerequisites: [{ sourceKey: "functions", requiredKey: "concept-variables" }]
    }));

    const result = await generateSubjectKnowledgeGraph(admin, "subject-1", {
      description: "A detailed programming subject description.",
      mode: "iterate",
      existingGraph: {
        concepts: [{
          id: "concept-variables",
          title: "Variables",
          skills: "Declare a variable\nAssign a value",
          skillRecords: [
            { id: "skill-declare", title: "Declare a variable", position: 0 },
            { id: "skill-assign", title: "Assign a value", position: 1 }
          ],
          positionX: 0,
          positionY: 0
        }],
        prerequisites: []
      }
    });

    expect(result.concepts[0]).toMatchObject({
      id: "concept-variables",
      title: "Variables and values",
      skillRecords: [
        { id: "skill-declare", title: "Declare a variable" },
        { title: "Choose a type" }
      ]
    });
    expect(result.concepts[0]?.skillRecords[1]?.id).toMatch(/^generated-skill-/);
    expect(result.concepts[1]?.id).toMatch(/^generated-concept-/);
    expect(result.prerequisites[0]).toMatchObject({
      sourceConceptId: result.concepts[1]?.id,
      requiredConceptId: "concept-variables"
    });
  });
});
