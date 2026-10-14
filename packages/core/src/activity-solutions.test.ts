import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mocks = vi.hoisted(() => ({
  assigned: vi.fn(), definition: vi.fn(), handler: vi.fn(), solution: vi.fn(),
  participant: vi.fn(), grade: vi.fn(), items: vi.fn()
}));
vi.mock("./groups", () => ({ getGroupAssignedActivity: mocks.assigned }));
vi.mock("./plugins", () => ({ isActivityTypeAvailable: async () => true }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: mocks.definition }));
vi.mock("@cognelo/activity-sdk/server", () => ({ resolvePluginStudentSolutionHandler: mocks.handler }));
vi.mock("@cognelo/db", () => ({ prisma: {
  courseGroupParticipant: { findFirst: mocks.participant },
  gradebookItem: { findFirst: mocks.grade }, testItem: { findMany: mocks.items }
} }));

import { getActivitySolution, getActivitySolutionAvailability } from "./activity-solutions";

const user = { id: "student" } as CurrentUser;
const content = { blocks: [{ kind: "code", code: "reference only", language: "python" }] };
function activity(releaseSolution = false, assessmentMode = "formative", key = "coding-exercise") {
  return { id: "activity", title: "Exercise", config: {}, metadata: { allGroupsAssignment: { releaseSolution } },
    activityType: { key }, assignment: { id: "assignment", metadata: { assessmentMode } } };
}
const availability = () => getActivitySolutionAvailability(user, "course", "section", "activity");
const reveal = () => getActivitySolution(user, "course", "section", "activity");

describe("explicit student solution release", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.assigned.mockResolvedValue(activity());
    mocks.definition.mockReturnValue({ supportsSolution: true });
    mocks.participant.mockResolvedValue({ id: "participant" });
    mocks.grade.mockResolvedValue({ gradesReleased: false });
    mocks.handler.mockReturnValue(mocks.solution);
    mocks.solution.mockResolvedValue(content);
  });

  it.each([false, true])("defaults to hidden regardless of grade release (%s)", async (gradesReleased) => {
    mocks.grade.mockResolvedValue({ gradesReleased });
    expect(await availability()).toEqual({ available: false });
    await expect(reveal()).rejects.toMatchObject({ status: 403, code: "ACTIVITY_SOLUTION_NOT_RELEASED" });
    expect(mocks.solution).not.toHaveBeenCalled();
  });

  it.each(["formative", "formative_ai"])("allows opt-in %s without a submission, fetching content only on reveal", async (mode) => {
    mocks.assigned.mockResolvedValue(activity(true, mode));
    expect(await availability()).toEqual({ available: true });
    expect(mocks.solution).not.toHaveBeenCalled();
    expect(await reveal()).toEqual({ activities: [{ id: "activity", title: "Exercise", content }] });
    expect(mocks.grade).not.toHaveBeenCalled();
  });

  it("requires both switches for summative work and rechecks them on every reveal", async () => {
    mocks.assigned.mockResolvedValue(activity(true, "summative"));
    expect(await availability()).toEqual({ available: false });
    await expect(reveal()).rejects.toMatchObject({ code: "ACTIVITY_SOLUTION_NOT_RELEASED" });
    mocks.grade.mockResolvedValue({ gradesReleased: true });
    expect(await availability()).toEqual({ available: true });
    expect((await reveal()).activities).toHaveLength(1);
    mocks.assigned.mockResolvedValue(activity(false, "summative"));
    await expect(reveal()).rejects.toMatchObject({ code: "ACTIVITY_SOLUTION_NOT_RELEASED" });
    mocks.assigned.mockResolvedValue(activity(true, "summative"));
    mocks.grade.mockResolvedValue(null);
    await expect(reveal()).rejects.toMatchObject({ code: "ACTIVITY_SOLUTION_NOT_RELEASED" });
  });

  it("requires actual learner enrollment and preserves assignment visibility/access checks", async () => {
    mocks.participant.mockResolvedValue(null);
    await expect(reveal()).rejects.toMatchObject({ status: 403 });
    mocks.assigned.mockRejectedValue(new Error("hidden activity"));
    await expect(availability()).rejects.toThrow("hidden activity");
    expect(mocks.solution).not.toHaveBeenCalled();
  });

  it("does not enable an unsupported activity through forged metadata", async () => {
    mocks.assigned.mockResolvedValue(activity(true, "formative", "coding-homework-grader"));
    mocks.definition.mockReturnValue({});
    expect(await availability()).toEqual({ available: false });
    await expect(reveal()).rejects.toMatchObject({ code: "ACTIVITY_SOLUTION_NOT_RELEASED" });
  });

  it("uses the parent Test release gate for every supported child", async () => {
    mocks.assigned.mockResolvedValue(activity(true, "formative", "test"));
    await expect(reveal()).rejects.toMatchObject({ code: "ACTIVITY_SOLUTION_NOT_RELEASED" });
    expect(mocks.items).not.toHaveBeenCalled();
    mocks.grade.mockResolvedValue({ gradesReleased: true });
    mocks.items.mockResolvedValue([
      { activity: { ...activity(), id: "child", title: "Child" } },
      { activity: { ...activity(), id: "unsupported", activityType: { key: "unsupported" } } }
    ]);
    mocks.definition.mockImplementation((key) => ({ supportsSolution: key !== "unsupported" }));
    expect(await reveal()).toEqual({ activities: [{ id: "child", title: "Child", content }] });
    expect(mocks.items).toHaveBeenCalledWith(expect.objectContaining({ where: { test: { courseId: "course", activityId: "activity" }, removedAt: null } }));
    expect(mocks.solution).toHaveBeenCalledTimes(1);
  });
});
