import { describe, expect, it } from "vitest";
import { StudentGroupingInputSchema, StudentGroupingUpdateSchema } from "./index";

describe("team capacities and selection dates", () => {
  it.each([-1, 1.5, 5001, "3", null])("rejects invalid capacity %s", (capacity) => {
    expect(StudentGroupingInputSchema.safeParse({ title: "Projects", teams: [{ title: "A", capacity }] }).success).toBe(false);
  });
  it.each([0, 1, 5000])("accepts capacity %i", (capacity) => {
    expect(StudentGroupingInputSchema.parse({ title: "Projects", teams: [{ title: "A", capacity }] }).teams[0]!.capacity).toBe(capacity);
  });
  it.each([StudentGroupingInputSchema, StudentGroupingUpdateSchema])("rejects equal and reversed date boundaries on create and update", (schema) => {
    for (const choiceClosesAt of ["2026-10-12T12:00:00.000Z", "2026-10-11T12:00:00.000Z"]) {
      expect(schema.safeParse({ title: "Projects", revision: 1, choiceOpensAt: "2026-10-12T12:00:00.000Z", choiceClosesAt }).success).toBe(false);
    }
  });
  it("preserves legacy choice input and defaults existing visibility to visible", () => {
    expect(StudentGroupingInputSchema.parse({ title: "Projects" })).toMatchObject({ visibleToStudents: true, assignmentMethod: "manual", studentChoiceEnabled: false });
    expect(StudentGroupingInputSchema.parse({ title: "Projects", studentChoiceEnabled: true })).toMatchObject({ assignmentMethod: "student_choice", studentChoiceEnabled: true });
  });
  it.each(["manual", "random", "student_choice"] as const)("uses %s as the authoritative method independently of visibility", (assignmentMethod) => {
    expect(StudentGroupingInputSchema.parse({ title: "Projects", visibleToStudents: false, assignmentMethod, studentChoiceEnabled: true })).toMatchObject({ visibleToStudents: false, assignmentMethod, studentChoiceEnabled: assignmentMethod === "student_choice" });
  });
  it("rejects selecting the unavailable smart mode through the API", () => {
    expect(StudentGroupingInputSchema.safeParse({ title: "Projects", assignmentMethod: "smart" }).success).toBe(false);
  });

});
