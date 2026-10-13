import { describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
const availability = vi.hoisted(() => vi.fn());
vi.mock("./gradebook", () => ({ getActivityAttemptAvailability: availability }));
const { canShowStudentActivityGrade } = await import("./student-grade-visibility");
const context = { user: { id: "student" } as CurrentUser, courseId: "course", groupId: "section", activity: { id: "activity", assignment: { metadata: { assessmentMode: "summative" } } } };

describe("student grade visibility", () => {
  it("only exposes summative grading when the teacher has released it", async () => {
    for (const gradesReleased of [false, undefined, true, false]) {
      availability.mockResolvedValue({ gradesReleased });
      expect(await canShowStudentActivityGrade(context)).toBe(gradesReleased === true);
    }
  });
  it("fails closed if a summative learner payload has no section context", async () => {
    expect(await canShowStudentActivityGrade({ ...context, groupId: undefined })).toBe(false);
  });
  it("preserves formative feedback", async () => {
    expect(await canShowStudentActivityGrade({ ...context, activity: { ...context.activity, assignment: { metadata: { assessmentMode: "formative" } } } })).toBe(true);
  });
});
