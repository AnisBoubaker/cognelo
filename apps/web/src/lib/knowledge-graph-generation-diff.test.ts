import { describe, expect, it } from "vitest";
import type { SubjectKnowledgeConcept } from "@/lib/api";
import { diffKnowledgeGraphGeneration } from "./knowledge-graph-generation-diff";

function concept(id: string, title: string, skills: Array<[string, string]>): SubjectKnowledgeConcept {
  return {
    id,
    subjectId: "subject-1",
    title,
    skills: skills.map(([, skillTitle]) => skillTitle).join("\n"),
    active: true,
    positionX: 0,
    positionY: 0,
    skillRecords: skills.map(([skillId, skillTitle], position) => ({
      id: skillId,
      subjectId: "subject-1",
      conceptId: id,
      title: skillTitle,
      position,
      active: true
    }))
  };
}

describe("AI knowledge graph generation diff", () => {
  it("lists concept and retained-concept skill additions and deletions", () => {
    const before = [
      concept("variables", "Variables", [["declare", "Declare a variable"], ["assign", "Assign a value"]]),
      concept("loops", "Loops", [["trace", "Trace a loop"]])
    ];
    const after = [
      concept("variables", "Variables and values", [["declare", "Declare a variable"], ["types", "Choose a type"]]),
      concept("functions", "Functions", [["call", "Call a function"]])
    ];

    expect(diffKnowledgeGraphGeneration(before, after)).toEqual({
      addedConcepts: [{ id: "functions", title: "Functions" }],
      deletedConcepts: [{ id: "loops", title: "Loops" }],
      addedSkills: [
        { id: "types", title: "Choose a type", conceptId: "variables", conceptTitle: "Variables and values" },
        { id: "call", title: "Call a function", conceptId: "functions", conceptTitle: "Functions" }
      ],
      deletedSkills: [
        { id: "assign", title: "Assign a value", conceptId: "variables", conceptTitle: "Variables" },
        { id: "trace", title: "Trace a loop", conceptId: "loops", conceptTitle: "Loops" }
      ]
    });
  });

  it("includes child skills when a whole concept is added or deleted", () => {
    const result = diffKnowledgeGraphGeneration(
      [concept("old", "Old", [["old-skill", "Old skill"]])],
      [concept("new", "New", [["new-skill", "New skill"]])]
    );

    expect(result.deletedConcepts).toHaveLength(1);
    expect(result.addedConcepts).toHaveLength(1);
    expect(result.deletedSkills).toEqual([{ id: "old-skill", title: "Old skill", conceptId: "old", conceptTitle: "Old" }]);
    expect(result.addedSkills).toEqual([{ id: "new-skill", title: "New skill", conceptId: "new", conceptTitle: "New" }]);
  });
});
