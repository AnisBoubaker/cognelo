import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
const mocks = vi.hoisted(() => ({ activity: { findFirst: vi.fn() }, activityAttempt: { findMany: vi.fn() }, scope: vi.fn(), content: vi.fn(), handler: vi.fn(), grades: vi.fn() }));
vi.mock("@cognelo/db", () => ({ prisma: { activity: mocks.activity, activityAttempt: mocks.activityAttempt, grade: { findMany: mocks.grades } } }));
vi.mock("./authorization", () => ({ assertCanViewCourseGradebook: mocks.scope }));
vi.mock("./course-time", () => ({ getCourseTimeSettings: async () => ({ timeZone: "UTC" }) }));
vi.mock("@cognelo/activity-sdk/server", async (original) => ({ ...await original<object>(), getSubmissionExportHandler: mocks.handler }));
import { buildAnswerExport, listAnswerExportStudents } from "./answer-export";
import { answerExportLabels } from "../../../apps/api/src/lib/answer-export-labels";
const user = { id: "teacher" } as CurrentUser;
const activity = { id: "activity", title: "Exam", description: "Prompt", config: {}, metadata: {}, lifecycle: "published", activityType: { key: "mcq", name: "MCQ", description: "" }, course: { title: "Course", subject: { title: "Subject" } } };
const summary = (id: string, n: number) => ({ id, attemptNumber: n, participantId: "student", groupId: "allowed", assessmentMode: "summative", submittedAt: new Date("2026-10-23T12:00:00Z"), participant: { firstName: "Sam", lastName: "Student", email: "sam@example.org" }, group: { title: "Section A" } });
const record = (id: string, n: number) => ({ ...summary(id, n), userId: "student-user", metadata: {}, pluginAttemptRef: `ref-${id}`, selectedForGrades: [], gradeEvents: [], testItemAttempts: [], testRevision: null });
const input = { participantIds: ["student"], includePrompt: true, includeGrading: false };
beforeEach(() => {
  vi.resetAllMocks(); mocks.grades.mockResolvedValue([]); mocks.scope.mockResolvedValue({ gradingGroupIds: ["allowed"] }); mocks.activity.findFirst.mockResolvedValue(activity);
  mocks.content.mockResolvedValue({ prompt: [], answer: [{ kind: "code", text: "saved answer" }], grading: [{ kind: "markdown", text: "PRIVATE GRADE" }] }); mocks.handler.mockReturnValue(mocks.content);
  mocks.activityAttempt.findMany.mockImplementation(async (query) => query.select ? [summary("latest", 2), summary("first", 1)] : [record("first", 1), record("latest", 2)].filter((r) => query.where.id.in.includes(r.id)));
});
describe("authorized answer exports", () => {
  it("selects only the latest submitted attempt by default and suppresses all grading fields", async () => {
    const result = await buildAnswerExport(user, "course", "activity", input, answerExportLabels("en"));
    expect(result.documents[0].attempts.map((a) => a.id)).toEqual(["latest"]);
    expect(result.documents[0].attempts[0]).not.toHaveProperty("score");
    expect(JSON.stringify(result)).not.toContain("PRIVATE GRADE");
    expect(mocks.activityAttempt.findMany.mock.calls[0][0].where).toMatchObject({ courseId: "course", activityId: "activity", groupId: { in: ["allowed"] }, lifecycle: { in: ["submitted", "graded"] } });
  });
  it("exports all attempts chronologically or an exact older submission", async () => {
    const all = await buildAnswerExport(user, "course", "activity", { ...input, attempts: "all" }, answerExportLabels("en"));
    expect(all.documents[0].attempts.map((a) => a.id)).toEqual(["first", "latest"]);
    const one = await buildAnswerExport(user, "course", "activity", { ...input, attemptId: "first", includePrompt: false, includeGrading: true }, answerExportLabels("en"));
    expect(one.documents[0].attempts[0].sections[0]).toMatchObject({ prompt: [], grading: [{ kind: "markdown", text: "PRIVATE GRADE" }] });
    expect(one.documents[0].attempts.map((a) => a.id)).toEqual(["first"]);
  });
  it("rejects out-of-scope sections before reading attempts", async () => {
    await expect(listAnswerExportStudents(user, "course", "activity", "other-section")).rejects.toMatchObject({ status: 403 });
    expect(mocks.activityAttempt.findMany).not.toHaveBeenCalled();
  });
  it("rejects non-submitters, foreign attempts and a submission removed while preparing", async () => {
    await expect(buildAnswerExport(user, "course", "activity", { ...input, participantIds: ["unknown"] }, answerExportLabels("en"))).rejects.toMatchObject({ code: "ANSWER_EXPORT_SUBMISSION_REQUIRED" });
    await expect(buildAnswerExport(user, "course", "activity", { ...input, attemptId: "foreign" }, answerExportLabels("en"))).rejects.toMatchObject({ code: "ANSWER_EXPORT_ATTEMPT_INVALID" });
    mocks.activityAttempt.findMany.mockImplementation(async (query) => query.select ? [summary("latest", 2)] : []);
    await expect(buildAnswerExport(user, "course", "activity", input, answerExportLabels("en"))).rejects.toMatchObject({ code: "ANSWER_EXPORT_CHANGED" });
    expect(mocks.content).not.toHaveBeenCalled();
  });
  it("exports the Test submission manifest with saved child responses and revision prompts", async () => {
    mocks.activity.findFirst.mockResolvedValue({ ...activity, activityType: { ...activity.activityType, key: "test" } });
    mocks.activityAttempt.findMany.mockImplementation(async (query) => query.select ? [summary("test", 1)] : [{ ...record("test", 1), metadata: { submissionManifest: { items: [{ testItemId: "child-2" }, { testItemId: "child-1" }] } },
      testRevision: { items: [{ sourceTestItemId: "child-1", title: "Original title", description: "Original prompt", config: { source: "original" } }] },
      testItemAttempts: ["child-1", "child-2"].map((id) => ({ id, testItemId: id, activity: { ...activity, id, title: "Changed title", description: "Changed prompt" }, pluginAttemptRef: null, feedback: {}, normalizedScore: null, normalizedMaxScore: 10, result: { state: { sourceCode: id } } })) }]);
    const result = await buildAnswerExport(user, "course", "activity", input, answerExportLabels("en"));
    expect(mocks.content.mock.calls.map(([context]) => context.state.sourceCode)).toEqual(["child-2", "child-1"]);
    expect(mocks.content.mock.calls[1][0].activity).toMatchObject({ title: "Original title", description: "Original prompt", config: { source: "original" } });
    expect(result.documents[0].attempts[0].sections[2].title).toBe("2. Original title");
  });
});

it("keeps an overall manual override separate from a historical attempt grade", async () => {
  mocks.grades.mockResolvedValue([{ participantId: "student", normalizedScore: 88, normalizedMaxScore: 100, source: "override", normalizedResult: { studentFeedback: { feedbackText: "Teacher comment" } } }]);
  const result = await buildAnswerExport(user, "course", "activity", { ...input, attemptId: "first", includeGrading: true }, answerExportLabels("en"));
  expect(result.documents[0]).toMatchObject({ gradebookGrade: "88 / 100", gradebookComment: "Teacher comment", attempts: [{ id: "first", score: null }] });
});
