import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import type { CourseActivityAssignmentSettings, CourseTestRuntime, LearnerActivityConversation, StaffActivityConversation } from "../../apps/web/src/lib/api";

test("Test messages capture the selected exercise and retain it after navigation and author edits", async ({ bankCourse: data, teacherApi, teacherPage, studentPage }, testInfo) => {
  test.setTimeout(150_000);
  const student = await createAuthenticatedApi("student");
  try {
    const title = `Message context ${data.token}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title, lifecycle: "published", settings: { randomizeItems: true, navigationMode: "free", allowResume: true }, contentPlacement: { isVisible: true }
    } }));
    const activityId = created.activity.id;
    for (const title of ["Loops exercise", "Arrays exercise"]) {
      await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
        source: "local", activityTypeKey: "mcq", title, lifecycle: "published", config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 10
      } }));
    }
    await assignCourseTest(data, activityId, title);
    const settingsPath = `/api/courses/${data.courseId}/activities/${activityId}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, messagingEnabled: true, twoWayMessagingEnabled: true, groupAssignments: settings.groups } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const staffMessages = `/api/courses/${data.courseId}/gradebook/activities/${activityId}/messages`;
    await studentPage.goto(assigned.replace("/api", ""));
    await studentPage.getByRole("button", { name: "Start Test", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Start this Test now?", exact: true }).getByRole("button", { name: "Start Test", exact: true }).click();
    await expect(studentPage.locator(".test-activity-step")).toHaveCount(2);
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await student.get(`${assigned}/test`));
    const first = runtime.test.items[0], second = runtime.test.items[1];
    const attempt = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: runtime.attempt!.id }, include: { participant: true } });
    const studentName = `${attempt.participant.firstName} ${attempt.participant.lastName}`;
    const envelope = studentPage.getByRole("button", { name: /Open activity messages/ });
    const learnerDialog = studentPage.getByRole("dialog", { name: "Activity messages", exact: true });
    const teacherDialog = teacherPage.getByRole("dialog", { name: "Activity messages", exact: true });
    const send = async (body: string) => {
      await learnerDialog.getByLabel("Message", { exact: true }).fill(body);
      const pending = studentPage.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === `${assigned}/messages`);
      await learnerDialog.getByRole("button", { name: "Send message", exact: true }).click();
      const input = (await pending).postDataJSON();
      await expect(learnerDialog.getByRole("article").filter({ hasText: body })).toBeVisible();
      return input;
    };

    // Navigate without answering: context must follow the visible exercise, not a saved response.
    await studentPage.locator('.test-activity-step').nth(1).click();
    await expect(studentPage.getByRole("heading", { name: second.activity.title, exact: true })).toBeVisible();
    await expect(envelope).toBeVisible({ timeout: 30_000 });
    await envelope.click();
    expect((await send("I need help here.")).testItem).toEqual({ parentAttemptId: attempt.id, testItemId: second.id });
    await teacherPage.goto(`/courses/${data.courseId}/gradebook/activities/${activityId}`);
    await teacherPage.getByRole("button", { name: "Message students", exact: true }).click();
    await teacherDialog.getByRole("tab").filter({ hasText: studentName }).click();
    await expect(teacherDialog.getByRole("article").filter({ hasText: "I need help here." }).getByText(`Exercise 2: ${second.activity.title}`, { exact: true })).toBeVisible();

    await learnerDialog.getByRole("button", { name: "Close", exact: true }).click();
    await studentPage.locator('.test-activity-step').first().click();
    await expect(studentPage.getByRole("heading", { name: first.activity.title, exact: true })).toBeVisible();
    await envelope.click();
    expect((await send("What should I do now?")).testItem).toEqual({ parentAttemptId: attempt.id, testItemId: first.id });
    await expect(teacherDialog.getByRole("article").filter({ hasText: "What should I do now?" }).getByText(`Exercise 1: ${first.activity.title}`, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(teacherDialog.getByRole("article").filter({ hasText: "I need help here." }).getByText(`Exercise 2: ${second.activity.title}`, { exact: true })).toBeVisible();

    await learnerDialog.getByRole("button", { name: "Close", exact: true }).click();
    await studentPage.locator('.test-activity-step').nth(1).click();
    await studentPage.getByRole("button", { name: "Submit the test", exact: true }).click();
    await expect(studentPage.getByRole("region", { name: "Review your answers", exact: true })).toBeVisible();
    await envelope.click();
    expect((await send("Question about finishing the Test.")).testItem).toBeUndefined();
    const general = learnerDialog.getByRole("article").filter({ hasText: "Question about finishing the Test." });
    await expect(general.locator('.activity-chat-exercise')).toHaveCount(0);

    const messageCount = await prisma.activityConversationMessage.count({ where: { conversation: { activityId }, senderKind: "student" } });
    expect((await student.post(`${assigned}/messages`, { data: { body: "Invalid child", testItem: { parentAttemptId: attempt.id, testItemId: "another-test-item" } } })).status()).toBe(409);
    expect((await student.post(`${assigned}/messages`, { data: { body: "Invalid attempt", testItem: { parentAttemptId: "another-attempt", testItemId: first.id } } })).status()).toBe(409);
    expect((await student.post(`${assigned}/messages`, { data: { body: "Forged title", testItem: { parentAttemptId: attempt.id, testItemId: first.id, title: "Fake title" } } })).status()).toBe(400);
    expect(await prisma.activityConversationMessage.count({ where: { conversation: { activityId }, senderKind: "student" } })).toBe(messageCount);

    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/activities/${second.activityId}`, { data: { title: "Renamed after the message", confirmActiveStudents: true } }));
    await responseJson(await teacherApi.delete(`/api/courses/${data.courseId}/activities/${activityId}/test/items/${second.id}`, { data: { confirmActiveStudents: true } }));
    const { conversation } = await responseJson<{ conversation: StaffActivityConversation }>(await teacherApi.get(`${staffMessages}/conversations/${attempt.participantId}?attemptId=${attempt.id}`));
    expect(conversation.messages.find((message) => message.body === "I need help here.")?.testItemContext).toEqual({ testItemId: second.id, activityId: second.activityId, title: second.activity.title, exerciseNumber: 2 });
    await teacherPage.reload();
    await teacherPage.getByRole("button", { name: "Message students", exact: true }).click();
    await teacherDialog.getByRole("tab").filter({ hasText: studentName }).click();
    await expect(teacherDialog.getByText(`Exercise 2: ${second.activity.title}`, { exact: true })).toBeVisible();
    await teacherPage.screenshot({ path: testInfo.outputPath("message-exercise-context.png") });

    // Moving to an ordinary activity clears the Test selection and adds no context to its messages.
    const standaloneSettingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings: standaloneSettings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(standaloneSettingsPath));
    await responseJson(await teacherApi.post(standaloneSettingsPath, { data: { ...standaloneSettings.general, assessmentMode: "summative", messagingEnabled: true, twoWayMessagingEnabled: true, groupAssignments: standaloneSettings.groups } }));
    const standalone = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
    await studentPage.goto(standalone.replace("/api", ""));
    await envelope.click();
    await learnerDialog.getByLabel("Message", { exact: true }).fill("Standalone question.");
    await learnerDialog.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(learnerDialog.getByRole("article").filter({ hasText: "Standalone question." })).toBeVisible();
    const standaloneHistory = await responseJson<{ conversation: LearnerActivityConversation }>(await student.get(`${standalone}/messages`));
    expect(standaloneHistory.conversation.messages.find((message) => message.body === "Standalone question.")?.testItemContext).toBeNull();
  } finally { await student.dispose(); }
});
