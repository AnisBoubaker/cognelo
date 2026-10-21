import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi, API_BASE_URL } from "./fixtures/auth";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings, CourseTest, CourseTestItem, CourseTestRuntime } from "../../apps/web/src/lib/api";

test("admin timezone governs scheduling in a differently configured browser and persists", async ({ adminPage, browser, bankCourse: data, teacherApi }, testInfo) => {
  test.setTimeout(120_000);
  const admin = await createAuthenticatedApi("admin");
  const student = await createAuthenticatedApi("student");
  const original = await responseJson<{ timeZone: string }>(await admin.get("/api/settings/time"));
  const context = await browser.newContext({ storageState: await teacherApi.storageState(), locale: "en-CA", timezoneId: "Asia/Tokyo" });
  try {
    expect((await student.put("/api/settings/time", { data: { timeZone: "UTC" } })).status()).toBe(403);
    expect((await teacherApi.put("/api/settings/time", { data: { timeZone: "UTC" } })).status()).toBe(403);
    expect((await admin.put("/api/settings/time", { data: { timeZone: "Invalid/Zone" } })).status()).toBe(400);
    await responseJson(await admin.put("/api/settings/time", { data: { timeZone: "UTC" } }));
    await adminPage.goto("/settings/time");
    await adminPage.getByLabel("Timezone", { exact: true }).selectOption("America/Toronto");
    await adminPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminPage.getByText("Timezone saved.", { exact: true })).toBeVisible();
    await adminPage.reload();
    await expect(adminPage.getByLabel("Timezone", { exact: true })).toHaveValue("America/Toronto");
    await adminPage.screenshot({ path: testInfo.outputPath("admin-timezone.png") });
    const page = await context.newPage();
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: `Actions for ${data.title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("tab", { name: "General", exact: true }) });
    await dialog.locator(`[id="activity-settings-mode-${data.activityId}"]`).selectOption("summative");
    const fromId = `activity-settings-from-${data.activityId}`, untilId = `activity-settings-until-${data.activityId}`;
    await dialog.locator(`[id="${fromId}"]`).fill("2030-07-15");
    await dialog.locator(`[id="${fromId}-time"]`).fill("13:14");
    await dialog.locator(`[id="${untilId}"]`).fill("2030-07-15");
    await dialog.locator(`[id="${untilId}-time"]`).fill("15:14");
    await expect(dialog.locator(".date-time-zone-label").first()).toHaveText("America/Toronto");
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(dialog).toBeHidden();
    const saved = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(`/api/courses/${data.courseId}/activities/${data.activityId}/assign-all-groups`));
    expect(saved.settings.general.availableFrom).toBe("2030-07-15T17:14:00.000Z");
    expect(saved.settings.general.availableUntil).toBe("2030-07-15T19:14:00.000Z");
    await page.reload();
    await page.getByRole("button", { name: `Actions for ${data.title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    await expect(dialog.locator(`[id="${fromId}-time"]`)).toHaveValue("13:14");
    await expect(dialog.locator(`[id="${untilId}-time"]`)).toHaveValue("15:14");
    await dialog.screenshot({ path: testInfo.outputPath("tokyo-browser-toronto-schedule.png") });
    await responseJson(await admin.put("/api/settings/time", { data: { timeZone: "Europe/Paris" } }));
    const unchanged = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(`/api/courses/${data.courseId}/activities/${data.activityId}/assign-all-groups`));
    expect(unchanged.settings.general.availableFrom).toBe(saved.settings.general.availableFrom);
  } finally {
    await context.close();
    await responseJson(await admin.put("/api/settings/time", { data: { timeZone: original.timeZone } }));
    await admin.dispose(); await student.dispose();
  }
});

test("a changed browser clock cannot open an upcoming Test or write after its server deadline", async ({ studentPage: page, bankCourse: data, teacherApi }) => {
  test.setTimeout(120_000);
  const { test: created } = await responseJson<{ test: CourseTest }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: { title: "Server clock Test", lifecycle: "published", contentPlacement: { isVisible: true } } }));
  const parentId = created.activity.id;
  const { item } = await responseJson<{ item: CourseTestItem }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${parentId}/test/items`, { data: { source: "local", activityTypeKey: "mcq", title: "Clock question", config: { source: ORIGINAL_SOURCE, randomizeChoices: false } } }));
  await assignCourseTest(data, parentId, created.activity.title);
  const settingsPath = `/api/courses/${data.courseId}/activities/${parentId}/assign-all-groups`;
  const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
  const now = Date.now();
  await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, availableFrom: new Date(now + 3600_000).toISOString(), availableUntil: new Date(now + 7200_000).toISOString(), timeLimitMinutes: 5, groupAssignments: settings.groups } }));
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${parentId}`;
  await page.clock.setSystemTime(new Date(now + 86400_000));
  await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
  await expect(page.getByText("Server clock Test", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Server clock Test", exact: true })).toHaveCount(0);
  async function request(path: string, method: string, payload?: unknown) {
    return page.evaluate(async ({ url, method, payload }) => {
      const response = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      return { status: response.status, body: await response.json() };
    }, { url: `${API_BASE_URL}${path}`, method, payload });
  }
  const early = await request(`${assigned}/test`, "POST", { sessionId: "clock-proof", now: new Date(now + 86400_000).toISOString() });
  expect(early.status).toBe(403);
  expect(early.body.error.code).toBe("GROUP_ACTIVITY_NOT_AVAILABLE");
  await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, availableFrom: null, availableUntil: new Date(now + 3600_000).toISOString(), timeLimitMinutes: 5, groupAssignments: settings.groups } }));
  const started = await request(`${assigned}/test`, "POST", { sessionId: "clock-proof" });
  expect(started.status).toBe(201);
  const runtime = started.body.runtime as CourseTestRuntime;
  expect(runtime.timing.remainingSeconds).toBeGreaterThan(280);
  expect(runtime.timing.remainingSeconds).toBeLessThanOrEqual(300);
  await page.clock.setSystemTime(new Date(now - 86400_000));
  const stillActive = await request(`${assigned}/test?sessionId=clock-proof`, "GET");
  expect(stillActive.status).toBe(200);
  expect(stillActive.body.runtime.timing.remainingSeconds).toBeLessThanOrEqual(300);
  await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, availableFrom: null, availableUntil: new Date(Date.now() - 1000).toISOString(), timeLimitMinutes: 5, groupAssignments: settings.groups, confirmActiveStudents: true } }));
  const late = await request(`${assigned}/test/items/${item.id}`, "PUT", { parentAttemptId: runtime.attempt!.id, sessionId: "clock-proof", state: { answers: {} }, now: new Date(now - 86400_000).toISOString() });
  expect(late.status).toBe(409);
  expect(late.body.error.code).toBe("TEST_TIME_LIMIT_EXPIRED");
});
