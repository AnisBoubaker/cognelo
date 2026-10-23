import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";
import type { ActivityBroadcast, ActivityMessageDeletion, CourseActivityAssignmentSettings, LearnerActivityConversation, StaffActivityConversation } from "../../apps/web/src/lib/api";

test("teachers strike their own broadcasts and private replies while preserving text for students", async ({ bankCourse: data, teacherApi, teacherPage, studentPage }, testInfo) => {
  test.setTimeout(180_000);
  const student = await createAuthenticatedApi("student"), otherTeacher = await createAuthenticatedApi("admin");
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
  const messages = `/api/courses/${data.courseId}/gradebook/activities/${data.activityId}/messages`;
  try {
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: `message-delete-${data.token}@cognelo.local`, firstName: "Offline", lastName: "Student", role: "student" } }));
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", messagingEnabled: true, twoWayMessagingEnabled: true, groupAssignments: settings.groups } }));
    const { broadcast } = await responseJson<{ broadcast: ActivityBroadcast }>(await teacherApi.post(messages, { data: { body: "Earlier broadcast to withdraw." } }));
    await responseJson(await teacherApi.post(messages, { data: { body: "The latest broadcast stays." } }));
    await studentPage.goto(assigned.replace("/api", ""));
    await studentPage.getByRole("button", { name: /Open activity messages/ }).click();
    const learnerDialog = studentPage.getByRole("dialog", { name: "Activity messages", exact: true });
    await expect(learnerDialog.getByText("Earlier broadcast to withdraw.", { exact: true })).toBeVisible();
    expect(await learnerDialog.getByRole("button", { name: /^Delete/ }).count()).toBe(0);
    await teacherPage.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}`);
    await teacherPage.getByRole("button", { name: "Message students", exact: true }).click();
    const teacherDialog = teacherPage.getByRole("dialog", { name: "Activity messages", exact: true });
    const broadcastBubble = teacherDialog.getByRole("article").filter({ hasText: "Earlier broadcast to withdraw." });
    await broadcastBubble.getByRole("button", { name: "Delete broadcast for all recipients", exact: true }).click();
    await expect(broadcastBubble.locator("del")).toHaveText("Earlier broadcast to withdraw.");
    await expect(learnerDialog.locator("del")).toHaveText("Earlier broadcast to withdraw.", { timeout: 30_000 });
    await expect(learnerDialog.getByRole("article").filter({ hasText: "The latest broadcast stays." }).locator("del")).toHaveCount(0);
    const savedBroadcast = await prisma.activityMessageBroadcast.findUniqueOrThrow({ where: { id: broadcast.id }, include: { messages: true } });
    expect(savedBroadcast.body).toBe(broadcast.body);
    expect(savedBroadcast.deletedAt).not.toBeNull();
    expect(savedBroadcast.messages).toHaveLength(2);
    expect(savedBroadcast.messages.every((message) => message.body === broadcast.body && message.deletedAt?.getTime() === savedBroadcast.deletedAt?.getTime())).toBe(true);
    const repeated = await responseJson<ActivityMessageDeletion>(await teacherApi.delete(messages, { data: { broadcastId: broadcast.id } }));
    expect(repeated.deletedAt).toBe(savedBroadcast.deletedAt!.toISOString());
    expect((await otherTeacher.delete(messages, { data: { broadcastId: broadcast.id } })).status()).toBe(403);
    expect((await student.delete(messages, { data: { broadcastId: broadcast.id } })).status()).toBe(403);

    await learnerDialog.getByLabel("Message", { exact: true }).fill("Can you clarify this question?");
    await learnerDialog.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(learnerDialog.getByRole("article").filter({ hasText: "Can you clarify this question?" })).toBeVisible();
    const { conversation } = await responseJson<{ conversation: LearnerActivityConversation }>(await student.get(`${assigned}/messages`));
    const identity = await prisma.activityConversation.findUniqueOrThrow({ where: { id: conversation.id }, include: { participant: true } });
    const participantName = `${identity.participant.firstName} ${identity.participant.lastName}`;
    const studentTab = teacherDialog.getByRole("tab", { name: new RegExp(participantName) });
    await expect(studentTab).toBeVisible({ timeout: 20_000 });
    await studentTab.click();
    await expect(teacherDialog.getByText("Can you clarify this question?", { exact: true })).toBeVisible();
    const question = conversation.messages.find((message) => message.body === "Can you clarify this question?")!;
    expect((await teacherApi.delete(messages, { data: { messageId: question.id } })).status()).toBe(403);
    await expect(teacherDialog.getByRole("article").filter({ hasText: question.body }).getByRole("button", { name: "Delete message", exact: true })).toHaveCount(0);
    for (const body of ["Earlier reply to withdraw.", "The latest reply stays."]) {
      await teacherDialog.getByLabel("Message", { exact: true }).fill(body);
      await teacherDialog.getByRole("button", { name: "Send message", exact: true }).click();
      await expect(teacherDialog.getByText(body, { exact: true })).toBeVisible();
    }
    await expect(learnerDialog.getByText("The latest reply stays.", { exact: true })).toBeVisible({ timeout: 30_000 });
    const privateBubble = teacherDialog.getByRole("article").filter({ hasText: "Earlier reply to withdraw." });
    await privateBubble.getByRole("button", { name: "Delete message", exact: true }).click();
    await expect(privateBubble.locator("del")).toHaveText("Earlier reply to withdraw.");
    await expect(learnerDialog.locator("del").filter({ hasText: "Earlier reply to withdraw." })).toBeVisible({ timeout: 30_000 });
    const reply = await prisma.activityConversationMessage.findFirstOrThrow({ where: { conversationId: conversation.id, body: "Earlier reply to withdraw." } });
    expect(reply.deletedAt).not.toBeNull();
    expect(reply.body).toBe("Earlier reply to withdraw.");
    expect((await otherTeacher.delete(messages, { data: { messageId: reply.id } })).status()).toBe(403);
    expect((await student.delete(messages, { data: { messageId: reply.id } })).status()).toBe(403);
    await teacherPage.screenshot({ path: testInfo.outputPath("deleted-chat-messages.png") });
    await studentPage.reload();
    await studentPage.getByRole("button", { name: /Open activity messages/ }).click();
    await expect(learnerDialog.locator("del")).toHaveCount(2);
    await expect(learnerDialog.getByText("The latest reply stays.", { exact: true })).toBeVisible();
  } finally { await student.dispose(); await otherTeacher.dispose(); }
});

test("deleting an older history page changes the existing heartbeat and sends retained deletion markers", async ({ bankCourse: data, teacherApi }) => {
  const student = await createAuthenticatedApi("student");
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
  const messages = `/api/courses/${data.courseId}/gradebook/activities/${data.activityId}/messages`;
  try {
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", messagingEnabled: true, groupAssignments: settings.groups } }));
    const { conversation } = await responseJson<{ conversation: LearnerActivityConversation }>(await student.get(`${assigned}/messages`));
    const identity = await prisma.activityConversation.findUniqueOrThrow({ where: { id: conversation.id } });
    const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher@cognelo.local" } });
    const start = Date.now() - 200_000;
    await prisma.activityConversationMessage.createMany({ data: Array.from({ length: 105 }, (_, index) => ({ conversationId: conversation.id,
      senderUserId: teacher.id, senderKind: "staff" as const, senderName: "Teacher", body: `Older history ${index}`, createdAt: new Date(start + index * 1000) })) });
    const oldest = await prisma.activityConversationMessage.findFirstOrThrow({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
    // Read a revision without fetching any message bodies.
    const before = await responseJson<{ messaging: { version: string } }>(await student.get(`${assigned}/content-access?messaging=presence`));
    const deletion = await responseJson<ActivityMessageDeletion>(await teacherApi.delete(messages, { data: { messageId: oldest.id } }));
    const after = await responseJson<{ messaging: { version: string } }>(await student.get(`${assigned}/content-access?messaging=presence`));
    expect(after.messaging.version).not.toBe(before.messaging.version);
    expect(after.messaging).not.toHaveProperty("messages");
    const page = await responseJson<{ conversation: LearnerActivityConversation }>(await student.get(`${assigned}/messages`));
    expect(page.conversation.messages).toHaveLength(100);
    expect(page.conversation.messages.some((message) => message.id === oldest.id)).toBe(false);
    expect(page.conversation.deletedMessages).toContainEqual({ id: oldest.id, deletedAt: deletion.deletedAt });
    const earlier = await responseJson<{ conversation: LearnerActivityConversation }>(await student.get(`${assigned}/messages?before=${page.conversation.messages[0].id}`));
    expect(earlier.conversation.messages[0]).toMatchObject({ id: oldest.id, body: oldest.body, deletedAt: deletion.deletedAt, canDelete: false });
    const staff = await responseJson<{ conversation: StaffActivityConversation }>(await teacherApi.get(`${messages}/conversations/${identity.participantId}`));
    expect(staff.conversation.deletedMessages).toContainEqual({ id: oldest.id, deletedAt: deletion.deletedAt });
  } finally { await student.dispose(); }
});
