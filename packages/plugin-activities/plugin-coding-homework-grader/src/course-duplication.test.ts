import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), lock: vi.fn(), copySolution: vi.fn(), selection: vi.fn(),
  assignment: { findUnique: vi.fn(), create: vi.fn() },
  requirements: { findUnique: vi.fn(), create: vi.fn() },
  attachments: { findMany: vi.fn(), create: vi.fn() },
  snapshots: { findFirst: vi.fn(), create: vi.fn() }
}));
const database = {
  pluginCodingHomeworkAssignment: mocks.assignment,
  pluginCodingHomeworkSubmissionRequirementSet: mocks.requirements,
  pluginCodingHomeworkAttachment: mocks.attachments,
  pluginCodingHomeworkDocumentationSnapshot: mocks.snapshots
};
vi.mock("./db-client", () => ({ prisma: { $transaction: mocks.transaction }, Prisma: {} }));
vi.mock("./workflow-settings", () => ({ getHomeworkReferenceSelection: mocks.selection, workflowSettingKeys: [], lockHomeworkSettings: mocks.lock }));
vi.mock("./teacher-solution", () => ({ lockHomeworkTeacherSolution: mocks.lock, copyHomeworkTeacherSolution: mocks.copySolution }));
vi.mock("@cognelo/core", () => ({
  AppError: class extends Error { constructor(_status: number, _code: string, message: string) { super(message); } },
  contentIndexRevision: vi.fn()
}));
const { copyCourseCodingHomeworkAuthoring } = await import("./authoring");
const scope = { user: { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] }, courseId: "course", sourceActivityId: "source", activityId: "copy" };

describe("same-course homework duplication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(callback => callback(database));
    mocks.assignment.findUnique.mockResolvedValue({ promptMarkdown: "Explain your code", questionCount: 4, generationInstructions: "Ask about boundary values", settings: {} });
    mocks.requirements.findUnique.mockResolvedValue(null);
    mocks.attachments.findMany.mockResolvedValue([]);
    mocks.selection.mockResolvedValue(["material"]);
    mocks.snapshots.create.mockResolvedValue({ id: "copied-snapshot" });
  });

  it("retains models and authoring options while independently owning the same prepared index selection", async () => {
    const settings = { workflowVersion: 2, submissionsEnabled: true, preparedSnapshotId: "source-snapshot", referenceMaterialIds: ["material"],
      embeddingConnectionId: "connection", embeddingAi: { connectionId: "connection", model: "vectors" },
      questionGenerationAi: { connectionId: "connection", model: "questions" }, generationConcurrency: 3, customOption: { retained: true } };
    const metadata = { workflowVersion: 2, selected: ["material"], indexIds: ["shared-immutable-index"], preparedAt: "2026-01-01T00:00:00Z" };
    mocks.assignment.findUnique.mockResolvedValue({ settings, questionCount: 4, generationInstructions: "Ask about boundary values" });
    mocks.snapshots.findFirst.mockResolvedValue({ status: "ready", contentTreeFingerprint: "fingerprint", metadata });
    await copyCourseCodingHomeworkAuthoring(scope);
    expect(mocks.snapshots.findFirst).toHaveBeenCalledWith({ where: { id: "source-snapshot", activityId: "source", courseId: "course", groupId: null } });
    expect(mocks.snapshots.create).toHaveBeenCalledWith({ data: { activityId: "copy", courseId: "course", status: "ready", contentTreeFingerprint: "fingerprint", metadata } });
    expect(mocks.assignment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ activityId: "copy", questionCount: 4, generationInstructions: "Ask about boundary values",
      settings: { ...settings, submissionsEnabled: false, preparedSnapshotId: "copied-snapshot" } }) });
    expect(settings.preparedSnapshotId).toBe("source-snapshot");
    expect(settings.submissionsEnabled).toBe(true);
  });

  it("pins the source's default selection even when authoring has never been saved", async () => {
    mocks.assignment.findUnique.mockResolvedValue(null);
    await copyCourseCodingHomeworkAuthoring(scope);
    expect(mocks.selection).toHaveBeenCalledWith(expect.objectContaining({ activityId: "source", courseId: "course" }), {});
    expect(mocks.assignment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ settings: { submissionsEnabled: false, referenceMaterialIds: ["material"] } }) });
    expect(mocks.snapshots.create).not.toHaveBeenCalled();
  });

  it("fails the copy instead of retaining a missing or foreign prepared snapshot", async () => {
    mocks.assignment.findUnique.mockResolvedValue({ settings: { preparedSnapshotId: "foreign-snapshot" } });
    mocks.snapshots.findFirst.mockResolvedValue(null);
    await expect(copyCourseCodingHomeworkAuthoring(scope)).rejects.toThrow("prepared references are unavailable");
    expect(mocks.assignment.create).not.toHaveBeenCalled();
    expect(mocks.snapshots.create).not.toHaveBeenCalled();
  });
});
