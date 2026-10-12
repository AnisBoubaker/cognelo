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
    { id: "blue", key: "blue-key", title: "Blue", participantIds: ["old-member"] },
    { id: "green", key: "green-key", title: "Green", participantIds: [] }
  ];

  it.each([0, 1, 2, 3, 17, 100])("assigns each of %i students once with balanced team sizes", (count) => {
    const students = Array.from({ length: count }, (_, index) => `student-${index}`);
    const result = randomlyAssignStudents(teams(), students, () => 0.4);
    const assigned = result.flatMap((team) => team.participantIds);
    expect(assigned.sort()).toEqual([...students].sort());
    expect(new Set(assigned).size).toBe(count);
    const sizes = result.map((team) => team.participantIds.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("replaces memberships while preserving team identity and leaving the saved input untouched", () => {
    const original = teams();
    const students = ["a", "b", "c"];
    const result = randomlyAssignStudents(original, students, () => 0);
    expect(result.map(({ participantIds: _members, ...team }) => team)).toEqual(original.map(({ participantIds: _members, ...team }) => team));
    expect(original).toEqual(teams());
    expect(students).toEqual(["a", "b", "c"]);
    expect(result.flatMap((team) => team.participantIds)).not.toContain("old-member");
  });

  it("uses the random source for both memberships and the extra-student team", () => {
    const students = ["a", "b", "c", "d", "e"];
    const first = randomlyAssignStudents(teams(), students, () => 0);
    const second = randomlyAssignStudents(teams(), students, () => 0.999);
    expect(first[0]!.participantIds).toHaveLength(3);
    expect(second[1]!.participantIds).toHaveLength(3);
    expect(first).not.toEqual(second);
  });

  it("supports one team, more teams than students, and no teams", () => {
    expect(randomlyAssignStudents(teams().slice(0, 1), ["a", "b"], () => 0)[0]!.participantIds).toEqual(["a", "b"]);
    expect(randomlyAssignStudents(teams(), ["a"], () => 0.999).map((team) => team.participantIds)).toEqual([[], ["a"]]);
    expect(randomlyAssignStudents([], ["a"])).toEqual([]);
  });
});
