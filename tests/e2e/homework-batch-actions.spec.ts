import { prisma } from "@cognelo/db";
import type { APIRequestContext } from "@playwright/test";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import type { StudentGroupingDto } from "@cognelo/contracts";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";

test.describe.configure({ timeout: 120_000 });

type Workspace = { teamwork?: { contextKey: string }; submission: null | { id: string; status: string; createdAt: string; coreAttemptId: string | null; files: Array<{ path: string; sizeBytes: number }> } };
type Action = { id: string; revision: string; participantIds: string[] };
async function peer(api: APIRequestContext, course: string, groupId: string, token: string) {
  const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } });
  const email = `batch-${token}@example.test`;
  const user = await prisma.user.create({ data: { email, passwordHash: seed.passwordHash, isActive: true, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } });
  const { participant } = await responseJson<{ participant: { id: string } }>(await api.post(`${course}/groups/${groupId}/participants`, { data: { email, role: "student" } }));
  return { id: user.id, participantId: participant.id, api: await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("student").password }) };
}
const input = (action: Action, groupId?: string) => ({ actionId: action.id, revision: action.revision, operationId: crypto.randomUUID(), reason: "Recover with corrected references", ...(groupId ? { groupId } : {}) });

test("class reset recovers failed generation with current references without another file hand-in; cancellation is scoped and confirmed", async ({ bankCourse: data, teacherApi, browser, studentPage }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data, { failFirst: 1000 }), student = await createAuthenticatedApi("student");
  const course = `/api/courses/${data.courseId}`, people: Awaited<ReturnType<typeof peer>>[] = [];
  try {
    const second = await peer(teacherApi, course, data.groupId, `${data.token}-same`); people.push(second);
    const { group } = await responseJson<{ group: { id: string } }>(await teacherApi.post(`${course}/groups`, { data: { title: "Other section" } }));
    await responseJson(await teacherApi.patch(`${course}/groups/${group.id}`, { data: { status: "published", availableFrom: null, availableUntil: null } }));
    const other = await peer(teacherApi, course, group.id, `${data.token}-other`); people.push(other);
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Bulk homework recovery", config: {} });
    const base = `${course}/activities/${id}/coding-homework-grader`, actionsUrl = `${course}/gradebook/activities/${id}/activity-actions`;
    const authored = await responseJson<{ assignment: Record<string, unknown> }>(await model.api.get(`${base}/authoring`));
    await responseJson(await model.api.put(`${base}/authoring`, { data: { assignment: { ...authored.assignment, questionCount: 1 }, requirements: {} } }));
    for (const groupId of [data.groupId, group.id]) await responseJson(await model.api.post(`${course}/groups/${groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await model.api.post(`${base}/prepare-references`, { data: {} }));
    await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    const endpoint = (groupId = data.groupId) => `${course}/groups/${groupId}/activities/assigned/${id}/coding-homework-grader`;
    const state = async (client = student, groupId = data.groupId) => responseJson<Workspace>(await client.get(`${endpoint(groupId)}/workspace`));
    for (const [client, groupId] of [[student, data.groupId], [second.api, data.groupId], [other.api, group.id]] as const) {
      await responseJson(await client.post(`${endpoint(groupId)}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int a){return a+1;}").toString("base64") } }));
      await responseJson(await client.post(`${endpoint(groupId)}/hand-in`, { data: { expectedRevision: 1 } }));
    }
    await expect.poll(async () => (await state()).submission?.status, { timeout: 35_000 }).toBe("failed");
    await expect.poll(async () => (await state(second.api)).submission?.status, { timeout: 35_000 }).toBe("failed");
    const before = [(await state()).submission!, (await state(second.api)).submission!], outsider = (await state(other.api, group.id)).submission!;
    await model.api.put(`${base}/workflow-settings`, { data: { enabled: false } });
    await responseJson(await model.api.post(`${base}/prepare-references`, { data: {} }));
    const current = await responseJson<{ assignment: { settings: { preparedSnapshotId: string } } }>(await model.api.get(`${base}/authoring`));
    await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { enabled: true } })); model.failNext(0);
    const list = async () => responseJson<{ actions: Action[] }>(await model.api.get(`${actionsUrl}?groupId=${data.groupId}`));
    const instructor = await peer(teacherApi, course, data.groupId, `${data.token}-instructor`); people.push(instructor);
    await instructor.api.dispose();
    await prisma.userRole.create({ data: { userId: instructor.id, roleId: (await prisma.role.findUniqueOrThrow({ where: { key: "teacher" } })).id } });
    const instructorEmail = (await prisma.user.findUniqueOrThrow({ where: { id: instructor.id } })).email;
    await responseJson(await teacherApi.delete(`${course}/groups/${data.groupId}/participants/${instructor.participantId}`));
    await responseJson(await teacherApi.post(`${course}/groups/${data.groupId}/participants`, { data: { email: instructorEmail, role: "teacher" } }));
    instructor.api = await createAuthenticatedApiWithCredentials({ email: instructorEmail, password: credentialsFor("student").password });
    expect((await instructor.api.get(`${actionsUrl}?groupId=${group.id}`)).status()).toBe(403);
    const initialActions = await list(), reset = initialActions.actions.find(action => action.id === "reset-question-generation")!;
    expect(reset.participantIds).toHaveLength(2);
    expect((await instructor.api.post(actionsUrl, { data: input(reset, group.id) })).status()).toBe(403);
    expect((await student.post(actionsUrl, { data: input(reset, data.groupId) })).status()).toBe(403);
    expect((await model.api.post(actionsUrl, { data: { ...input(reset, data.groupId), reason: "  " } })).status()).toBe(400);
    expect((await model.api.post(actionsUrl, { data: { ...input(reset, data.groupId), revision: "a".repeat(64) } })).status()).toBe(409);
    const page = await model.page(browser);
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${id}?groupId=${data.groupId}`);
    const label = "Reset question generation for all students";
    await page.getByRole("button", { name: label, exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: label, exact: true });
    await expect(confirmation).toContainText("2 students");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(confirmation.getByRole("button", { name: label, exact: true })).toBeDisabled();
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await state()).submission?.id).toBe(before[0].id);
    await page.getByRole("button", { name: label, exact: true }).click();
    await confirmation.getByLabel("Reason", { exact: true }).fill("Recover with corrected references");
    const response = page.waitForResponse(response => response.url().endsWith("/activity-actions") && response.request().method() === "POST");
    await confirmation.getByRole("button", { name: label, exact: true }).click();
    const saved = await response; expect(saved.ok()).toBe(true);
    const request = saved.request().postDataJSON();
    await expect.poll(async () => (await state()).submission?.status, { timeout: 30_000 }).toBe("challenge_ready");
    await expect.poll(async () => (await state(second.api)).submission?.status, { timeout: 30_000 }).toBe("challenge_ready");
    const after = [(await state()).submission!, (await state(second.api)).submission!];
    for (let index = 0; index < 2; index++) {
      expect(after[index].id).not.toBe(before[index].id); expect(after[index].createdAt).toBe(before[index].createdAt); expect(after[index].files).toEqual(before[index].files);
      const [retained] = await prisma.$queryRaw<Array<{ documentationSnapshotId: string; metadata: Record<string, unknown> }>>`SELECT "documentationSnapshotId",metadata FROM "PluginCodingHomeworkSubmission" WHERE id=${after[index].id}`;
      expect(retained.documentationSnapshotId).toBe(current.assignment.settings.preparedSnapshotId); expect(retained.metadata.resetFrom).toBe(before[index].id);
    }
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    expect((await state(other.api, group.id)).submission?.id).toBe(outsider.id);
    expect((await responseJson<{ affectedCount: number }>(await model.api.post(actionsUrl, { data: request }))).affectedCount).toBe(2);
    expect((await state()).submission?.id).toBe(after[0].id);
    await studentPage.goto(endpoint().replace(/^\/api/, "").replace(/\/coding-homework-grader$/, ""));
    await expect(studentPage.getByRole("button", { name: "Submit my work", exact: true })).toHaveCount(0);
    await expect(studentPage.getByRole("button", { name: "Answer challenge questions", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Cancel all submissions", exact: true }).click();
    const cancel = page.getByRole("dialog", { name: "Cancel all submissions", exact: true });
    await cancel.getByLabel("Reason", { exact: true }).fill("Reopen this section's files");
    await cancel.getByRole("button", { name: "Cancel all submissions", exact: true }).click();
    await expect.poll(async () => (await state()).submission).toBeNull();
    expect((await state(second.api)).submission).toBeNull(); expect((await state(other.api, group.id)).submission?.id).toBe(outsider.id);
    const preparation = await responseJson<{ draft: { files: Array<{ path: string }> } }>(await student.get(`${endpoint()}/preparation`));
    expect(preparation.draft.files[0].path).toBe("main.c");
  } finally { await student.dispose(); for (const person of people) { await person.api.dispose(); await prisma.user.deleteMany({ where: { id: person.id } }); } await model.close(); }
});

for (const separate of [false, true]) test(`team bulk generation reset preserves hand-in and private history (${separate ? "separate" : "common"} questions)`, async ({ bankCourse: data, teacherApi }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student"), course = `/api/courses/${data.courseId}`;
  const second = await peer(teacherApi, course, data.groupId, `${data.token}-team`);
  try {
    const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } });
    const own = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, userId: seed.id } });
    const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacherApi.post(`${course}/groups/${data.groupId}/groupings`, { data: { title: "Bulk teams", teams: [{ title: "Team", participantIds: [own.id, second.participantId] }] } }));
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Team reset", config: {} }), base = `${course}/activities/${id}/coding-homework-grader`;
    const authored = await responseJson<{ assignment: Record<string, unknown> }>(await model.api.get(`${base}/authoring`));
    await responseJson(await model.api.put(`${base}/authoring`, { data: { assignment: { ...authored.assignment, questionCount: 1, settings: { separateTeamQuestions: separate } }, requirements: {} } }));
    await responseJson(await model.api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    const settingsPath = `${course}/activities/${id}/assign-all-groups`, { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await model.api.get(settingsPath));
    await responseJson(await model.api.post(settingsPath, { data: { ...settings.general, teamworkEnabled: true, assessmentMode: "summative", groupAssignments: settings.groups.map(group => ({ ...group, teamGroupingId: grouping.id, allowIndividualSubmission: false })) } }));
    await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { selected: [] } })); await responseJson(await model.api.post(`${base}/prepare-references`, { data: {} })); await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`, actionsUrl = `${course}/gradebook/activities/${id}/activity-actions`;
    const state = async (client = student) => responseJson<Workspace>(await client.get(`${endpoint}/workspace`));
    const workspace = await state();
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, contextKey: workspace.teamwork!.contextKey, base64: Buffer.from("int add(int a){return a+1;}").toString("base64") } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1, contextKey: workspace.teamwork!.contextKey } }));
    const old: Array<{ id: string; createdAt: string; coreAttemptId: string }> = [];
    for (const client of [student, second.api]) {
      await expect.poll(async () => (await state(client)).submission?.status, { timeout: 30_000 }).toBe("challenge_ready");
      const submitted = (await state(client)).submission!;
      const answering = await responseJson<{ submissionId: string; questions: Array<{ id: string }> }>(await client.post(`${endpoint}/answering`, { data: { submissionId: submitted.id } }));
      await responseJson(await client.post(`${endpoint}/challenge-answers`, { data: { submissionId: answering.submissionId, answers: answering.questions.map(question => ({ questionId: question.id, answer: "Original retained answer" })) } }));
      old.push((await state(client)).submission as typeof old[number]);
    }
    const attempt = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: old[0].coreAttemptId } });
    await responseJson(await model.api.patch(`${course}/gradebook/items/${attempt.gradebookItemId}/participants/${attempt.participantId}/override`, { data: { score: 90, maxScore: 100, reason: "Original grade", expectedGradeUpdatedAt: null } }));
    if (!separate) await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { enabled: false } }));
    const reset = (await responseJson<{ actions: Action[] }>(await model.api.get(actionsUrl))).actions.find(action => action.id === "reset-question-generation")!;
    const request = input(reset);
    await responseJson(await model.api.post(actionsUrl, { data: request }));
    if (!separate) {
      const held = await prisma.backgroundJob.findMany({ where: { queue: "coding-homework-grader", status: "queued", payload: { path: ["activityId"], equals: id } } });
      expect(held).toHaveLength(1); expect(held[0].attempts).toBe(0);
      expect((held[0].metadata as { stageActivationHeld: boolean }).stageActivationHeld).toBe(true);
      await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    }
    for (const [index, client] of [student, second.api].entries()) {
      await expect.poll(async () => (await state(client)).submission?.status, { timeout: 30_000 }).toBe("challenge_ready");
      const current = (await state(client)).submission!;
      expect(current.id).not.toBe(old[index].id); expect(current.createdAt).toBe(old[index].createdAt);
      expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: old[index].coreAttemptId } })).lifecycle).toBe("deleted");
      const [history] = await prisma.$queryRaw<Array<{ answer: string }>>`SELECT "studentAnswer" AS answer FROM "PluginCodingHomeworkChallengeQuestion" WHERE "submissionId"=${old[index].id}`;
      expect(history.answer).toBe("Original retained answer");
    }
    expect((await prisma.grade.findFirst({ where: { gradebookItemId: attempt.gradebookItemId, participantId: attempt.participantId } }))?.isActive ?? false).toBe(false);
    const ready = (await state()).submission!.id;
    await responseJson(await model.api.post(actionsUrl, { data: request })); expect((await state()).submission!.id).toBe(ready);
    const cancel = (await responseJson<{ actions: Action[] }>(await model.api.get(actionsUrl))).actions.find(action => action.id === "cancel-all-submissions")!;
    await responseJson(await model.api.post(actionsUrl, { data: input(cancel) }));
    expect((await state()).submission).toBeNull(); expect((await state(second.api)).submission).toBeNull();
  } finally { await student.dispose(); await second.api.dispose(); await prisma.user.deleteMany({ where: { id: second.id } }); await model.close(); }
});
