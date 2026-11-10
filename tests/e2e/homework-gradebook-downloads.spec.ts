import { readFile } from "node:fs/promises";
import { unzipSync, zipSync, strToU8 } from "fflate";
import { prisma } from "@cognelo/db";
import type { StudentGroupingDto } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor } from "./fixtures/auth";

const singleAction = "download-submitted-work", allAction = "download-all-submitted-work";
const code = "int main(void) { return 0; }\r\n", note = "Café\r\n二\r\n";
const archive = () => Buffer.from(zipSync({ "src/main.c": strToU8(code), "notes/données.txt": strToU8(note), "empty/": new Uint8Array() }));

async function openFiles(api: import("@playwright/test").APIRequestContext, courseId: string, id: string, team?: { groupId: string; groupingId: string }) {
  const author = `/api/courses/${courseId}/activities/${id}/coding-homework-grader/authoring`;
  const current = await responseJson<{ assignment: Record<string, unknown>; requirements?: { requirements: Record<string, unknown> } }>(await api.get(author));
  await responseJson(await api.put(author, { data: { assignment: current.assignment, requirements: { ...current.requirements?.requirements, allowedExtensions: [".c", ".h", ".txt"] } } }));
  const path = `/api/courses/${courseId}/activities/${id}/assign-all-groups`;
  const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(path))).settings;
  await responseJson(await api.post(path, { data: { ...settings.general, assessmentMode: "summative", ...(team ? { teamworkEnabled: true } : {}),
    submissionStages: { files: { enabled: true }, questions: { enabled: false } }, groupAssignments: settings.groups.map(group => ({ ...group, assigned: true,
      ...(team && group.groupId === team.groupId ? { teamGroupingId: team.groupingId, allowIndividualSubmission: false } : {}) })) } }));
}
async function handIn(api: import("@playwright/test").APIRequestContext, endpoint: string) {
  const state = await responseJson<{ teamwork?: { contextKey: string } }>(await api.get(`${endpoint}/workspace`));
  const context = state.teamwork ? { contextKey: state.teamwork.contextKey } : {};
  await responseJson(await api.post(`${endpoint}/preparation`, { data: { ...context, kind: "zip", fileName: "work.zip", expectedRevision: 0, base64: archive().toString("base64") } }));
  return responseJson<{ submission: { id: string } }>(await api.post(`${endpoint}/hand-in`, { data: { ...context, expectedRevision: 1 } }));
}

test("activity-contributed gradebook downloads work before challenges, preserve files, scope batches and cancel safely", async ({ bankCourse: data, teacherApi: api, teacherPage: page }) => {
  test.setTimeout(120_000);
  const learner = await createAuthenticatedApi("student"), users: string[] = [];
  let ta: import("@playwright/test").APIRequestContext | undefined;
  try {
    const course = `/api/courses/${data.courseId}`;
    const { group: second } = await responseJson<{ group: { id: string } }>(await api.post(`${course}/groups`, { data: { title: "ZZ Second section" } }));
    await responseJson(await api.patch(`${course}/groups/${second.id}`, { data: { status: "published" } }));
    await responseJson(await api.post(`${course}/groups/${second.id}/participants`, { data: { email: credentialsFor("student").email, role: "student" } }));
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Download frozen homework", config: {} });
    const author = `${course}/activities/${id}/coding-homework-grader`, actions = `${course}/gradebook/activities/${id}/plugin-actions`;
    await responseJson(await api.put(`${author}/teacher-solution`, { data: { fileName: "private-solution.c", base64: Buffer.from("int private_solution(void) { return 42; }").toString("base64") } }));
    await responseJson(await api.post(`${author}/provided-files`, { data: { fileName: "provided-only.h", mimeType: "text/plain", base64: Buffer.from("// provided only").toString("base64") } }));
    const authored = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${author}/authoring`));
    await responseJson(await api.put(`${author}/authoring`, { data: { assignment: authored.assignment, requirements: { requiredFiles: [{ path: "src/main.c" }] } } }));
    await openFiles(api, data.courseId, id);
    const first = await handIn(learner, `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`);
    await handIn(learner, `${course}/groups/${second.id}/activities/assigned/${id}/coding-homework-grader`);
    const participants = await prisma.courseGroupParticipant.findMany({ where: { groupId: { in: [data.groupId, second.id] }, email: credentialsFor("student").email } });
    const p1 = participants.find(person => person.groupId === data.groupId)!, p2 = participants.find(person => person.groupId === second.id)!;
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    const availability = await responseJson<{ actions: Array<{ id: string; participantIds: string[] }> }>(await api.get(actions));
    expect(availability.actions.find(action => action.id === singleAction)?.participantIds.sort()).toEqual([p1.id, p2.id].sort());
    expect((await learner.get(actions)).status()).toBe(403);
    expect((await learner.post(actions, { data: { actionId: allAction } })).status()).toBe(403);
    expect(await responseJson(await api.get(`${course}/gradebook/activities/${data.activityId}/plugin-actions`))).toEqual({ actions: [] });
    expect((await api.post(actions, { data: { actionId: "unknown" } })).status()).toBe(404);
    expect((await api.post(actions, { data: { actionId: singleAction, participantId: p1.id, path: "private-solution.c" } })).status()).toBe(400);

    await page.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    await expect(page.getByRole("button", { name: "Download all submitted files (ZIP)", exact: true })).toBeEnabled();
    const row = page.locator(".table-row-gradebook-detail").filter({ hasText: data.groupTitle }).filter({ has: page.getByRole("button", { name: /^Actions for / }) });
    await row.getByRole("button", { name: /^Actions for / }).click();
    const saving = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Download submitted files (ZIP)", exact: true }).click();
    const single = unzipSync(await readFile((await (await saving).path())!));
    expect(Buffer.from(single["src/main.c"]).toString()).toBe(code); expect(Buffer.from(single["notes/données.txt"]).toString()).toBe(note); expect(single["empty/"]).toBeDefined();
    expect(Object.keys(single).some(path => /private-solution|provided-only/.test(path))).toBe(false);
    const batchDownload = page.waitForEvent("download"); await page.getByRole("button", { name: "Download all submitted files (ZIP)", exact: true }).click();
    const batch = unzipSync(await readFile((await (await batchDownload).path())!));
    expect(Object.keys(batch).filter(path => path.endsWith("src/main.c"))).toHaveLength(2);
    expect(Object.keys(batch).filter(path => path.endsWith("empty/"))).toHaveLength(2);
    expect(Object.keys(batch).some(path => /private-solution|provided-only/.test(path))).toBe(false);
    const scoped = await api.post(actions, { data: { actionId: allAction, groupId: data.groupId } }); expect(scoped.ok()).toBe(true);
    expect(Object.keys(unzipSync(await scoped.body())).filter(path => path.endsWith("src/main.c"))).toHaveLength(1);

    const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } }), email = `download-ta-${data.token}@example.test`;
    const staff = await prisma.user.create({ data: { email, passwordHash: seed.passwordHash, firstName: "Scoped", lastName: "TA", isActive: true, mustChangePassword: false, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } }); users.push(staff.id);
    await responseJson(await api.post(`${course}/groups/${data.groupId}/participants`, { data: { email, role: "ta" } }));
    ta = await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("student").password });
    const taBatch = await ta.post(actions, { data: { actionId: allAction } }); expect(taBatch.ok()).toBe(true);
    expect(Object.keys(unzipSync(await taBatch.body())).filter(path => path.endsWith("src/main.c"))).toHaveLength(1);
    expect((await ta.get(`${actions}?groupId=${second.id}`)).status()).toBe(403);
    expect((await ta.post(actions, { data: { actionId: singleAction, participantId: p2.id } })).status()).toBe(403);

    let release!: () => void, finished!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }), handled = new Promise<void>(resolve => { finished = resolve; });
    await page.route("**/plugin-actions", async route => {
      if (route.request().method() !== "POST") return route.continue();
      await gate; await route.fulfill({ status: 200, contentType: "application/zip", body: Buffer.from(zipSync({ "late.txt": strToU8("late response") })) }).catch(() => {}); finished();
    });
    const downloads: string[] = []; page.on("download", file => downloads.push(file.suggestedFilename()));
    await page.getByRole("button", { name: "Download all submitted files (ZIP)", exact: true }).click();
    const progress = page.getByRole("dialog", { name: "Preparing download…", exact: true }); await expect(progress).toBeVisible(); await progress.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(progress).toBeHidden(); release(); await handled; expect(downloads).toEqual([]); await page.unroute("**/plugin-actions");
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    expect(await prisma.grade.count({ where: { gradebookItem: { activityId: id } } })).toBe(0);
    await responseJson(await api.delete(`${author}/manage-submissions`, { data: { submissionId: first.submission.id, reason: "Reopen draft" } }));
    expect((await api.post(actions, { data: { actionId: singleAction, participantId: p1.id } })).status()).toBe(409);
    expect((await responseJson<typeof availability>(await api.get(actions))).actions[0].participantIds).toEqual([p2.id]);
  } finally { await ta?.dispose(); await learner.dispose(); await prisma.user.deleteMany({ where: { id: { in: users } } }); }
});

test("team downloads keep one folder per current member and stop offering moved members' old work", async ({ bankCourse: data, teacherApi: api }) => {
  const student = await createAuthenticatedApi("student"); let peer: import("@playwright/test").APIRequestContext | undefined, userId: string | undefined;
  try {
    const course = `/api/courses/${data.courseId}`, groupingPath = `${course}/groups/${data.groupId}/groupings`;
    const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } });
    const owner = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, userId: seed.id } });
    const email = `download-member-${data.token}@example.test`, user = await prisma.user.create({ data: { email, firstName: "Peer", lastName: "Student", passwordHash: seed.passwordHash, isActive: true, mustChangePassword: false, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } }); userId = user.id;
    const { participant } = await responseJson<{ participant: { id: string } }>(await api.post(`${course}/groups/${data.groupId}/participants`, { data: { email, role: "student" } }));
    peer = await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("student").password });
    const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(groupingPath, { data: { title: "Download teams", teams: [{ title: "Blue", participantIds: [owner.id, participant.id] }, { title: "Green", participantIds: [] }] } }));
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Team download", config: {} });
    await openFiles(api, data.courseId, id, { groupId: data.groupId, groupingId: grouping.id });
    await handIn(student, `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`);
    const actions = `${course}/gradebook/activities/${id}/plugin-actions`;
    const zip = await api.post(actions, { data: { actionId: allAction } }); expect(zip.ok()).toBe(true);
    expect(Object.keys(unzipSync(await zip.body())).filter(path => path.endsWith("src/main.c"))).toHaveLength(2);
    const single = await api.post(actions, { data: { actionId: singleAction, participantId: participant.id } }); expect(single.ok()).toBe(true);
    expect(Buffer.from(unzipSync(await single.body())["src/main.c"]).toString()).toBe(code);
    await responseJson(await api.patch(`${groupingPath}/${grouping.id}`, { data: { ...grouping, teams: grouping.teams.map(team => ({ ...team, participantIds: team.title === "Blue" ? [owner.id] : [participant.id] })) } }));
    expect((await api.post(actions, { data: { actionId: singleAction, participantId: participant.id } })).status()).toBe(409);
    const current = await api.post(actions, { data: { actionId: allAction } }); expect(current.ok()).toBe(true);
    expect(Object.keys(unzipSync(await current.body())).filter(path => path.endsWith("src/main.c"))).toHaveLength(1);
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
  } finally { await student.dispose(); await peer?.dispose(); if (userId) await prisma.user.delete({ where: { id: userId } }); }
});

test("completed ungraded file-only hand-ins remain downloadable until the core submission is deleted", async ({ bankCourse: data, teacherApi: api }) => {
  const learner = await createAuthenticatedApi("student");
  try {
    const course = `/api/courses/${data.courseId}`, id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Completed file download", config: {} });
    const author = `${course}/activities/${id}/coding-homework-grader`, current = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${author}/authoring`));
    await responseJson(await api.put(`${author}/authoring`, { data: { assignment: { ...current.assignment, settings: { questionGenerationEnabled: false } }, requirements: {} } }));
    await openFiles(api, data.courseId, id);
    await handIn(learner, `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: id } }), actions = `${course}/gradebook/activities/${id}/plugin-actions`;
    expect(attempt.lifecycle).toBe("submitted");
    const file = await api.post(actions, { data: { actionId: singleAction, participantId: attempt.participantId } }); expect(file.ok()).toBe(true);
    expect(Buffer.from(unzipSync(await file.body())["src/main.c"]).toString()).toBe(code);
    expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).updatedAt).toEqual(attempt.updatedAt);
    expect(await prisma.grade.count({ where: { gradebookItem: { activityId: id } } })).toBe(0);
    await responseJson(await api.delete(`${course}/gradebook/attempts/${attempt.id}`, { data: { reason: "Delete the submitted attempt" } }));
    expect((await api.post(actions, { data: { actionId: singleAction, participantId: attempt.participantId } })).status()).toBe(409);
    expect((await responseJson<{ actions: Array<{ participantIds: string[] }> }>(await api.get(actions))).actions.every(action => action.participantIds.length === 0)).toBe(true);
  } finally { await learner.dispose(); }
});
