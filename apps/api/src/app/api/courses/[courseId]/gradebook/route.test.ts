import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCourseGradebook: vi.fn(),
  getCourseGradebookCsv: vi.fn(),
  listCourseActivityInProgressAttempts: vi.fn(),
  courseActivityProgress: vi.fn(),
  requireUser: vi.fn(),
  resolveCompletions: vi.fn()
}));
vi.mock("@/lib/activity-progress", () => ({ courseActivityProgress: mocks.courseActivityProgress }));

vi.mock("@cognelo/core", () => ({
  getCourseGradebook: mocks.getCourseGradebook,
  getCourseGradebookCsv: mocks.getCourseGradebookCsv,
  listCourseActivityInProgressAttempts: mocks.listCourseActivityInProgressAttempts,
  AppError: class AppError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
}));
vi.mock("@/lib/gradebook-completion", () => ({
  resolveCourseGradebookCompletions: mocks.resolveCompletions
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course-1" }) };

describe("course gradebook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.getCourseGradebook.mockResolvedValue({ source: "gradebook" });
    mocks.listCourseActivityInProgressAttempts.mockResolvedValue([
      { participantId: "participant-1", groupId: "group-1", attemptNumber: 2, startedAt: "2026-10-09T18:30:00.000Z" }
    ]);
    mocks.resolveCompletions.mockResolvedValue({
      filters: { groupId: null, activityId: null, status: "all" },
      groups: [{ id: "group-1", title: "Section A" }],
      activities: [{ id: "activity-1", title: "Loops" }],
      items: [{
        gradebookItemId: "item-1",
        groupId: "group-1",
        groupTitle: "Section A",
        activityId: "activity-1",
        activityTitle: "Loops",
        activityTypeKey: "coding-exercise",
        activityTypeName: "Programming exercise",
        assessmentMode: "summative",
        gradesReleased: false,
        pointsPossible: 20,
        studentCount: 1,
        incompleteGradeCount: 0,
        canReleaseGrades: true
      }],
      rows: [{
        gradebookItemId: "item-1",
        score: 18,
        maxScore: 20,
        submittedAttemptCount: 1,
        participantId: "private-participant",
        participantEmail: "private@example.invalid",
        attempts: [{ id: "private-attempt" }]
      }]
    });
  });

  it("returns aggregate-only data for the summary view", async () => {
    const response = await GET(new NextRequest("http://test.local/api/courses/course-1/gradebook?view=summary"), params);
    const body = await response.json();

    expect(body.gradebook).toMatchObject({
      overview: { activityCount: 1, submissionCount: 1, gradedCount: 1, meanScore: 18, meanMaxScore: 20 },
      activitySummaries: [{ activityId: "activity-1", submissionCount: 1, gradedCount: 1 }]
    });
    expect(JSON.stringify(body)).not.toContain("private-participant");
    expect(JSON.stringify(body)).not.toContain("private-attempt");
    expect(mocks.getCourseGradebook).toHaveBeenCalledWith(expect.anything(), "course-1", expect.objectContaining({ assessmentMode: "summative" }));
  });

  it("uses the same activity search/concept/summative filters for summary and CSV", async () => {
    mocks.getCourseGradebookCsv.mockResolvedValue("Group,Activity\n");
    const query = "query=%20LOOPS%20&conceptId=concept-1&groupId=group-1";
    await GET(new NextRequest(`http://test.local/api/courses/course-1/gradebook?view=summary&${query}`), params);
    const filters = expect.objectContaining({ groupId: "group-1", assessmentMode: "summative", query: "LOOPS", conceptId: "concept-1" });
    expect(mocks.getCourseGradebook).toHaveBeenCalledWith(expect.anything(), "course-1", filters);
    await GET(new NextRequest(`http://test.local/api/courses/course-1/gradebook?format=csv&assessmentMode=summative&${query}`), params);
    expect(mocks.getCourseGradebookCsv).toHaveBeenCalledWith(expect.anything(), "course-1", filters);
  });

  it("returns a lightweight in-progress attempt feed without loading the full gradebook", async () => {
    const response = await GET(new NextRequest(
      "http://test.local/api/courses/course-1/gradebook?view=in-progress-attempts&activityId=activity-1&groupId=group-1"
    ), params);

    await expect(response.json()).resolves.toEqual({
      attempts: [
        { participantId: "participant-1", groupId: "group-1", attemptNumber: 2, startedAt: "2026-10-09T18:30:00.000Z" }
      ]
    });
    expect(mocks.listCourseActivityInProgressAttempts).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "activity-1",
      "group-1"
    );
    expect(mocks.getCourseGradebook).not.toHaveBeenCalled();
    expect(mocks.resolveCompletions).not.toHaveBeenCalled();
  });

  it("delegates expanded participation to the scoped progress reader without loading grades", async () => {
    const progress = { attempts: [], progress: [{ participantId: "student", groupId: "group-1", state: "stage_submitted", stageId: "files" }] };
    mocks.courseActivityProgress.mockResolvedValue(progress);
    const response = await GET(new NextRequest("http://test.local/api/courses/course-1/gradebook?view=in-progress-attempts&includeProgress=1&activityId=activity-1&groupId=group-1"), params);
    expect(await response.json()).toEqual(progress);
    expect(mocks.courseActivityProgress).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", "activity-1", "group-1");
    expect(mocks.getCourseGradebook).not.toHaveBeenCalled();
    expect(mocks.listCourseActivityInProgressAttempts).not.toHaveBeenCalled();
  });
});
