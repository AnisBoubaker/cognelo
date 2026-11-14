import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), handler: vi.fn() }));
vi.mock("@cognelo/core", () => ({ getCourseActivityProgress: mocks.snapshot }));
vi.mock("@cognelo/activity-sdk/server", () => ({ resolveActivityStudentProgressHandler: () => mocks.handler }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: () => ({ submissionStages: [{ id: "files", names: { en: "File submission", fr: "Remise des fichiers" } }] }) }));
import { courseActivityProgress } from "./activity-progress";
describe("progress projection", () => {
  beforeEach(() => {
    mocks.snapshot.mockResolvedValue({ attempts: [], participants: [{ participantId: "p", groupId: "g", userId: "u" }], activityTypeKey: "plugin", activityMetadata: {}, assignmentMetadata: {}, progress: [{ participantId: "p", groupId: "g", state: "not_started" }] });
  });
  it("accepts only authorized neutral status fields and host-declared stage names", async () => {
    mocks.handler.mockResolvedValue([{ participantId: "p", groupId: "g", state: "stage_submitted", stageId: "files", privateSource: "secret", stageNames: { en: "private" } }, { participantId: "foreign", groupId: "other", state: "done" }]);
    const result = await courseActivityProgress({ id: "teacher" } as never, "course", "activity");
    expect(result.progress).toEqual([{ participantId: "p", groupId: "g", state: "stage_submitted", stageId: "files", stageNames: { en: "File submission", fr: "Remise des fichiers" } }]);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain('"userId"');
  });
  it("rejects unknown stages instead of showing a misleading submitted badge", async () => {
    mocks.handler.mockResolvedValue([{ participantId: "p", groupId: "g", state: "stage_submitted", stageId: "unknown" }]);
    expect((await courseActivityProgress({ id: "teacher" } as never, "course", "activity")).progress[0].state).toBe("not_started");
  });
});
