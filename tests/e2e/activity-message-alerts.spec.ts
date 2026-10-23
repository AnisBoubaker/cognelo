import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";
import type { ActivityMessagingStatus, CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

test("teachers receive visible and audible message alerts, can mute, and stop polling after leaving", async ({ bankCourse: data, teacherApi, teacherPage: page }, testInfo) => {
  test.setTimeout(150_000);
  const student = await createAuthenticatedApi("student"), admin = await createAuthenticatedApi("admin");
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
  const messages = `/api/courses/${data.courseId}/gradebook/activities/${data.activityId}/messages`;
  const statusPath = `${messages}?summary=1&groupId=${data.groupId}`;
  const reportPath = `/courses/${data.courseId}/gradebook/activities/${data.activityId}?groupId=${data.groupId}`;
  await page.addInitScript(() => {
    const target = window as typeof window & { __messageToneStarts: number; __messageAudioCloses: number };
    target.__messageToneStarts = 0; target.__messageAudioCloses = 0;
    const NativeAudio = window.AudioContext;
    Object.defineProperty(window, "AudioContext", { configurable: true, value: class extends NativeAudio {
      createOscillator() {
        const oscillator = super.createOscillator();
        const original = oscillator.start.bind(oscillator);
        oscillator.start = (when?: number) => { target.__messageToneStarts++; original(when); };
        return oscillator;
      }
      close() { target.__messageAudioCloses++; return super.close(); }
    } });
  });
  const tones = () => page.evaluate(() => (window as unknown as { __messageToneStarts: number }).__messageToneStarts);
  const readStatus = async (api = teacherApi) => (await responseJson<{ messaging: ActivityMessagingStatus }>(await api.get(statusPath))).messaging;
  const refreshStatus = async () => {
    const response = page.waitForResponse((response) => new URL(response.url()).pathname === messages && new URL(response.url()).searchParams.get("summary") === "1" && response.request().method() === "GET");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await response;
  };
  let summaryRequests = 0, historyRequests = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== messages) return;
    if (url.searchParams.get("summary") === "1") summaryRequests++; else historyRequests++;
  });
  try {
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", messagingEnabled: true, twoWayMessagingEnabled: true, groupAssignments: settings.groups } }));
    await responseJson(await student.post(`${assigned}/messages`, { data: { body: "An existing unread question." } }));
    await page.goto(reportPath);
    const trigger = page.getByRole("button", { name: "Message students", exact: true });
    const banner = page.locator(".activity-message-alert");
    await expect(trigger).toBeVisible();
    await expect(banner).toContainText("Unread student messages: 1");
    expect(await tones()).toBe(0); // Existing history is visible, not replayed as a new alert.
    expect(historyRequests).toBe(0);
    await page.getByRole("tab", { name: "Class overview", exact: true }).click(); // Trusted interaction activates browser audio.
    await responseJson(await student.post(`${assigned}/messages`, { data: { body: "A new question needs attention." } }));
    await refreshStatus();
    await expect(banner).toContainText("Unread student messages: 2");
    await expect(trigger).toHaveClass(/has-unread/);
    await expect(page.getByText("New student message", { exact: true })).toBeVisible();
    await expect.poll(tones).toBe(2); // One two-tone chime.
    expect(historyRequests).toBe(0); // Notices do not fetch message bodies while the dialog is closed.
    await refreshStatus();
    expect(await tones()).toBe(2);
    await page.screenshot({ path: testInfo.outputPath("teacher-unread-message-alert.png") });

    const dialog = page.getByRole("dialog", { name: "Activity messages", exact: true });
    const sound = dialog.getByRole("button", { name: "Sound notifications", exact: true });
    const composer = dialog.getByRole("textbox", { name: "Message", exact: true });
    let releaseThread!: () => void;
    const threadReady = new Promise<void>((resolve) => { releaseThread = resolve; });
    await page.route(`**${messages}/conversations/*`, async (route) => { await threadReady; await route.continue(); }, { times: 1 });
    try {
      await page.getByRole("button", { name: "Read messages", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Activity messages", exact: true })).toBeFocused();
      await page.keyboard.press("Space");
      await expect(sound).toHaveAttribute("aria-pressed", "true"); // Loading never focuses the mute action.
    } finally { releaseThread(); }
    await expect(dialog.getByRole("article").filter({ hasText: "A new question needs attention." })).toBeVisible();
    await expect(composer).toBeFocused();
    await page.keyboard.press("Space");
    await expect(composer).toHaveValue(" ");
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await composer.fill("");
    await expect(dialog.getByRole("tab", { name: "Broadcast", exact: true })).toHaveAttribute("aria-selected", "false");
    await expect.poll(async () => (await readStatus()).unreadCount).toBe(0);
    expect((await readStatus(admin)).unreadCount).toBe(2); // Read state belongs to the viewing teacher.
    await refreshStatus();
    await expect(banner).toHaveCount(0);
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await sound.click();
    await expect(sound).toHaveAttribute("aria-pressed", "false");
    await responseJson(await student.post(`${assigned}/messages`, { data: { body: "A question while sound is muted." } }));
    await refreshStatus();
    await expect(dialog.getByRole("article").filter({ hasText: "A question while sound is muted." })).toBeVisible();
    expect(await tones()).toBe(2);
    await page.screenshot({ path: testInfo.outputPath("teacher-muted-messenger.png") });

    await page.reload();
    await trigger.click();
    await expect(composer).toBeFocused();
    await page.keyboard.press("Space");
    await expect(composer).toHaveValue(" ");
    await expect(sound).toHaveAttribute("aria-pressed", "false");
    await composer.fill("");
    expect(await tones()).toBe(0);
    await sound.click();
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await responseJson(await student.post(`${assigned}/messages`, { data: { body: "Sound is enabled again." } }));
    await refreshStatus();
    await expect.poll(tones).toBe(2);
    const current = await readStatus();
    expect(current.studentMessageCount).toBe(4);
    expect(current.latestStudentMessage?.senderName).toBeTruthy();
    expect(current.latestStudentMessage).not.toHaveProperty("body");

    // A teacher's own broadcast changes the revision but does not cause a student-message sound.
    await responseJson(await teacherApi.post(messages, { data: { body: "Teacher announcement." } }));
    await refreshStatus();
    expect(await tones()).toBe(2);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("link", { name: "Back to course gradebook", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${data.courseId}\\?tab=gradebook`));
    await expect.poll(() => page.evaluate(() => (window as unknown as { __messageAudioCloses: number }).__messageAudioCloses)).toBeGreaterThan(0);
    const requestsAfterLeaving = summaryRequests;
    await responseJson(await student.post(`${assigned}/messages`, { data: { body: "Sent after the teacher left the activity." } }));
    await page.waitForTimeout(11_000); // Observe a complete former polling interval after unmounting.
    expect(summaryRequests).toBe(requestsAfterLeaving);
    expect(await tones()).toBe(2);
  } finally { await student.dispose(); await admin.dispose(); }
});

test("unread message summaries respect the selected section", async ({ bankCourse: data, teacherApi }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const { group } = await responseJson<{ group: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/groups`, { data: { title: "Another section" } }));
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/groups/${group.id}`, { data: { status: "published" } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${group.id}/participants`, { data: { email: "student@cognelo.local", role: "student" } }));
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", messagingEnabled: true, twoWayMessagingEnabled: true,
      groupAssignments: settings.groups.map((section) => ({ ...section, assigned: true, overrideFields: [] })) } }));
    for (const groupId of [data.groupId, group.id]) {
      await responseJson(await student.post(`/api/courses/${data.courseId}/groups/${groupId}/activities/assigned/${data.activityId}/messages`, { data: { body: "Section-specific question." } }));
    }
    const path = `/api/courses/${data.courseId}/gradebook/activities/${data.activityId}/messages?summary=1`;
    const all = await responseJson<{ messaging: ActivityMessagingStatus }>(await teacherApi.get(path));
    const scoped = await responseJson<{ messaging: ActivityMessagingStatus }>(await teacherApi.get(`${path}&groupId=${data.groupId}`));
    expect(all.messaging.unreadCount).toBe(2);
    expect(scoped.messaging.unreadCount).toBe(1);
    expect(scoped.messaging.studentMessageCount).toBe(1);
    expect((await student.get(path)).status()).toBe(403);
  } finally { await student.dispose(); }
});
