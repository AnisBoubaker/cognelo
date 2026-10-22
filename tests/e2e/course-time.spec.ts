import { prisma } from "@cognelo/db";
import type { ApplicationTimeSettingsDto, CourseTimeSettingsDto } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";

test("course timezone opt-in, inheritance, scheduling and student display stay isolated from browser and app zones", async ({ adminPage, studentPage, browser, bankCourse: data, teacherApi }, testInfo) => {
  test.setTimeout(150_000);
  const admin = await createAuthenticatedApi("admin");
  const original = await responseJson<ApplicationTimeSettingsDto>(await admin.get("/api/settings/time"));
  const context = await browser.newContext({ storageState: await teacherApi.storageState(), locale: "en-CA", timezoneId: "Asia/Tokyo" });
  let otherCourseId: string | undefined;
  try {
    await responseJson(await admin.put("/api/settings/time", { data: { timeZone: "UTC", allowCourseTimeZone: false } }));
    const path = `/api/courses/${data.courseId}/time`;
    expect(await responseJson(await teacherApi.get(path))).toMatchObject({ timeZone: "UTC", courseTimeZone: null, canConfigure: false });
    expect((await teacherApi.put(path, { data: { timeZone: "America/Toronto" } })).status()).toBe(403);
    const page = await context.newPage();
    await page.goto(`/courses/${data.courseId}?tab=settings&section=general`);
    await expect(page.getByRole("tab", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByLabel("Course timezone", { exact: true })).toHaveCount(0);

    await adminPage.goto("/settings/time");
    const permission = adminPage.getByLabel("Allow teachers (course owners) to set a course timezone.", { exact: true });
    await expect(permission).not.toBeChecked();
    await permission.check();
    await adminPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminPage.getByText("Timezone saved.", { exact: true })).toBeVisible();
    await adminPage.reload();
    await expect(permission).toBeChecked();

    // A course created after opt-in also inherits the application timezone.
    const { course: other } = await responseJson<{ course: { id: string } }>(await teacherApi.post("/api/courses", {
      data: { title: `Timezone isolation ${data.token}`, subjectId: data.subjectId, status: "published" }
    }));
    otherCourseId = other.id;
    expect(await responseJson(await teacherApi.get(`/api/courses/${other.id}/time`))).toMatchObject({ timeZone: "UTC", courseTimeZone: null });
    await page.reload();
    const zone = page.getByLabel("Course timezone", { exact: true });
    await expect(zone).toHaveValue("");
    await expect(zone.locator("option:checked")).toHaveText("Use application timezone (UTC)");
    await zone.selectOption("America/Toronto");
    await page.locator("#course-time-settings").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(zone).toHaveValue("");
    await zone.selectOption("America/Toronto");
    await page.locator("#course-time-settings").getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Timezone saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(zone).toHaveValue("America/Toronto");
    await zone.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("course-timezone-settings.png") });
    expect(await responseJson(await teacherApi.get(`/api/courses/${other.id}/time`))).toMatchObject({ timeZone: "UTC" });
    expect(await responseJson(await admin.get("/api/application-time"))).toMatchObject({ timeZone: "UTC" });

    await page.getByRole("tab", { name: "Content", exact: true }).click();
    await page.getByRole("button", { name: `Actions for ${data.title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("tab", { name: "General", exact: true }) });
    await dialog.locator(`[id="activity-settings-mode-${data.activityId}"]`).selectOption("summative");
    const from = `activity-settings-from-${data.activityId}`, until = `activity-settings-until-${data.activityId}`;
    await dialog.locator(`[id="${from}"]`).fill("2030-07-15");
    await dialog.locator(`[id="${from}-time"]`).fill("13:14");
    await dialog.locator(`[id="${until}"]`).fill("2030-07-15");
    await dialog.locator(`[id="${until}-time"]`).fill("15:14");
    await expect(dialog.locator(".date-time-zone-label").first()).toHaveText("America/Toronto");
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(dialog).toBeHidden();
    const assignmentPath = `/api/courses/${data.courseId}/activities/${data.activityId}/assign-all-groups`;
    const saved = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(assignmentPath));
    expect(saved.settings.general.availableFrom).toBe("2030-07-15T17:14:00.000Z");
    expect(saved.settings.general.availableUntil).toBe("2030-07-15T19:14:00.000Z");
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await expect(studentPage.locator(".metadata-badge").filter({ hasText: "13:14" })).toBeVisible();
    await studentPage.screenshot({ path: testInfo.outputPath("student-course-timezone.png") });

    // Turning the policy off changes display only; the chosen zone is retained.
    await responseJson(await admin.put("/api/settings/time", { data: { timeZone: "UTC", allowCourseTimeZone: false } }));
    expect(await responseJson(await teacherApi.get(path))).toMatchObject({ timeZone: "UTC", courseTimeZone: "America/Toronto", canConfigure: false });
    await studentPage.reload();
    await expect(studentPage.locator(".metadata-badge").filter({ hasText: "17:14" })).toBeVisible();
    const unchanged = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(assignmentPath));
    expect(unchanged.settings.general.availableFrom).toBe(saved.settings.general.availableFrom);
    expect(unchanged.settings.general.availableUntil).toBe(saved.settings.general.availableUntil);

    await responseJson(await admin.put("/api/settings/time", { data: { timeZone: "Europe/Paris", allowCourseTimeZone: true } }));
    expect(await responseJson(await teacherApi.get(path))).toMatchObject({ timeZone: "America/Toronto" });
    expect(await responseJson(await teacherApi.get(`/api/courses/${other.id}/time`))).toMatchObject({ timeZone: "Europe/Paris" });
    await page.goto(`/courses/${data.courseId}?tab=settings&section=general`);
    await page.reload();
    await zone.selectOption("");
    await page.locator("#course-time-settings").getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Timezone saved.", { exact: true })).toBeVisible();
    expect(await responseJson(await teacherApi.get(path))).toMatchObject({ timeZone: "Europe/Paris", courseTimeZone: null });
  } finally {
    await context.close();
    if (otherCourseId) await prisma.course.delete({ where: { id: otherCourseId } });
    await responseJson(await admin.put("/api/settings/time", { data: { timeZone: original.timeZone, allowCourseTimeZone: original.allowCourseTimeZone } }));
    await admin.dispose();
  }
});

test("course timezone requires explicit ownership and audits changes", async ({ bankCourse: data, teacherApi, teacherPage }) => {
  const admin = await createAuthenticatedApi("admin");
  const student = await createAuthenticatedApi("student");
  const original = await responseJson<ApplicationTimeSettingsDto>(await admin.get("/api/settings/time"));
  const path = `/api/courses/${data.courseId}/time`;
  try {
    await responseJson(await admin.put("/api/settings/time", { data: { timeZone: "UTC", allowCourseTimeZone: true } }));
    expect((await student.put(path, { data: { timeZone: "Europe/Paris" } })).status()).toBe(403);
    expect((await teacherApi.put(path, { data: { timeZone: "Invalid/Zone" } })).status()).toBe(400);
    expect((await teacherApi.put(path, { data: { timeZone: "+04:00" } })).status()).toBe(400);
    await responseJson(await teacherApi.put(path, { data: { timeZone: "Europe/Paris" } }));
    const { user: owner } = await responseJson<{ user: { id: string } }>(await teacherApi.get("/api/users/me"));
    const { user: adminUser } = await responseJson<{ user: { id: string } }>(await admin.get("/api/users/me"));
    await expect(prisma.courseAuditEvent.findFirst({ where: { courseId: data.courseId, eventType: "course_timezone_updated" } })).resolves.toMatchObject({
      actorUserId: owner.id, previousValue: { timeZone: null }, nextValue: { timeZone: "Europe/Paris" }
    });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/memberships`, { data: { userId: adminUser.id, role: "owner" } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/memberships`, { data: { userId: owner.id, role: "teacher" } }));
    const { course } = await responseJson<{ course: { memberships: Array<{ id: string; role: string; userId: string }> } }>(await teacherApi.get(`/api/courses/${data.courseId}`));
    const ownerMembership = course.memberships.find((entry) => entry.userId === owner.id && entry.role === "owner")!;
    await responseJson(await admin.delete(`/api/courses/${data.courseId}/memberships/${ownerMembership.id}`));
    expect((await teacherApi.put(path, { data: { timeZone: "Asia/Tokyo" } })).status()).toBe(403);
    const readOnly = await responseJson<CourseTimeSettingsDto>(await teacherApi.get(path));
    expect(readOnly).toMatchObject({ timeZone: "Europe/Paris", canConfigure: false });
    await teacherPage.goto(`/courses/${data.courseId}?tab=settings&section=general`);
    await expect(teacherPage.getByRole("tab", { name: "Settings", exact: true })).toBeVisible();
    await expect(teacherPage.getByLabel("Course timezone", { exact: true })).toHaveCount(0);
    await responseJson(await admin.put(path, { data: { timeZone: "Asia/Tokyo" } }));
    expect(await responseJson(await student.get(path))).toMatchObject({ timeZone: "Asia/Tokyo", canConfigure: false });
  } finally {
    await responseJson(await admin.put("/api/settings/time", { data: { timeZone: original.timeZone, allowCourseTimeZone: original.allowCourseTimeZone } }));
    await admin.dispose(); await student.dispose();
  }
});
