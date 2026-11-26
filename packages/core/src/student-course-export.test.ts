import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
const mocks = vi.hoisted(() => ({
  course: vi.fn(), groups: vi.fn(), tree: vi.fn(), assigned: vi.fn(), access: vi.fn(), stage: vi.fn(), policy: vi.fn(),
  attempts: vi.fn(), attempt: vi.fn(), grades: vi.fn(), grade: vi.fn(), reviews: vi.fn(), resources: vi.fn(), materials: vi.fn(),
  resourceActive: vi.fn(), pluginActive: vi.fn(), bytes: vi.fn(), image: vi.fn(), content: vi.fn(), handler: vi.fn(), materialContent: vi.fn(), exportPolicy: vi.fn()
}));
vi.mock("@cognelo/db", () => ({ prisma: { course: { findFirst: mocks.course }, courseGroup: { findMany: mocks.groups },
  gradebookItem: { findFirst: mocks.policy }, activityAttempt: { findMany: mocks.attempts, findFirst: mocks.attempt },
  grade: { findMany: mocks.grades, findFirst: mocks.grade }, courseContentResource: { findMany: mocks.resources }, courseMaterial: { findMany: mocks.materials },
  mediaAssetReference: { findFirst: mocks.image }, $queryRaw: mocks.bytes } }));
vi.mock("./course-content", () => ({ listContentItems: mocks.tree }));
vi.mock("./groups", () => ({ getGroupAssignedActivityForStudentExport: mocks.assigned, assignmentRequiresSafeExamBrowser: (value: { requireSafeExamBrowser?: boolean }) => value.requireSafeExamBrowser === true }));
vi.mock("./activity-content-access", () => ({ getActivityContentAccess: mocks.access }));
vi.mock("./activity-submission-stages", () => ({ activitySubmissionStageSafeExamBrowser: mocks.stage }));
vi.mock("./grading-review", () => ({ getActivityGradingReviews: mocks.reviews }));
vi.mock("./plugins", () => ({ assertContentResourcePluginActive: mocks.resourceActive, isActivityTypePluginEnabled: mocks.pluginActive }));
vi.mock("./course-time", () => ({ getCourseTimeSettings: async () => ({ timeZone: "America/Toronto" }) }));
vi.mock("./student-course-export-policy", () => ({ getStudentCourseExportPolicy: mocks.exportPolicy }));
vi.mock("./media-assets", () => ({ extractMediaAssetIds: () => new Set<string>() }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: (key: string) => ({ supportsSafeExamBrowser: true, assessmentFlow: key === "coding-homework-grader" ? "deferred" : undefined, preparationMediaFields: [] }) }));
vi.mock("@cognelo/activity-sdk/server", async original => ({ ...await original<object>(), getStudentActivityExportHandler: mocks.handler }));
vi.mock("@cognelo/content-type-sdk/server", () => ({ getServerContentTypePlugin: () => ({ studentExport: mocks.materialContent }) }));
import { AppError } from "./errors";
import { assertStudentCourseExportAccess, buildStudentCourseExport, studentCourseExportOrder } from "./student-course-export";
import { studentCourseExportLabels } from "../../../apps/api/src/lib/student-course-export-labels";

const user: CurrentUser = { id: "learner", email: "student@example.test", firstName: "Sam", lastName: "Student", name: "Sam Student", roles: ["student"] };
const stamp = new Date("2026-01-01T12:00:00Z");
const course = { id: "course", title: "Programming", subject: { title: "Computing" }, studentCourseExportEnabled: true, updatedAt: stamp };
const group = { id: "section", title: "Section A", status: "published", availableFrom: null, availableUntil: null, updatedAt: stamp, participants: [{ id: "participant" }] };
const item = (id = "placement", update = {}) => ({ id, parentId: null, position: 1, titleSnapshot: "Exercise", kind: "activity", createdAt: stamp, updatedAt: stamp, activityId: "activity", courseGroupActivityId: "assignment", materialId: null, contentResourceId: null, ...update });
const activity = { id: "activity", title: "Exercise", description: "Public prompt", lifecycle: "published", config: {}, metadata: {}, updatedAt: stamp,
  activityType: { key: "mcq", name: "MCQ", description: "", providerKind: "plugin" }, assignment: { id: "assignment", availableFrom: null, availableUntil: null, metadata: { assessmentMode: "summative" }, config: {} } };
const reference = (id = "attempt", n = 1) => ({ id, groupId: "section", groupActivityId: "assignment", participantId: "participant", assessmentMode: "summative", lifecycle: "submitted", updatedAt: stamp, attemptNumber: n, submittedAt: stamp });
const attempt = (id = "attempt", n = 1) => ({ ...reference(id, n), userId: "learner", metadata: {}, pluginAttemptRef: "plugin-" + id, testRevisionId: null, testRevision: null,
  testItemAttempts: [], gradeEvents: [], selectedForGrades: [] });
const build = (actor = user, security = {}) => buildStudentCourseExport(actor, "course", { locale: "en" }, studentCourseExportLabels("en"), security);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.course.mockResolvedValue(course); mocks.groups.mockResolvedValue([group]); mocks.tree.mockResolvedValue([item()]);
  mocks.exportPolicy.mockResolvedValue({ usageRights: "Site rights", allowTeacherEditing: true });
  mocks.assigned.mockResolvedValue(activity); mocks.access.mockResolvedValue({ locked: false }); mocks.stage.mockResolvedValue(null);
  mocks.policy.mockResolvedValue({ id: "gradebook", gradesReleased: false, updatedAt: stamp });
  mocks.attempts.mockResolvedValue([reference()]); mocks.attempt.mockImplementation(async ({ where }) => attempt(where.id));
  mocks.grades.mockResolvedValue([{ id: "grade", gradebookItemId: "gradebook", participantId: "participant", normalizedScore: 80, normalizedMaxScore: 100, updatedAt: stamp }]);
  mocks.grade.mockResolvedValue({ normalizedResult: {} }); mocks.reviews.mockResolvedValue([]); mocks.resources.mockResolvedValue([]); mocks.materials.mockResolvedValue([]);
  mocks.bytes.mockResolvedValue([{ count: 1n, bytes: 0n }]); mocks.pluginActive.mockResolvedValue(true); mocks.resourceActive.mockResolvedValue(undefined);
  mocks.handler.mockReturnValue(mocks.content);
  mocks.content.mockImplementation(async input => ({ prompt: [], answer: input.attempt ? [{ kind: "code", text: "My own submitted work" }] : [],
    grading: input.attempt?.includeGrading ? [{ kind: "markdown", text: "Released feedback" }] : [] }));
  mocks.materialContent.mockResolvedValue({ blocks: [{ kind: "markdown", text: "Visible lesson" }] });
});

describe("student course export authorization and projections", () => {
  it("uses course terms only when permitted, and uses the course teaching language for rights", async () => {
    mocks.course.mockResolvedValue({ ...course, subject: { ...course.subject, teachingLanguage: "fr" }, studentCourseExportUsageRights: "Course terms", studentCourseExportConfidential: true });
    expect((await build()).rights).toEqual({ locale: "fr", usageRights: "Course terms", confidential: true });
    mocks.exportPolicy.mockResolvedValue({ usageRights: "Locked site terms", allowTeacherEditing: false });
    expect((await build()).rights.usageRights).toBe("Locked site terms");
    mocks.course.mockResolvedValue(course);
    expect((await build()).rights).toEqual({ locale: "en", usageRights: "Locked site terms", confidential: false });
  });
  it("discards an export when site usage rights change before delivery", async () => {
    const result = await build(); mocks.exportPolicy.mockResolvedValue({ usageRights: "Changed terms", allowTeacherEditing: false });
    await expect(result.revalidate()).rejects.toMatchObject({ code: "COURSE_EXPORT_CHANGED" });
  });
  it.each([undefined, false])("keeps courses disabled unless explicitly enabled (%s)", async enabled => {
    mocks.course.mockResolvedValue({ ...course, studentCourseExportEnabled: enabled });
    await expect(build()).rejects.toMatchObject({ status: 403, code: "COURSE_EXPORT_DISABLED" });
    expect(mocks.content).not.toHaveBeenCalled();
  });
  it.each(["student", "teacher", "admin"] as const)("requires a real student enrollment for %s", async role => {
    mocks.course.mockResolvedValue(null);
    await expect(build({ ...user, roles: [role] })).rejects.toMatchObject({ status: 403 });
    expect(mocks.course).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ groups: { some: { participants: { some: { userId: "learner", role: "student" } } } } }) }));
    expect(mocks.tree).not.toHaveBeenCalled();
  });
  it("never accepts client-supplied learner or enrollment identities", async () => {
    await expect(buildStudentCourseExport(user, "course", { participantId: "someone-else", locale: "en" }, studentCourseExportLabels("en"))).rejects.toBeDefined();
    expect(mocks.course).not.toHaveBeenCalled();
  });
  it("forces learner visibility and content closure for accounts that also have staff rights", async () => {
    await build({ ...user, roles: ["admin", "student"] });
    expect(mocks.tree).toHaveBeenCalledWith(expect.anything(), "course", { groupId: "section", visibleOnly: true, learnerVisibility: true });
    expect(mocks.access).toHaveBeenCalledWith(expect.anything(), "course", "section", "activity", { forceLearner: true });
  });
  it("excludes all inaccessible groups and never loads their content", async () => {
    mocks.groups.mockResolvedValue([]);
    await expect(build()).rejects.toMatchObject({ status: 403 }); expect(mocks.tree).not.toHaveBeenCalled();
    expect(mocks.groups.mock.calls[0][0].where).toMatchObject({ status: "published", participants: { some: { userId: "learner", role: "student" } } });
  });
  it("exports the learner's submitted answers while suppressing unreleased feedback and grades", async () => {
    const result = await build();
    expect(result.documents[0].attempts[0].sections[0].answer[0]).toMatchObject({ text: "My own submitted work" });
    expect(result.documents[0].attempts[0]).not.toHaveProperty("score");
    expect(result.documents[0]).not.toHaveProperty("grade");
    expect(JSON.stringify(result.documents)).not.toContain("Released feedback");
    expect(mocks.attempt.mock.calls[0][0].where).toMatchObject({ participantId: "participant", userId: "learner", lifecycle: { in: ["submitted", "graded"] } });
  });
  it("includes released feedback and keeps a current total distinct from an historical attempt score", async () => {
    mocks.policy.mockResolvedValue({ id: "gradebook", gradesReleased: true, updatedAt: stamp });
    mocks.grade.mockResolvedValue({ normalizedResult: { studentFeedback: { feedbackText: "Overall teacher comment" } } });
    const result = await build();
    expect(result.documents[0]).toMatchObject({ grade: "80 / 100", gradeComment: "Overall teacher comment" });
    expect(result.documents[0].attempts[0]).toMatchObject({ score: null });
    expect(result.documents[0].attempts[0].sections[0].grading[0]).toMatchObject({ text: "Released feedback" });
  });
  it("retains only the released total when prompts/answers have been closed", async () => {
    mocks.access.mockResolvedValue({ locked: true }); mocks.policy.mockResolvedValue({ id: "gradebook", gradesReleased: true });
    const result = await build();
    expect(result.documents[0]).toMatchObject({ grade: "80 / 100", attempts: [] });
    expect(JSON.stringify(result.documents)).not.toContain("Public prompt");
    expect(mocks.content).not.toHaveBeenCalled(); expect(mocks.attempt).not.toHaveBeenCalled();
  });
  it("omits closed content completely when there is no released grade", async () => {
    mocks.access.mockResolvedValue({ locked: true });
    expect((await build()).documents).toEqual([]); expect(mocks.content).not.toHaveBeenCalled();
  });
  it("does not reveal an old grade or feedback while a required review is pending", async () => {
    mocks.policy.mockResolvedValue({ id: "gradebook", gradesReleased: true }); mocks.reviews.mockResolvedValue([{ id: "review", version: 1, attemptId: "attempt" }]);
    expect(JSON.stringify((await build()).documents)).not.toContain("80 / 100");
    expect(mocks.content.mock.calls.find(([input]) => input.attempt)?.[0].attempt.includeGrading).toBe(false);
  });
  it("enforces SEB without a staff bypass, and accepts only the matching trusted access callback", async () => {
    mocks.assigned.mockResolvedValue({ ...activity, assignment: { ...activity.assignment, metadata: { assessmentMode: "summative", requireSafeExamBrowser: true } } });
    expect((await build({ ...user, roles: ["admin", "student"] })).documents).toEqual([]);
    const access = vi.fn().mockResolvedValue(true);
    expect((await build(user, { hasSafeExamBrowserAccess: access })).documents).toHaveLength(1);
    expect(access).toHaveBeenCalledWith({ courseId: "course", groupId: "section", activityId: "activity" });
  });
  it("allows only preparation prompts for a deferred activity whose answering stage is protected", async () => {
    mocks.stage.mockResolvedValue({ assessmentRequired: true });
    mocks.assigned.mockResolvedValue({ ...activity, activityType: { ...activity.activityType, key: "coding-homework-grader" } });
    const result = await build();
    expect(result.documents[0].prompt).toEqual([{ kind: "markdown", text: "Public prompt" }]); expect(result.documents[0].attempts).toEqual([]);
    expect(mocks.content.mock.calls.every(([input]) => input.attempt === null)).toBe(true);
  });
  it("filters submitted attempts by the current assessment mode and does not expose old AI feedback in ordinary practice", async () => {
    mocks.assigned.mockResolvedValue({ ...activity, assignment: { ...activity.assignment, metadata: { assessmentMode: "formative" } } });
    mocks.attempts.mockResolvedValue([{ ...reference(), assessmentMode: "formative" }, { ...reference("old-summative", 2) }]);
    const result = await build();
    expect(result.documents[0].attempts).toHaveLength(1);
    const context = mocks.content.mock.calls.find(([input]) => input.attempt)?.[0];
    expect(context.attempt).toMatchObject({ includeGrading: true, includeAiFeedback: false, feedback: {} });
  });
  it("preserves the submitted Test manifest order, original revision prompts and saved child answers", async () => {
    mocks.assigned.mockResolvedValue({ ...activity, activityType: { ...activity.activityType, key: "test", providerKind: "core" } });
    mocks.attempt.mockResolvedValue({ ...attempt(), metadata: { submissionManifest: { items: [{ testItemId: "second" }, { testItemId: "first" }] } }, testRevisionId: "revision",
      testRevision: { items: [{ id: "r1", sourceTestItemId: "first", title: "Old question", description: "Original prompt", config: {} }] },
      testItemAttempts: ["first", "second"].map(id => ({ testItemId: id, activityId: id, activity: { ...activity, id }, result: { state: { answer: id } }, feedback: {}, pluginAttemptRef: null })) });
    const result = await build();
    expect(result.documents[0].attempts[0].sections.map(section => section.title)).toEqual(["Exercise", "Old question"]);
    expect(mocks.content.mock.calls.map(([input]) => input.attempt.state.answer)).toEqual(["second", "first"]);
  });
  it("exports only active material plugins, without ever using their private settings or indexes", async () => {
    mocks.tree.mockResolvedValue([item("note", { kind: "content", activityId: null, courseGroupActivityId: null, contentResourceId: "text" })]);
    mocks.resources.mockResolvedValue([{ id: "text", courseId: "course", groupId: null, title: "Lesson", pluginKey: "text-content", contentTypeKey: "text", metadata: {}, updatedAt: stamp }]);
    expect((await build()).documents[0].prompt).toEqual([{ kind: "markdown", text: "Visible lesson" }]);
    mocks.resourceActive.mockRejectedValue(new AppError(400, "PLUGIN_INACTIVE", "Inactive"));
    mocks.materialContent.mockClear(); expect((await build()).documents).toEqual([]); expect(mocks.materialContent).not.toHaveBeenCalled();
  });
  it("rejects oversized stored payloads before invoking content exporters", async () => {
    mocks.bytes.mockResolvedValue([{ count: 1n, bytes: 32_000_001n }]);
    await expect(build()).rejects.toMatchObject({ status: 413 }); expect(mocks.content).not.toHaveBeenCalled();
  });
  it.each(["flag", "visibility", "enrollment", "closure", "release"])("discards prepared output after %s changes", async change => {
    const result = await build();
    if (change === "flag") mocks.course.mockResolvedValue({ ...course, studentCourseExportEnabled: false });
    if (change === "visibility") mocks.tree.mockResolvedValue([]);
    if (change === "enrollment") mocks.groups.mockResolvedValue([]);
    if (change === "closure") mocks.access.mockResolvedValue({ locked: true });
    if (change === "release") mocks.policy.mockResolvedValue({ id: "gradebook", gradesReleased: true, updatedAt: stamp });
    await expect(result.revalidate()).rejects.toMatchObject({ status: expect.any(Number) });
  });
  it("revalidates plugin-private saved content as well as core access and timestamps", async () => {
    const result = await build(); mocks.content.mockResolvedValue({ prompt: [], answer: [{ kind: "code", text: "Changed saved source" }] });
    await expect(result.revalidate()).rejects.toMatchObject({ code: "COURSE_EXPORT_CHANGED" });
  });
  it("stops cancelled preparation before querying content", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(build(user, { signal: controller.signal })).rejects.toHaveProperty("name", "AbortError"); expect(mocks.course).not.toHaveBeenCalled();
  });
});

it("preserves sibling/folder order and never traverses hidden/orphaned parents or cycles", () => {
  const rows = [item("late", { position: 3 }), item("folder", { kind: "folder", position: 1 }), item("child", { parentId: "folder", position: 0 }),
    item("orphan", { parentId: "hidden" }), item("cycle", { parentId: "cycle" })];
  const ordered = studentCourseExportOrder(rows);
  expect(ordered.map(({ item }) => item.id)).toEqual(["folder", "child", "late"]);
  expect(ordered[1].path).toHaveLength(2);
});
