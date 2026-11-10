import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
import { registerActivityPlugin, type GradebookActionDefinition } from "@cognelo/activity-sdk";
import { registerServerActivityPlugin } from "@cognelo/activity-sdk/server";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), activity: vi.fn(), group: vi.fn(), roster: vi.fn(), availability: vi.fn(), execute: vi.fn(), installation: vi.fn() }));
vi.mock("@cognelo/db", () => ({ prisma: { activity: { findFirst: mocks.activity }, courseGroup: { findFirst: mocks.group }, courseGroupParticipant: { findMany: mocks.roster }, activityPluginInstallation: { findUnique: mocks.installation } } }));
vi.mock("./authorization", () => ({ assertCanViewCourseGradebook: mocks.authorize }));
import { executeGradebookPluginAction, listGradebookPluginActions } from "./gradebook-plugin-actions";
const labels = { en: "Download evidence", fr: "Télécharger", zh: "下载", ar: "تنزيل" };
const actions: GradebookActionDefinition[] = [{ id: "one", scope: "participant", kind: "download", labels }, { id: "all", scope: "activity", kind: "download", labels }];
registerActivityPlugin({ key: "generic-evidence", name: "Evidence", packageName: "test", db: { namespace: "test", tables: [] }, activities: [{ key: "generic-evidence", name: "Evidence", description: "", studentView: { mode: "read_only" }, gradebookActions: actions }] });
registerServerActivityPlugin({ key: "generic-evidence", gradebookActions: { activityTypeKeys: ["generic-evidence"], availability: mocks.availability, execute: mocks.execute } });
const user = { id: "grader" } as CurrentUser;
beforeEach(() => {
  vi.resetAllMocks(); mocks.installation.mockResolvedValue({ isActivated: true, isEnabled: false }); mocks.authorize.mockResolvedValue({ gradingGroupIds: ["section"] });
  mocks.activity.mockResolvedValue({ id: "activity", title: "Evidence", description: "", lifecycle: "draft", config: {}, metadata: {}, activityType: { key: "generic-evidence", name: "Evidence", description: "" } });
  mocks.group.mockResolvedValue({ id: "section" }); mocks.roster.mockResolvedValue([{ id: "student", groupId: "section", userId: "learner", firstName: "Ada", lastName: "Learner", email: "ada@example.test", group: { title: "Section" } }]);
  mocks.availability.mockResolvedValue({ one: ["student"], all: ["student"] }); mocks.execute.mockImplementation(async () => new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "application/zip" } }));
});
describe("activity-contributed gradebook actions", () => {
  it("works for a generic provider without core attempts or activity-specific tables", async () => {
    expect((await listGradebookPluginActions(user, "course", "activity")).actions).toEqual(actions.map(action => ({ ...action, participantIds: ["student"] })));
    expect(mocks.roster.mock.calls[0][0].where).toMatchObject({ role: "student", group: { courseId: "course", activities: { some: { activityId: "activity" } } }, groupId: { in: ["section"] } });
    const file = await executeGradebookPluginAction(user, "course", "activity", "one", { participantId: "student" });
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2]);
    expect(mocks.execute.mock.calls[0][0].participants).toEqual([{ participantId: "student", groupId: "section", userId: "learner", name: "Ada Learner", groupTitle: "Section" }]);
  });
  it("rejects unauthorized roles/sections before invoking an activity provider", async () => {
    await expect(listGradebookPluginActions(user, "course", "activity", "foreign")).rejects.toMatchObject({ status: 403 });
    mocks.authorize.mockRejectedValue(new Error("denied"));
    await expect(executeGradebookPluginAction(user, "course", "activity", "all", {})).rejects.toThrow("denied");
    expect(mocks.availability).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("does not invoke an inactive provider or read its private data", async () => {
    mocks.installation.mockResolvedValue({ isActivated: false });
    await expect(listGradebookPluginActions(user, "course", "activity")).rejects.toMatchObject({ code: "GRADEBOOK_ACTION_UNAVAILABLE" });
    expect(mocks.availability).not.toHaveBeenCalled(); expect(mocks.roster).not.toHaveBeenCalled();
  });
  it("enforces declared scope and rejects foreign enrollments and client-owned fields", async () => {
    await expect(executeGradebookPluginAction(user, "course", "activity", "one", {})).rejects.toMatchObject({ status: 400 });
    await expect(executeGradebookPluginAction(user, "course", "activity", "all", { participantId: "student" })).rejects.toMatchObject({ status: 400 });
    await expect(executeGradebookPluginAction(user, "course", "activity", "all", { userId: "learner" })).rejects.toThrow();
    mocks.roster.mockResolvedValue([]);
    await expect(executeGradebookPluginAction(user, "course", "activity", "one", { participantId: "foreign" })).rejects.toMatchObject({ status: 403 });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("fails closed when a provider returns an out-of-scope enrollment", async () => {
    mocks.availability.mockResolvedValue({ all: ["foreign"] });
    await expect(listGradebookPluginActions(user, "course", "activity")).rejects.toMatchObject({ code: "GRADEBOOK_ACTION_CONTRACT_INVALID" });
  });
  it("revalidates readiness, cancellation and unsupported declarations", async () => {
    mocks.availability.mockResolvedValue({ one: [], all: [] });
    await expect(executeGradebookPluginAction(user, "course", "activity", "one", { participantId: "student" })).rejects.toMatchObject({ code: "GRADEBOOK_ACTION_NO_SUBMISSIONS" });
    const controller = new AbortController(); controller.abort();
    await expect(executeGradebookPluginAction(user, "course", "activity", "all", {}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    await expect(executeGradebookPluginAction(user, "course", "activity", "unknown", {})).rejects.toMatchObject({ status: 404 });
    mocks.activity.mockResolvedValue({ id: "activity", activityType: { key: "unsupported" } });
    expect(await listGradebookPluginActions(user, "course", "activity")).toEqual({ actions: [] }); expect(mocks.execute).not.toHaveBeenCalled();
  });
});
