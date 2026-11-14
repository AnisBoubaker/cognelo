import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ base: vi.fn(), activity: vi.fn(), rows: vi.fn() }));
vi.mock("@cognelo/core", () => ({ assignmentAssessmentMode: () => "summative", getCourseActivityProgress: mocks.base }));
vi.mock("@cognelo/db", () => ({ prisma: { activity: { findFirst: mocks.activity }, $queryRaw: mocks.rows } }));
import { codingExerciseStudentProgress } from "./student-progress";
describe("coding progress compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.base.mockResolvedValue({ progress: [{ participantId: "p", groupId: "g", state: "in_progress", submittedAt: "2026-11-14T12:00:00Z" }] });
    mocks.activity.mockResolvedValue({ config: { language: "python", prompt: "Write a program.", starterCode: "", sampleTests: [] } });
    mocks.rows.mockResolvedValue([{ participantId: "p", groupId: "g", completed: true, hasNewWork: false }]);
  });
  it("reloads authorized core evidence when an older caller omitted the new progress field", async () => {
    const input = { user: {} as never, courseId: "course", activityId: "activity", participants: [{ participantId: "p", groupId: "g", userId: "u" }], activityMetadata: {}, assignmentMetadata: {} };
    await expect(codingExerciseStudentProgress.getProgress(input)).resolves.toEqual([{ participantId: "p", groupId: "g", state: "done" }]);
    expect(mocks.base).toHaveBeenCalledWith(input.user, "course", "activity");
  });
  it("does not inspect code or load fallback evidence for a current started attempt", async () => {
    expect(await codingExerciseStudentProgress.getProgress({ user: {} as never, courseId: "c", activityId: "a", activityMetadata: {}, assignmentMetadata: {}, participants: [{ participantId: "p", groupId: "g", userId: "u" }], progress: [{ participantId: "p", groupId: "g", state: "in_progress", attemptNumber: 2 }] })).toEqual([]);
    expect(mocks.base).not.toHaveBeenCalled(); expect(mocks.rows).not.toHaveBeenCalled();
  });
});
