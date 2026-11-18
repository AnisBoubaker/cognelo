import { openActivityReportActions } from "./fixtures/gradebook-ui";
import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { parseMcqSource } from "../../packages/plugin-activities/plugin-mcq/src/mcq";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import type { ActivityLogPage, ActivityStudentActionList } from "@cognelo/contracts";

test("shared logs show lifecycle and grading events, page tied timestamps, and preserve the Logs tab after editing", async ({ bankCourse: data, teacherApi: api, teacherPage: teacher }, info) => {
  const student = await createAuthenticatedApi("student");
  try {
    const question = parseMcqSource(ORIGINAL_SOURCE, "none").questions[0];
    const answers = { [question.id]: [question.choices.find(choice => choice.isCorrect)!.id] };
    await responseJson(await student.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}/mcq/submission`, { data: { answers } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: data.activityId } });
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("teacher").email } });
    const at = new Date(Date.now() + 1000);
    await prisma.gradeEvent.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ gradebookItemId: attempt.gradebookItemId, participantId: attempt.participantId, attemptId: attempt.id, actorUserId: actor.id,
      eventType: "regraded" as const, reason: `Logged event ${i + 1}`, createdAt: at, previousValue: { privateAnswer: "PRIVATE-SNAPSHOT" }, metadata: { privateProvider: "PRIVATE-PROVIDER" } })) });
    const endpoint = `/api/courses/${data.courseId}/gradebook/activities/${data.activityId}/logs`;
    expect((await student.get(endpoint)).status()).toBe(403);
    expect((await api.get(`${endpoint}?cursor=invalid`)).status()).toBe(400);
    const first = await responseJson<ActivityLogPage>(await api.get(endpoint));
    expect(first.entries).toHaveLength(50); expect(first.nextCursor).not.toBeNull();
    expect(JSON.stringify(first)).not.toContain("PRIVATE-");
    const second = await responseJson<ActivityLogPage>(await api.get(`${endpoint}?cursor=${encodeURIComponent(JSON.stringify(first.nextCursor))}`));
    expect(second.entries.length).toBeGreaterThan(5);
    expect(new Set([...first.entries, ...second.entries].map(entry => entry.id)).size).toBe(first.entries.length + second.entries.length);
    await teacher.goto(`/courses/${data.courseId}?tab=content`);
    await teacher.getByRole("tabpanel", { name: "Content", exact: true }).getByRole("link", { name: data.title, exact: true }).click();
    await teacher.getByRole("tab", { name: "Logs", exact: true }).click();
    await expect(teacher.locator(".activity-log-entry")).toHaveCount(50);
    await teacher.getByRole("button", { name: "Load older events", exact: true }).click();
    await expect(teacher.locator(".activity-log-entry").filter({ hasText: "Submission completed" })).toHaveCount(1);
    await openActivityReportActions(teacher);
    await teacher.getByRole("menuitem", { name: "Edit activity", exact: true }).click();
    await expect(teacher).toHaveURL(/report=logs/);
    await teacher.getByRole("link", { name: "Back to logs", exact: true }).click();
    await expect(teacher.getByRole("tab", { name: "Logs", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(teacher.locator(".activity-log-entry").first()).toBeVisible();
    await expect(teacher.getByRole("heading", { name: data.title, exact: true })).toBeVisible();
    await teacher.screenshot({ path: info.outputPath("activity-logs-desktop.png"), fullPage: false });
    await teacher.setViewportSize({ width: 390, height: 844 });
    await teacher.locator(".activity-log-entry").first().scrollIntoViewIfNeeded();
    expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await teacher.screenshot({ path: info.outputPath("activity-logs-mobile.png") });
    await responseJson(await api.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/reopen`, { data: {} }));
    const afterReopen: ActivityLogPage["entries"] = [];
    let cursor: ActivityLogPage["nextCursor"] = null;
    do {
      const next = await responseJson<ActivityLogPage>(await api.get(`${endpoint}${cursor ? `?cursor=${encodeURIComponent(JSON.stringify(cursor))}` : ""}`));
      afterReopen.push(...next.entries); cursor = next.nextCursor;
    } while (cursor);
    expect(afterReopen.filter(entry => entry.type === "submitted")).toHaveLength(1);
    expect(afterReopen.some(entry => entry.type === "submission_reopened")).toBe(true);
  } finally { await student.dispose(); }
});

test("section staff logs and actions exclude other sections", async ({ bankCourse: data, teacherApi: api }) => {
  const student = await createAuthenticatedApi("student");
  const source = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("teacher").email } });
  const email = `activity-logs-staff-${data.token}@example.test`;
  const staff = await prisma.user.create({ data: { email, passwordHash: source.passwordHash, isActive: true, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "teacher" } } } } } });
  const sectionStaff = await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("teacher").password });
  try {
    const course = `/api/courses/${data.courseId}`;
    await responseJson(await api.post(`${course}/groups/${data.groupId}/participants`, { data: { email, role: "ta" } }));
    const { group } = await responseJson<{ group: { id: string } }>(await api.post(`${course}/groups`, { data: { title: "Other section" } }));
    await responseJson(await api.patch(`${course}/groups/${group.id}`, { data: { status: "published", availableFrom: null, availableUntil: null } }));
    await responseJson(await api.post(`${course}/groups/${group.id}/participants`, { data: { email: credentialsFor("student").email, role: "student" } }));
    await responseJson(await api.post(`${course}/groups/${group.id}/activities`, { data: { activityId: data.activityId, metadata: { assessmentMode: "summative" } } }));
    const question = parseMcqSource(ORIGINAL_SOURCE, "none").questions[0];
    await responseJson(await student.post(`${course}/groups/${group.id}/activities/assigned/${data.activityId}/mcq/submission`, { data: { answers: { [question.id]: [question.choices[0].id] } } }));
    const base = `${course}/gradebook/activities/${data.activityId}`;
    expect((await responseJson<ActivityLogPage>(await api.get(`${base}/logs`))).entries.length).toBeGreaterThan(0);
    expect((await responseJson<ActivityLogPage>(await sectionStaff.get(`${base}/logs`))).entries).toEqual([]);
    expect((await sectionStaff.get(`${base}/logs?groupId=${group.id}`)).status()).toBe(403);
    expect((await sectionStaff.get(`${base}/student-actions?groupId=${group.id}`)).status()).toBe(403);
    const foreign = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: group.id, role: "student" } });
    expect((await sectionStaff.post(`${base}/student-actions`, { data: { actionId: "cancel-submission", targetId: "foreign", groupId: group.id, participantId: foreign.id, reason: "Forbidden" } })).status()).toBe(403);
  } finally { await student.dispose(); await sectionStaff.dispose(); await prisma.user.delete({ where: { id: staff.id } }); }
});

test("homework row menus reset and cancel pre-attempt hand-ins, retain logs, and reject stale action targets", async ({ bankCourse: data, teacherApi: api, teacherPage: teacher }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Homework actions and logs", config: {} });
    const course = `/api/courses/${data.courseId}`, base = `${course}/activities/${id}`, plugin = `${base}/coding-homework-grader`;
    const authored = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${plugin}/authoring`));
    await responseJson(await api.put(`${plugin}/authoring`, { data: { assignment: authored.assignment, requirements: { requiredFiles: [{ path: "main.c" }] } } }));
    await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(`${base}/assign-all-groups`))).settings;
    await responseJson(await api.post(`${base}/assign-all-groups`, { data: { ...settings.general, assessmentMode: "summative", submissionStages: { files: { enabled: true }, questions: { enabled: false } }, groupAssignments: settings.groups } }));
    const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", fileName: "main.c", expectedRevision: 0, base64: Buffer.from("int main(void) { return 0; }\n").toString("base64") } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    const actionsPath = `${course}/gradebook/activities/${id}/student-actions`;
    const original = (await responseJson<ActivityStudentActionList>(await api.get(actionsPath))).actions[0];
    await prisma.backgroundJob.create({ data: { id: `log-failure-${original.targetId}`, queue: "coding-homework-grader", handlerKey: "coding-homework-grader.process-submission", idempotencyKey: `submission:${original.targetId}`, status: "failed", failedAt: new Date(), payload: { activityId: id }, error: { message: "PRIVATE-PROVIDER-ERROR" } } });
    await teacher.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    await expect(teacher.getByRole("heading", { name: "Student submissions", exact: true })).toHaveCount(0);
    const actions = teacher.getByRole("button", { name: /^Actions for / });
    await actions.click();
    await teacher.getByRole("menuitem", { name: "Reset this student's challenges", exact: true }).click();
    const reset = teacher.getByRole("dialog", { name: "Reset this student's challenges", exact: true });
    await reset.getByRole("textbox").fill("Give another opportunity to answer.");
    await reset.getByRole("button", { name: "Reset this student's challenges", exact: true }).click();
    await expect(reset).toBeHidden(); await expect(teacher.getByRole("dialog")).toHaveCount(0);
    expect((await api.post(actionsPath, { data: { actionId: original.id, targetId: original.targetId, participantId: original.participantId, groupId: original.groupId, reason: "Stale menu" } })).status()).toBe(409);
    await actions.click(); await teacher.getByRole("menuitem", { name: "Cancel submission", exact: true }).click();
    const cancel = teacher.getByRole("dialog", { name: "Cancel submission", exact: true });
    await cancel.getByRole("textbox").fill("Upload corrected files.");
    await cancel.getByRole("button", { name: "Cancel submission", exact: true }).click();
    await expect(cancel).toBeHidden(); await expect(teacher.getByRole("dialog")).toHaveCount(0);
    await teacher.getByRole("tab", { name: "Logs", exact: true }).click();
    const logs = teacher.locator(".activity-log-entry");
    await expect(logs.filter({ hasText: "Files submitted" })).toHaveCount(1);
    await expect(logs.filter({ hasText: "Challenge questions reset by teacher" })).toContainText("Give another opportunity to answer.");
    await expect(logs.filter({ hasText: "Submission cancelled" })).toContainText("Upload corrected files.");
    await expect(logs.filter({ hasText: "Question generation failed" })).toHaveCount(1);
    await expect(teacher.locator(".activity-logs")).not.toContainText("PRIVATE-PROVIDER-ERROR");
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
  } finally { await student.dispose(); }
});
