import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGrades: vi.fn(),
  getReport: vi.fn(),
  resolveReport: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({ getStudentReleasedGrades: mocks.getGrades }));
vi.mock("@cognelo/activity-sdk/server", () => ({
  resolvePluginStudentGradeReportHandler: mocks.resolveReport
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course-1", groupId: "group-1" }) };

describe("student group grades route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "student-1" });
    mocks.resolveReport.mockImplementation((activityTypeKey: string) => activityTypeKey === "coding-exercise" ? mocks.getReport : null);
    mocks.getReport.mockResolvedValue({ kind: "coding-exercise", attempts: [{ attemptId: "attempt-1" }] });
  });

  it("adds plugin-owned grading evidence only to final released rows", async () => {
    mocks.getGrades.mockResolvedValue({
      rows: [
        {
          gradebookItemId: "item-1",
          activityId: "activity-1",
          activityTypeKey: "coding-exercise",
          gradeKind: "final",
          selectedAttemptId: "attempt-1"
        },
        {
          gradebookItemId: "item-2",
          activityId: "activity-2",
          activityTypeKey: "coding-exercise",
          gradeKind: "latest",
          selectedAttemptId: "attempt-2"
        }
      ]
    });

    const response = await GET(new Request("http://test.local") as never, params);
    await expect(response.json()).resolves.toMatchObject({
      grades: {
        rows: [
          { gradebookItemId: "item-1", gradingReport: { kind: "coding-exercise" } },
          { gradebookItemId: "item-2", gradingReport: null }
        ]
      }
    });
    expect(mocks.getReport).toHaveBeenCalledWith({
      user: { id: "student-1" },
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      gradebookItemId: "item-1",
      selectedAttemptId: "attempt-1"
    });
    expect(mocks.getReport).toHaveBeenCalledTimes(1);
  });
});
