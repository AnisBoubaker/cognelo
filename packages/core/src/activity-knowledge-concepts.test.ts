import { describe, expect, it } from "vitest";
import { conceptSelectionCreates, selectionsFromLegacyIds, selectionsFromStoredLinks } from "./activity-knowledge-concepts";

describe("activity knowledge concept selections", () => {
  it("treats legacy concept links as whole-concept selections", () => {
    expect(selectionsFromLegacyIds(["concept-1"])).toEqual([
      { conceptId: "concept-1", selectsAllSkills: true, selectedSkills: [] }
    ]);
  });

  it("keeps an explicit all-current-skills list distinct from whole-concept selection", () => {
    const selection = { conceptId: "concept-1", selectsAllSkills: false, selectedSkills: ["Skill A", "Skill B"] };
    expect(selectionsFromStoredLinks([selection])).toEqual([selection]);
    expect(conceptSelectionCreates([selection])).toEqual([selection]);
  });
});
