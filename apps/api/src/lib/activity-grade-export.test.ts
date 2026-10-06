import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCourseGradebook: vi.fn(),
  resolveCompletions: vi.fn()
}));

vi.mock("@cognelo/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@cognelo/core")>()),
  getCourseGradebook: mocks.getCourseGradebook
}));
vi.mock("./gradebook-completion", () => ({
  resolveCourseGradebookCompletions: mocks.resolveCompletions
}));

const { getActivityFinalGradeExportRows } = await import("./activity-grade-export");

const user = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: "Ada Teacher",
  firstName: "Ada",
  lastName: "Teacher",
  roles: ["teacher" as const]
};

describe("activity grade export rows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCourseGradebook.mockResolvedValue({ source: "core" });
  });

  it("exports only complete final grades and sorts learners by name", async () => {
    mocks.resolveCompletions.mockResolvedValue({
      items: [{ activityId: "activity-1" }],
      rows: [
        row({ participantEmail: "zoe@example.test", participantFirstName: "Zoé", participantLastName: "Zéphyr", score: 8.5, gradeCompletion: complete() }),
        row({ participantEmail: "partial@example.test", participantFirstName: "Pat", participantLastName: "Partial", score: 4, gradeCompletion: { status: "partial" } }),
        row({ participantEmail: "ungraded@example.test", participantFirstName: "Uma", participantLastName: "Ungraded", score: null, gradeCompletion: { status: "ungraded" } }),
        row({ participantEmail: "ada@example.test", participantFirstName: "Ada", participantLastName: "Alpha", score: 10, gradeCompletion: complete() })
      ]
    });

    await expect(getActivityFinalGradeExportRows(user, "course-1", "activity-1", "group-1")).resolves.toEqual([
      { email: "ada@example.test", firstName: "Ada", lastName: "Alpha", grade: 10 },
      { email: "zoe@example.test", firstName: "Zoé", lastName: "Zéphyr", grade: 8.5 }
    ]);
    expect(mocks.getCourseGradebook).toHaveBeenCalledWith(user, "course-1", {
      activityId: "activity-1",
      groupId: "group-1",
      status: "all"
    });
  });

  it("returns an empty export when the activity has no assigned gradebook rows in the requested scope", async () => {
    mocks.resolveCompletions.mockResolvedValue({ items: [], rows: [] });

    await expect(getActivityFinalGradeExportRows(user, "course-1", "unassigned")).resolves.toEqual([]);
  });
});

function complete() {
  return { status: "complete", completedComponentCount: 2, requiredComponentCount: 2 };
}

function row(overrides: Record<string, unknown>) {
  return {
    participantEmail: "student@example.test",
    participantFirstName: "Student",
    participantLastName: "Learner",
    score: 5,
    gradeCompletion: complete(),
    ...overrides
  };
}
