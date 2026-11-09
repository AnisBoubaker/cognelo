import { openHomeworkEditorSection } from "./fixtures/homework-editor";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import type { StudentGroupingDto } from "@cognelo/contracts";
import { textPdf } from "./fixtures/pdf";
import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

test("team configuration uses core section settings and permits independent unteamed hand-in", async ({ bankCourse: data, teacherApi, teacherPage: page, studentPage }) => {
  test.setTimeout(120_000); page.setDefaultTimeout(10_000); studentPage.setDefaultTimeout(10_000);
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student"); let activityId: string | undefined;
  try {
    const course = `/api/courses/${data.courseId}`;
    const { group: other } = await responseJson<{ group: { id: string; title: string } }>(await teacherApi.post(`${course}/groups`, { data: { title: "Second section", status: "published" } }));
    await responseJson(await teacherApi.patch(`${course}/groups/${other.id}`, { data: { status: "published", availableFrom: null, availableUntil: null } }));
    await responseJson(await teacherApi.post(`${course}/groups/${other.id}/participants`, { data: { email: credentialsFor("student").email, role: "student" } }));
    const { grouping: first } = await responseJson<{ grouping: { id: string } }>(await teacherApi.post(`${course}/groups/${data.groupId}/groupings`, { data: { title: "First section teams", teams: [] } }));
    const { grouping: second } = await responseJson<{ grouping: { id: string } }>(await teacherApi.post(`${course}/groups/${other.id}/groupings`, { data: { title: "Second section teams", teams: [] } }));
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Homework team settings", config: {} });
    const settingsPath = `${course}/activities/${activityId}/assign-all-groups`;
    const readSettings = async () => (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath))).settings;
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: "Actions for Homework team settings", exact: true }).click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Homework team settings", exact: true });
    await dialog.getByRole("checkbox", { name: "Team work", exact: true }).check();
    const box = await dialog.getByRole("checkbox", { name: "Team work", exact: true }).boundingBox(); expect(box!.width).toBeLessThanOrEqual(24);
    await dialog.getByRole("tab", { name: "Group assignment", exact: true }).click();
    const existing = await readSettings();
    const sectionTitle = existing.groups.find(group => group.groupId === data.groupId)!.title;
    for (const [title, groupingId, allowed] of [[sectionTitle, first.id, false], [other.title, second.id, true]] as const) {
      await dialog.getByRole("tab", { name: title, exact: true }).click();
      await dialog.getByRole("checkbox", { name: "Assigned", exact: true }).check();
      await dialog.getByRole("combobox", { name: "Team grouping", exact: true }).selectOption(groupingId);
      await dialog.getByRole("checkbox", { name: "Allow students without a team to submit individually", exact: true }).setChecked(allowed);
    }
    await dialog.screenshot({ path: "tmp/homework-team-settings.png" });
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click(); await expect(dialog).toBeHidden();
    const saved = await readSettings(); expect(saved.general.teamworkEnabled).toBe(true);
    expect(saved.groups.find(group => group.groupId === data.groupId)).toMatchObject({ teamGroupingId: first.id, allowIndividualSubmission: false });
    expect(saved.groups.find(group => group.groupId === other.id)).toMatchObject({ teamGroupingId: second.id, allowIndividualSubmission: true });
    const invalid = await teacherApi.post(settingsPath, { data: { ...saved.general, groupAssignments: saved.groups.map(group => ({ ...group, teamGroupingId: second.id })) } }); expect(invalid.status()).toBe(400);
    // The generic editor cannot overwrite core-owned team policy with stale metadata.
    await responseJson(await teacherApi.patch(`${course}/activities/${activityId}`, { data: { metadata: { allGroupsAssignment: { teamworkEnabled: false } } } }));
    expect((await readSettings()).general.teamworkEnabled).toBe(true);
    const authoring = `${course}/activities/${activityId}/coding-homework-grader`;
    await page.goto(`/courses/${data.courseId}/activities/${activityId}`); await openHomeworkEditorSection(page, "Question Generation");
    const separate = page.getByRole("switch", { name: "Generate separate challenge questions for each team member", exact: true });
    await expect(separate).toBeVisible(); await expect(separate).not.toBeChecked();
    const pdf = textPdf("Download the assignment before joining your team.");
    await responseJson(await teacherApi.post(`${authoring}/assignment-pdf`, { data: { fileName: "statement.pdf", mimeType: "application/pdf", base64: pdf.toString("base64") } }));
    await responseJson(await teacherApi.post(`${authoring}/provided-files`, { data: { fileName: "starter.h", mimeType: "text/plain", base64: Buffer.from("int solve(int x);").toString("base64") } }));
    await responseJson(await teacherApi.put(`${authoring}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${authoring}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${authoring}/workflow-settings`, { data: { enabled: true } }));
    const endpoint = `${course}/groups/${other.id}/activities/assigned/${activityId}/coding-homework-grader`;
    const state = await responseJson<{ teamwork: { contextKey: string; canSubmit: boolean } }>(await student.get(`${endpoint}/workspace`)); expect(state.teamwork.canSubmit).toBe(true);
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { contextKey: state.teamwork.contextKey, kind: "file", path: "main.c", base64: Buffer.from("int solve(int x) { return x + 2; }").toString("base64"), expectedRevision: 0 } }));
    const { submission } = await responseJson<{ submission: { id: string } }>(await student.post(`${endpoint}/hand-in`, { data: { contextKey: state.teamwork.contextKey, expectedRevision: 1 } }));
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${endpoint}/workspace`))).submission.status).toBe("challenge_ready");
    expect(model.starts).toHaveLength(3);
    expect((await teacherApi.delete(settingsPath)).status()).toBe(409);
    await studentPage.goto(endpoint.replace(/^\/api/, "").replace(/\/coding-homework-grader$/, ""));
    await expect(studentPage.getByRole("link", { name: "Download submitted work (ZIP)", exact: true })).toBeVisible();
    await studentPage.getByRole("button", { name: "Check my submission", exact: true }).click(); await expect(studentPage.getByText("Structure is valid.", { exact: true })).toBeVisible();
    await studentPage.getByRole("button", { name: "Answer challenge questions", exact: true }).click();
    await expect(studentPage.getByRole("heading", { name: "Challenge questions", exact: true })).toBeVisible();
    await studentPage.screenshot({ path: "tmp/homework-team-answering.png", fullPage: true });
    const blockedEndpoint = `${course}/groups/${data.groupId}/activities/assigned/${activityId}/coding-homework-grader`;
    const blocked = await responseJson<{ teamwork: { canSubmit: boolean; contextKey: string }; submission: unknown }>(await student.get(`${blockedEndpoint}/workspace`));
    expect(blocked).toMatchObject({ teamwork: { canSubmit: false }, submission: null });
    let preparationReads = 0;
    studentPage.on("request", request => { if (request.url().endsWith(`${blockedEndpoint}/preparation`)) preparationReads++; });
    await studentPage.goto(blockedEndpoint.replace(/^\/api/, "").replace(/\/coding-homework-grader$/, ""));
    const notice = studentPage.getByText("You are not a member of a team. You must join a team before you can upload files or submit this homework. You can still download the assignment and provided files.", { exact: true });
    await expect(notice).toBeVisible();
    await expect(studentPage.getByRole("heading", { name: "Prepare your work", exact: true })).toHaveCount(0);
    await expect(studentPage.locator('input[type="file"]')).toHaveCount(0);
    await expect(studentPage.getByRole("button", { name: /Check my submission|Submit my work|Remove all files/ })).toHaveCount(0);
    await expect(studentPage.getByText("Individual workspace", { exact: true })).toHaveCount(0);
    const pdfDownload = studentPage.waitForEvent("download");
    await studentPage.getByRole("link", { name: "Download assignment", exact: true }).click();
    expect(await readFile((await (await pdfDownload).path())!)).toEqual(pdf);
    const zipDownload = studentPage.waitForEvent("download");
    await studentPage.getByRole("link", { name: "Download provided files (ZIP)", exact: true }).click();
    const starter = unzipSync(await readFile((await (await zipDownload).path())!));
    expect(Buffer.from(starter["starter.h"]).toString()).toBe("int solve(int x);");
    await studentPage.waitForResponse(response => response.url().endsWith(`${blockedEndpoint}/workspace`) && response.ok());
    expect(preparationReads).toBe(0);
    const blockedFile = { contextKey: blocked.teamwork.contextKey, kind: "file", path: "main.c", base64: Buffer.from("int solve(int x) { return x; }").toString("base64"), expectedRevision: 0 };
    for (const response of [await student.get(`${blockedEndpoint}/preparation`), await student.post(`${blockedEndpoint}/preparation`, { data: blockedFile }),
      await student.delete(`${blockedEndpoint}/preparation`, { data: { all: true, expectedRevision: 0, contextKey: blocked.teamwork.contextKey } }),
      await student.get(`${blockedEndpoint}/prepared-file?path=main.c`), await student.post(`${blockedEndpoint}/hand-in`, { data: { expectedRevision: 0, contextKey: blocked.teamwork.contextKey } })]) {
      expect(response.status()).toBe(403); expect(await response.json()).toMatchObject({ error: { code: "HOMEWORK_TEAM_REQUIRED" } });
    }
    expect((await student.post(`${blockedEndpoint}/preflight`, { data: {} })).status()).toBe(409);
    expect(await prisma.$queryRaw`SELECT id FROM "PluginCodingHomeworkWorkspace" WHERE "activityId"=${activityId} AND "groupId"=${data.groupId}`).toEqual([]);
    await studentPage.screenshot({ path: "tmp/homework-team-required.png", fullPage: true });
    // Joining unlocks preparation on the open page; leaving closes it and revokes stale uploads.
    const participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, email: credentialsFor("student").email } });
    const { groupings } = await responseJson<{ groupings: StudentGroupingDto[] }>(await teacherApi.get(`${course}/groups/${data.groupId}/groupings`));
    const grouping = groupings.find(grouping => grouping.id === first.id)!;
    const { grouping: joined } = await responseJson<{ grouping: StudentGroupingDto }>(await teacherApi.patch(`${course}/groups/${data.groupId}/groupings/${first.id}`, { data: { ...grouping, teams: [{ title: "New team", participantIds: [participant.id] }] } }));
    await expect(studentPage.getByRole("heading", { name: "Prepare your work", exact: true })).toBeVisible();
    await studentPage.locator('input[type="file"][multiple]').setInputFiles({ name: "main.c", mimeType: "text/plain", buffer: Buffer.from("int solve(int x) { return x; }") });
    await expect(studentPage.getByRole("tab", { name: /main.c/ })).toBeVisible();
    const oldWorkspace = await responseJson<{ teamwork: { contextKey: string } }>(await student.get(`${blockedEndpoint}/workspace`));
    await responseJson(await teacherApi.patch(`${course}/groups/${data.groupId}/groupings/${first.id}`, { data: { ...joined, teams: joined.teams.map(team => ({ ...team, participantIds: [] })) } }));
    await expect(notice).toBeVisible(); await expect(studentPage.locator('input[type="file"]')).toHaveCount(0);
    expect((await student.post(`${blockedEndpoint}/preparation`, { data: { ...blockedFile, contextKey: oldWorkspace.teamwork.contextKey, expectedRevision: 1 } })).status()).toBe(403);
    await responseJson(await teacherApi.delete(`${authoring}/manage-submissions`, { data: { submissionId: submission.id, reason: "Complete test" } }));
  } finally {
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await student.dispose(); await model.close();
  }
});
