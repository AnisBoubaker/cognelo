import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";

for (const timed of [false, true]) {
  test(`messaging toggles live during ${timed ? "a timed" : "an untimed"} activity without losing answers or messages`, { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage, studentPage }) => {
    test.setTimeout(90_000);
    const studentApi = await createAuthenticatedApi("student");
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const assignedPath = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
    const messagingPath = `/api/courses/${data.courseId}/gradebook/activities/${data.activityId}/messages?groupId=${data.groupId}`;
    const readSettings = async () => (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath))).settings;
    try {
      const initial = await readSettings();
      expect(initial.general.messagingEnabled).toBe(false);
      await responseJson(await teacherApi.post(settingsPath, { data: { ...initial.general, assessmentMode: "summative", timeLimitMinutes: timed ? 30 : null, groupAssignments: initial.groups } }));
      await studentPage.goto(assignedPath.replace("/api", ""));
      if (timed) await studentPage.getByRole("button", { name: "Start timed attempt" }).click();
      await studentPage.getByLabel("Four", { exact: true }).check();
      expect(await responseJson(await studentApi.get(`${assignedPath}/messages`))).toEqual({ conversation: null });
      const trigger = studentPage.getByRole("button", { name: /Open activity messages/ });
      await expect(trigger).toBeHidden();
      expect((await teacherApi.post(messagingPath, { data: { body: "Not enabled" } })).status()).toBe(403);

      await teacherPage.goto(`/courses/${data.courseId}?tab=content`);
      await teacherPage.getByRole("button", { name: `Actions for ${data.title}` }).click();
      await teacherPage.getByRole("menuitem", { name: "Settings", exact: true }).click();
      const settingsDialog = teacherPage.getByRole("dialog", { name: data.title, exact: true });
      const toggle = settingsDialog.getByRole("checkbox", { name: /Enable activity messaging/ });
      await expect(toggle).not.toBeChecked();
      await toggle.check();
      await settingsDialog.getByRole("button", { name: "Save settings", exact: true }).click();
      const warning = teacherPage.getByRole("dialog", { name: "Students are answering", exact: true });
      await warning.getByRole("button", { name: "Cancel", exact: true }).click();
      expect((await readSettings()).general.messagingEnabled).toBe(false);
      await settingsDialog.getByRole("button", { name: "Save settings", exact: true }).click();
      await warning.getByLabel("Message to students (optional)").fill("Messaging is now available.");
      await warning.getByRole("button", { name: "Apply settings", exact: true }).click();
      await expect(settingsDialog).toBeHidden();
      await expect(trigger).toBeVisible({ timeout: 10_000 });
      await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
      await trigger.click();
      const messages = studentPage.getByRole("dialog", { name: "Activity messages", exact: true });
      await expect(messages.getByText("Messaging is now available.")).toBeVisible();
      const { conversation } = await responseJson<{ conversation: { id: string; attemptId: string | null } }>(await studentApi.get(`${assignedPath}/messages`));

      // Omission by an older caller must preserve the activity's switch.
      const enabled = await readSettings();
      const { messagingEnabled: _omitted, ...legacyGeneral } = enabled.general;
      await responseJson(await teacherApi.post(settingsPath, { data: { ...legacyGeneral, groupAssignments: enabled.groups, confirmActiveStudents: true } }));
      expect((await readSettings()).general.messagingEnabled).toBe(true);
      await teacherPage.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}?groupId=${data.groupId}`);
      const broadcastButton = teacherPage.getByRole("button", { name: "Message students", exact: true });
      await expect(broadcastButton).toBeVisible();
      await broadcastButton.click();

      const update = { ...enabled.general, messagingEnabled: false, groupAssignments: enabled.groups };
      const rejected = await teacherApi.post(settingsPath, { data: update });
      expect(rejected.status()).toBe(409);
      expect((await rejected.json()).error.details.canNotifyStudents).toBe(false);
      await responseJson(await teacherApi.post(settingsPath, { data: { ...update, confirmActiveStudents: true } }));
      await expect(messages).toBeHidden({ timeout: 10_000 });
      await expect(trigger).toBeHidden();
      await expect(broadcastButton).toBeHidden({ timeout: 15_000 });
      await expect(teacherPage.getByRole("dialog", { name: "Broadcast a message" })).toBeHidden();
      await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
      expect((await teacherApi.post(messagingPath, { data: { body: "Disabled" } })).status()).toBe(403);
      expect((await studentApi.patch(`${assignedPath}/messages`, { data: { conversationId: conversation.id } })).status()).toBe(403);
      await responseJson(await teacherApi.post(settingsPath, { data: { ...update, messagingEnabled: true, confirmActiveStudents: true } }));
      await expect(trigger).toBeVisible({ timeout: 10_000 });
      await trigger.click();
      await expect(messages.getByText("Messaging is now available.")).toBeVisible();
      const restored = await responseJson<{ conversation: typeof conversation }>(await studentApi.get(`${assignedPath}/messages`));
      expect(restored.conversation.id).toBe(conversation.id);
      expect(restored.conversation.attemptId).toBe(conversation.attemptId);
      await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
    } finally { await studentApi.dispose(); }
  });
}
