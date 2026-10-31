import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";
const mocks = vi.hoisted(() => ({ course: vi.fn(), bank: vi.fn(), available: vi.fn(), definition: vi.fn(), handler: vi.fn(), live: vi.fn(), read: vi.fn(), replace: vi.fn(),
  db: { $transaction: vi.fn(), test: { findFirst: vi.fn() }, bankTest: { findFirst: vi.fn() }, bankActivity: { update: vi.fn() } } }));
vi.mock("@cognelo/db", () => ({ prisma: mocks.db }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: mocks.definition }));
vi.mock("@cognelo/activity-sdk/server", () => ({ resolvePluginAiGradingInstructionsHandler: mocks.handler }));
vi.mock("./authorization", () => ({ assertCanManageCourse: mocks.course }));
vi.mock("./subjects", () => ({ assertCanManageActivityBank: mocks.bank }));
vi.mock("./plugins", () => ({ isActivityTypeAvailable: mocks.available }));
vi.mock("./activity-authoring-live", () => ({ withActivityAuthoringChange: mocks.live }));
const { getTestAiGradingInstructions, replaceTestAiGradingInstructions } = await import("./test-grading-instructions");
const teacher = { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] };
const target = { scope: "course" as const, ownerId: "course", activityId: "test" };
const item = (id: string, key: string) => ({ id, activity: { id: `activity-${id}`, title: id, metadata: { keep: true }, activityType: { key } } });
let instructions: Record<string, string>;
beforeEach(() => {
  vi.resetAllMocks(); instructions = { "activity-one": "First policy", "activity-two": "Second policy" };
  mocks.definition.mockImplementation(key => ({ grading: { supportsAiFeedbackGrading: key !== "feedback-only" } }));
  mocks.handler.mockImplementation(key => key === "no-field" ? null : { getInstructions: mocks.read, replaceInstructions: mocks.replace });
  mocks.available.mockResolvedValue(true);
  mocks.read.mockImplementation(async input => instructions[input.activityId] ?? "");
  mocks.replace.mockImplementation(async input => { instructions[input.activityId] = input.instructions; });
  const test = { items: [item("one", "programming"), item("two", "programming"), item("three", "feedback-only"), item("four", "no-field")] };
  mocks.db.test.findFirst.mockResolvedValue(test); mocks.db.bankTest.findFirst.mockResolvedValue(test);
  mocks.db.$transaction.mockImplementation(fn => fn(mocks.db));
  mocks.live.mockImplementation((_user, _course, _activity, _input, fn) => fn(mocks.db));
});
describe("bulk Test AI grading instructions", () => {
  it("requires both grading capability and an instruction provider and excludes unavailable types", async () => {
    expect((await getTestAiGradingInstructions(teacher, target)).items.map(item => item.testItemId)).toEqual(["one", "two"]);
    expect(mocks.db.test.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { activityId: "test", courseId: "course" },
      include: expect.objectContaining({ items: expect.objectContaining({ where: { removedAt: null } }) }) }));
    mocks.available.mockResolvedValue(false);
    expect((await getTestAiGradingInstructions(teacher, target)).items).toEqual([]);
  });
  it("replaces all eligible instructions under the existing live-authoring transaction and audit", async () => {
    const snapshot = await getTestAiGradingInstructions(teacher, target);
    expect(await replaceTestAiGradingInstructions(teacher, target, { instructions: " New shared policy ", expectedRevision: snapshot.revision })).toEqual({ updatedCount: 2 });
    expect(instructions).toEqual({ "activity-one": "New shared policy", "activity-two": "New shared policy" });
    expect(mocks.live).toHaveBeenCalledWith(teacher, "course", "test", expect.anything(), expect.any(Function), expect.objectContaining({ eventType: "test_ai_grading_instructions_replaced", preservePartialSubmissions: true }));
    expect(mocks.replace.mock.calls.every(([input]) => input.scope === "course" && input.actorUserId === teacher.id)).toBe(true);
  });
  it("rejects a stale instruction snapshot before replacing any child", async () => {
    const snapshot = await getTestAiGradingInstructions(teacher, target);
    instructions["activity-two"] = "Another teacher changed this";
    await expect(replaceTestAiGradingInstructions(teacher, target, { instructions: "Replace", expectedRevision: snapshot.revision })).rejects.toMatchObject({ code: "TEST_AI_INSTRUCTIONS_CONFLICT" });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("marks a reusable Test and changed children as drafts without storing a global policy", async () => {
    const bankTarget = { ...target, scope: "bank" as const, ownerId: "bank" };
    const snapshot = await getTestAiGradingInstructions(teacher, bankTarget);
    await replaceTestAiGradingInstructions(teacher, bankTarget, { instructions: "Bank policy", expectedRevision: snapshot.revision });
    expect(mocks.bank).toHaveBeenCalledWith(teacher, "bank");
    expect(mocks.db.bankActivity.update).toHaveBeenCalledWith({ where: { id: "test" }, data: { lifecycle: "draft" } });
    expect(mocks.db.bankActivity.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "activity-one" }, data: expect.objectContaining({ lifecycle: "draft", metadata: { keep: true, aiGradingInstructionsRevision: expect.any(String) } }) }));
  });
  it("denies non-managers before reading any private field", async () => {
    mocks.course.mockRejectedValue(new AppError(403, "FORBIDDEN", "Denied"));
    await expect(getTestAiGradingInstructions(teacher, target)).rejects.toMatchObject({ status: 403 });
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
