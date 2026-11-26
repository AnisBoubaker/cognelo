import { beforeEach, expect, it, vi } from "vitest";
import type { CurrentUser, StudentCourseExportPolicy } from "@cognelo/contracts";
const mocks = vi.hoisted(() => ({ find: vi.fn(), upsert: vi.fn(), lock: vi.fn() }));
vi.mock("@cognelo/db", () => {
  const tx = { applicationSettings: { findUnique: mocks.find, upsert: mocks.upsert }, $executeRaw: mocks.lock };
  return { prisma: { ...tx, $transaction: async (work: (db: typeof tx) => Promise<unknown>) => work(tx) } };
});
vi.mock("./authorization", () => ({ isAdmin: (user: CurrentUser) => user.roles.includes("admin") }));
import { getStudentCourseExportPolicy, updateStudentCourseExportPolicy } from "./student-course-export-policy";
const actor = { id: "admin", roles: ["admin"] } as CurrentUser;
const value: StudentCourseExportPolicy = { usageRights: "Site terms", allowTeacherEditing: false };
beforeEach(() => { vi.resetAllMocks(); mocks.find.mockResolvedValue(null); });
it("defaults to inherited empty terms with teacher customization allowed", async () => {
  expect(await getStudentCourseExportPolicy()).toEqual({ usageRights: "", allowTeacherEditing: true });
});
it.each(["student", "teacher", "course_manager"] as const)("denies policy mutation by a %s before persistence", async role => {
  await expect(updateStudentCourseExportPolicy({ ...actor, roles: [role] }, value)).rejects.toMatchObject({ status: 403 });
  expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.lock).not.toHaveBeenCalled();
});
it("updates only the export policy and records the admin under the shared policy lock", async () => {
  mocks.find.mockResolvedValue({ exportUsageRights: "Site terms", allowCourseExportUsageRights: false });
  expect(await updateStudentCourseExportPolicy(actor, value)).toEqual(value);
  const saved = mocks.upsert.mock.calls[0][0].update;
  expect(saved).toEqual({ exportUsageRights: "Site terms", allowCourseExportUsageRights: false, updatedById: "admin" });
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.upsert.mock.invocationCallOrder[0]);
});
it.each([{ ...value, usageRights: "x".repeat(20_001) }, { ...value, allowTeacherEditing: "false" }, { ...value, userId: "other" }])("rejects invalid or extra policy fields", async input => {
  await expect(updateStudentCourseExportPolicy(actor, input)).rejects.toBeDefined(); expect(mocks.upsert).not.toHaveBeenCalled();
});
