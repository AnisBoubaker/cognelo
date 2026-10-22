import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanViewCourse: vi.fn(),
  applicationSettings: { findUnique: vi.fn() },
  course: { findUnique: vi.fn(), update: vi.fn() },
  courseAuditEvent: { create: vi.fn() }
}));
vi.mock("@cognelo/db", () => {
  const db = { applicationSettings: mocks.applicationSettings, course: mocks.course, courseAuditEvent: mocks.courseAuditEvent };
  return { prisma: { ...db, $transaction: (work: (tx: typeof db) => unknown) => work(db) } };
});
vi.mock("./authorization", () => ({ assertCanViewCourse: mocks.assertCanViewCourse, isAdmin: (user: { roles: string[] }) => user.roles.includes("admin") }));
import { getCourseTimeSettings, updateCourseTimeSettings } from "./course-time";

const user = (roles = ["teacher"]) => ({ id: "teacher-1", roles }) as never;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertCanViewCourse.mockResolvedValue(undefined);
  mocks.applicationSettings.findUnique.mockResolvedValue({ timeZone: "America/Toronto", allowCourseTimeZone: true });
  mocks.course.findUnique.mockResolvedValue({ timeZone: null, memberships: [{ id: "owner" }] });
});

describe("course timezone policy", () => {
  it("defaults existing and new courses to the current application timezone", async () => {
    expect(await getCourseTimeSettings(user(), "course-1")).toMatchObject({
      timeZone: "America/Toronto", courseTimeZone: null, canConfigure: true
    });
    mocks.applicationSettings.findUnique.mockResolvedValue({ timeZone: "Europe/Paris", allowCourseTimeZone: true });
    expect((await getCourseTimeSettings(user(), "course-1")).timeZone).toBe("Europe/Paris");
  });

  it("applies a stored choice only when enabled, without deleting it", async () => {
    mocks.course.findUnique.mockResolvedValue({ timeZone: "Asia/Tokyo", memberships: [] });
    expect(await getCourseTimeSettings(user(["student"]), "course-1")).toMatchObject({ timeZone: "Asia/Tokyo", canConfigure: false, timeZones: [] });
    mocks.applicationSettings.findUnique.mockResolvedValue({ timeZone: "UTC", allowCourseTimeZone: false });
    expect(await getCourseTimeSettings(user(), "course-1")).toMatchObject({ timeZone: "UTC", courseTimeZone: "Asia/Tokyo", canConfigure: false });
    expect(mocks.course.update).not.toHaveBeenCalled();
  });

  it("fails closed when application settings have not been initialized", async () => {
    mocks.applicationSettings.findUnique.mockResolvedValue(null);
    expect(await getCourseTimeSettings(user(), "course-1")).toMatchObject({ timeZone: "UTC", canConfigure: false });
    await expect(updateCourseTimeSettings(user(), "course-1", { timeZone: "Europe/Paris" })).rejects.toMatchObject({ status: 403 });
    expect(mocks.course.update).not.toHaveBeenCalled();
  });

  it.each(["teacher", "student", "course_manager"])("rejects %s without explicit ownership", async (role) => {
    mocks.course.findUnique.mockResolvedValue({ timeZone: null, memberships: [] });
    await expect(updateCourseTimeSettings(user([role]), "course-1", { timeZone: "UTC" })).rejects.toMatchObject({ status: 403 });
    expect(mocks.course.findUnique).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({
      memberships: { where: { userId: "teacher-1", role: "owner", source: "explicit" }, select: { id: true } }
    }) }));
    expect(mocks.course.update).not.toHaveBeenCalled();
    expect(mocks.courseAuditEvent.create).not.toHaveBeenCalled();
  });

  it("rejects unrelated users before reading configuration", async () => {
    mocks.assertCanViewCourse.mockRejectedValue({ status: 403 });
    await expect(getCourseTimeSettings(user(), "course-1")).rejects.toMatchObject({ status: 403 });
    expect(mocks.applicationSettings.findUnique).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"])("audits a %s's change without touching any scheduled instants", async (actor) => {
    if (actor === "admin") mocks.course.findUnique.mockResolvedValue({ timeZone: null, memberships: [] });
    await updateCourseTimeSettings(user(actor === "admin" ? ["admin"] : ["teacher"]), "course-1", { timeZone: "Europe/Paris" });
    expect(mocks.course.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "course-1" }, data: { timeZone: "Europe/Paris" } });
    expect(mocks.courseAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      courseId: "course-1", actorUserId: "teacher-1", eventType: "course_timezone_updated",
      previousValue: { timeZone: null }, nextValue: { timeZone: "Europe/Paris" }
    }) });
  });

  it("supports returning to the application default", async () => {
    mocks.course.findUnique.mockResolvedValue({ timeZone: "Europe/Paris", memberships: [{ id: "owner" }] });
    await updateCourseTimeSettings(user(), "course-1", { timeZone: null });
    expect(mocks.course.update).toHaveBeenCalledWith({ where: { id: "course-1" }, data: { timeZone: null } });
  });

  it.each(["teacher", "admin"])("rejects %s writes while the feature is disabled", async (role) => {
    mocks.applicationSettings.findUnique.mockResolvedValue({ timeZone: "UTC", allowCourseTimeZone: false });
    await expect(updateCourseTimeSettings(user([role]), "course-1", { timeZone: "Europe/Paris" })).rejects.toMatchObject({ code: "COURSE_TIMEZONE_DISABLED" });
    expect(mocks.course.update).not.toHaveBeenCalled();
  });

  it.each(["Invalid/Zone", "+04:00", "", 42, undefined])("rejects invalid timezone %s", async (timeZone) => {
    await expect(updateCourseTimeSettings(user(), "course-1", { timeZone })).rejects.toThrow();
    expect(mocks.course.update).not.toHaveBeenCalled();
  });
});
