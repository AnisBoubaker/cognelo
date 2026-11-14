import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ scope: vi.fn(), read: vi.fn(), readFile: vi.fn(), assignment: vi.fn(), attempt: vi.fn(), draft: vi.fn(), child: vi.fn(), revision: vi.fn() }));
vi.mock("./activity-report-scope", () => ({ activityReportScope: mocks.scope }));
vi.mock("./gradebook", () => ({ assignmentAssessmentMode: () => "formative" }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: () => ({ supportsWorkInspection: true }) }));
vi.mock("@cognelo/activity-sdk/server", () => ({ getWorkInspectionService: () => ({ read: mocks.read, readFile: mocks.readFile }) }));
vi.mock("@cognelo/db", () => ({ prisma: {
  courseGroupActivity: { findUnique: mocks.assignment }, activityAttempt: { findFirst: mocks.attempt }, activityResponseDraft: { findUnique: mocks.draft },
  testItemAttempt: { findUnique: mocks.child }, testRevisionItem: { findUnique: mocks.revision }
} }));
import { inspectActivityWork, inspectActivityWorkFile } from "./work-inspection";
const actor = {} as never, at = new Date("2026-11-14T12:00:00Z");
describe("read-only work inspection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scope.mockResolvedValue({ activity: { id: "activity", title: "Activity", activityType: { key: "coding-exercise" }, config: {}, metadata: {} }, participants: [{ participantId: "p", groupId: "g", name: "Student", groupTitle: "Section" }] });
    mocks.assignment.mockResolvedValue({ id: "assignment", metadata: {} }); mocks.attempt.mockResolvedValue(null);
    mocks.draft.mockResolvedValue({ state: { sourceCode: "saved answer", privateKey: "PRIVATE" }, updatedAt: at });
    mocks.read.mockResolvedValue({ sections: [{ id: "answer", privateField: "PRIVATE", blocks: [{ kind: "code", text: "saved answer", rawResult: "PRIVATE" }] }] });
  });
  it("inspects a draft without requiring a submission and returns only declared content", async () => {
    const snapshot = await inspectActivityWork(actor, "course", "activity", "g", "p");
    expect(snapshot).toMatchObject({ attemptNumber: null, savedAt: at.toISOString(), sections: [{ id: "answer", blocks: [{ kind: "code", text: "saved answer" }] }] });
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE");
    expect(mocks.read).toHaveBeenCalledWith(expect.objectContaining({ state: expect.objectContaining({ sourceCode: "saved answer" }), embedded: false }));
    expect(mocks.attempt).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ lifecycle: "started", assessmentMode: "formative", participantId: "p" }) }));
  });
  it("rejects unauthorized users before reading any saved work or file", async () => {
    mocks.scope.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    await expect(inspectActivityWork(actor, "course", "activity", "other", "p")).rejects.toMatchObject({ status: 403 });
    await expect(inspectActivityWorkFile(actor, "course", "activity", "other", "p", "key")).rejects.toMatchObject({ status: 403 });
    expect(mocks.assignment).not.toHaveBeenCalled(); expect(mocks.readFile).not.toHaveBeenCalled();
  });
  it("loads only a selected Test question and rejects questions outside the parent manifest", async () => {
    const childActivity = { id: "child", title: "Question", config: {}, metadata: {}, activityType: { key: "mcq" } };
    mocks.scope.mockResolvedValue({ activity: { id: "activity", title: "Test", activityType: { key: "test" } }, participants: [{ participantId: "p", groupId: "g", name: "Student", groupTitle: "Section" }] });
    const parent = { metadata: { manifest: { items: [{ testItemId: "one", title: "One" }, { testItemId: "two", title: "Two" }] } }, testRevisionId: "revision" };
    mocks.attempt.mockResolvedValueOnce({ id: "parent", attemptNumber: 1, startedAt: at }).mockResolvedValueOnce(parent);
    mocks.child.mockResolvedValue({ result: { state: { answers: { selected: ["choice"] } }, rawResult: "PRIVATE" }, updatedAt: at, activity: childActivity });
    mocks.revision.mockResolvedValue({ activityTypeKey: "mcq", title: "Question", config: {}, metadata: {} });
    const snapshot = await inspectActivityWork(actor, "course", "activity", "g", "p", "two");
    expect(snapshot.items).toHaveLength(2); expect(snapshot.selectedItemId).toBe("two");
    expect(mocks.child).toHaveBeenCalledOnce();
    expect(mocks.child.mock.calls[0][0].where).toEqual({ parentAttemptId_testItemId: { parentAttemptId: "parent", testItemId: "two" } });
    expect(mocks.read).toHaveBeenCalledWith(expect.objectContaining({ embedded: true, state: { answers: { selected: ["choice"] } } }));
    mocks.attempt.mockResolvedValueOnce({ id: "parent", attemptNumber: 1, startedAt: at }).mockResolvedValueOnce(parent);
    await expect(inspectActivityWork(actor, "course", "activity", "g", "p", "foreign")).rejects.toMatchObject({ status: 404 });
    expect(mocks.child).toHaveBeenCalledOnce();
  });
});
