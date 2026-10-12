import { describe, expect, it } from "vitest";
import { nextStudentTeamName, randomlyAssignStudents } from "./student-groupings";

describe("default student team names", () => {
  it.each([
    ["en", "Team 1"], ["fr", "Équipe 1"], ["zh", "团队 1"], ["ar", "الفريق 1"]
  ] as const)("uses the %s teaching language", (language, name) => {
    expect(nextStudentTeamName([], language)).toBe(name);
  });

  it("continues numbering after a custom name without changing existing names", () => {
    const names = ["Project partners"];
    expect(nextStudentTeamName(names, "en")).toBe("Team 2");
    expect(names).toEqual(["Project partners"]);
  });

  it("avoids collisions after removal or renaming, including case and whitespace", () => {
    expect(nextStudentTeamName(["Team 2"], "en")).toBe("Team 3");
    expect(nextStudentTeamName(["Team 1", " TEAM 3 ", "team 4"], "en")).toBe("Team 5");
    expect(nextStudentTeamName([" équipe 2 "], "fr")).toBe("Équipe 3");
  });
});

describe("random student assignment", () => {
  const teams = () => [
    { id: "blue", key: "blue-key", title: "Blue", capacity: 100, participantIds: ["old-member"] },
    { id: "green", key: "green-key", title: "Green", capacity: 100, participantIds: [] }
  ];

  it.each([0, 1, 2, 3, 17, 100])("assigns each of %i students once with balanced team sizes", (count) => {
    const students = Array.from({ length: count }, (_, index) => `student-${index}`);
    const result = randomlyAssignStudents(teams(), students, "all", () => 0.4);
    const assigned = result.flatMap((team) => team.participantIds);
    expect(assigned.sort()).toEqual([...students].sort());
    expect(new Set(assigned).size).toBe(count);
    const sizes = result.map((team) => team.participantIds.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("replaces memberships while preserving team identity and leaving the saved input untouched", () => {
    const original = teams();
    const students = ["a", "b", "c"];
    const result = randomlyAssignStudents(original, students, "all", () => 0);
    expect(result.map(({ participantIds: _members, ...team }) => team)).toEqual(original.map(({ participantIds: _members, ...team }) => team));
    expect(original).toEqual(teams());
    expect(students).toEqual(["a", "b", "c"]);
    expect(result.flatMap((team) => team.participantIds)).not.toContain("old-member");
  });

  it("uses the random source for both memberships and the extra-student team", () => {
    const students = ["a", "b", "c", "d", "e"];
    const first = randomlyAssignStudents(teams(), students, "all", () => 0);
    const second = randomlyAssignStudents(teams(), students, "all", () => 0.999);
    expect(first[0]!.participantIds).toHaveLength(3);
    expect(second[1]!.participantIds).toHaveLength(3);
    expect(first).not.toEqual(second);
  });

  it("supports one team, more teams than students, and no teams", () => {
    expect(randomlyAssignStudents(teams().slice(0, 1), ["a", "b"], "all", () => 0)[0]!.participantIds).toEqual(["a", "b"]);
    expect(randomlyAssignStudents(teams(), ["a"], "all", () => 0.999).map((team) => team.participantIds)).toEqual([[], ["a"]]);
    expect(randomlyAssignStudents([], ["a"], "all")).toEqual([]);
  });
  it("preserves existing memberships when only assigning unassigned students", () => {
    const result = randomlyAssignStudents(teams(), ["old-member", "a", "b"], "unassigned", () => 0);
    expect(result[0]!.participantIds).toContain("old-member");
    expect(result.flatMap((team) => team.participantIds).sort()).toEqual(["a", "b", "old-member"]);
    expect(teams()[0]!.participantIds).toEqual(["old-member"]);
  });

  it.each(["unassigned", "all"] as const)("respects unequal and zero capacities in %s mode, leaving excess students unassigned", (scope) => {
    const input = [
      { capacity: 1, participantIds: ["existing"] },
      { capacity: 2, participantIds: [] },
      { capacity: 0, participantIds: [] }
    ];
    const result = randomlyAssignStudents(input, ["existing", "a", "b", "c", "d"], scope, () => 0.3);
    expect(result.map((team) => team.participantIds.length)).toEqual([1, 2, 0]);
    expect(new Set(result.flatMap((team) => team.participantIds)).size).toBe(3);
    if (scope === "unassigned") expect(result[0]!.participantIds).toEqual(["existing"]);
    expect(input[0]!.participantIds).toEqual(["existing"]);
  });

});
