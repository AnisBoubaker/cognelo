import { describe, expect, it } from "vitest";
import { ActivityAssignmentExceptionSchema, CourseActivityGroupAssignmentSettingsSchema } from "./index";

describe("assignment exception inputs", () => {
  it.each([{}, { teamId: "team", participantId: "student" }])("requires exactly one target", (value) => {
    expect(ActivityAssignmentExceptionSchema.safeParse(value).success).toBe(false);
  });
  it.each([{ teamId: "team" }, { participantId: "student" }])("accepts an empty exception as inheritance without changing any fields", (value) => {
    expect(ActivityAssignmentExceptionSchema.parse(value).overrideFields).toEqual([]);
  });
  it("rejects duplicate targets, duplicate fields, and invalid limits", () => {
    expect(CourseActivityGroupAssignmentSettingsSchema.safeParse({ groupId: "section", assigned: true, exceptions: [{ teamId: "team" }, { teamId: "team" }] }).success).toBe(false);
    expect(ActivityAssignmentExceptionSchema.safeParse({ participantId: "student", overrideFields: ["timeLimit", "timeLimit"] }).success).toBe(false);
    expect(ActivityAssignmentExceptionSchema.safeParse({ participantId: "student", timeLimitMinutes: 1441 }).success).toBe(false);
  });
});
