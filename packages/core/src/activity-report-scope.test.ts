import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ activity: { findFirst: vi.fn() }, courseGroup: { findFirst: vi.fn() }, activityPluginInstallation: { findUnique: vi.fn() }, courseGroupParticipant: { findMany: vi.fn() } }));
const permissions = vi.hoisted(() => vi.fn());
vi.mock("@cognelo/db", () => ({ prisma: db }));
vi.mock("./authorization", () => ({ assertCanViewCourseGradebook: permissions }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: () => ({ provider: { kind: "plugin", key: "provider" } }) }));
import { activityReportScope } from "./activity-report-scope";
describe("activity report authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks(); permissions.mockResolvedValue({ gradingGroupIds: ["section"] });
    db.activity.findFirst.mockResolvedValue({ id: "activity", activityType: { key: "plugin" }, metadata: {}, config: {} });
    db.courseGroup.findFirst.mockResolvedValue({ id: "section" }); db.activityPluginInstallation.findUnique.mockResolvedValue({ isActivated: true });
    db.courseGroupParticipant.findMany.mockResolvedValue([]);
  });
  it("rejects a foreign section before reading activity or plugin evidence", async () => {
    await expect(activityReportScope({} as never, "course", "activity", "foreign")).rejects.toMatchObject({ status: 403 });
    expect(db.activity.findFirst).not.toHaveBeenCalled();
  });
  it("restricts course-wide reads to assigned sections and resolves current account names", async () => {
    db.courseGroupParticipant.findMany.mockResolvedValue([{ id: "p", userId: "u", groupId: "section", firstName: "Old", lastName: "Enrollment", email: "old", group: { title: "Section" }, user: { firstName: "Current", lastName: "Name" } }]);
    expect((await activityReportScope({} as never, "course", "activity")).participants[0].name).toBe("Current Name");
    expect(db.courseGroupParticipant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ groupId: { in: ["section"] }, group: { courseId: "course", activities: { some: { activityId: "activity" } } } }) }));
  });
  it("rejects an inactive provider and a foreign enrollment", async () => {
    db.activityPluginInstallation.findUnique.mockResolvedValue({ isActivated: false });
    await expect(activityReportScope({} as never, "course", "activity")).rejects.toMatchObject({ code: "ACTIVITY_REPORT_UNAVAILABLE" });
    db.activityPluginInstallation.findUnique.mockResolvedValue({ isActivated: true });
    await expect(activityReportScope({} as never, "course", "activity", "section", "foreign")).rejects.toMatchObject({ status: 403 });
  });
});
