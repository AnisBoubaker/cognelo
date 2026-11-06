import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

type State = { teamwork?: { contextKey: string }; automaticSubmissionIssue?: boolean; submission: null | { id: string; status: string; automaticHandIn: boolean; incompleteAcknowledged: boolean; submissionTiming: { deadline: string; submittedAt: string; isLate: boolean; lateByMs: number } } };
for (const team of [false, true]) test(`saved ${team ? "team" : "individual"} work is recovered at the cutoff through ${team ? "class overview" : "the student page"}`, async ({ bankCourse: data, teacherApi, teacherPage, studentPage }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student"); let activityId: string | undefined;
  try {
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Automatic homework", config: {} });
    const authoring = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    const current = await responseJson<{ assignment: object }>(await teacherApi.get(`${authoring}/authoring`));
    await responseJson(await teacherApi.put(`${authoring}/authoring`, { data: { assignment: current.assignment, requirements: { requiredFiles: [{ path: "missing.c" }], requiredFunctions: [{ name: "missing_function" }] } } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId, metadata: { assessmentMode: "summative" }, gradebookSettings: { pointsPossible: 100, maxAttempts: 3 } } }));
    const settingsPath = `/api/courses/${data.courseId}/activities/${activityId}/assign-all-groups`;
    if (team) {
      const participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, email: credentialsFor("student").email } });
      const { grouping } = await responseJson<{ grouping: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/groupings`, { data: { title: "Auto teams", teams: [{ title: "Team", participantIds: [participant.id] }] } }));
      const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
      await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", teamworkEnabled: true, groupAssignments: settings.groups.map(group => ({ ...group, teamGroupingId: grouping.id, allowIndividualSubmission: false })) } }));
    }
    await responseJson(await teacherApi.put(`${authoring}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${authoring}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${authoring}/workflow-settings`, { data: { enabled: true } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`, endpoint = `${assigned}/coding-homework-grader`;
    const initial = await responseJson<State>(await student.get(`${endpoint}/workspace`));
    const draftScope = initial.teamwork ? { contextKey: initial.teamwork.contextKey } : {};
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { ...draftScope, kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int a, int b) { return a + b; }").toString("base64") } }));
    const cutoff = new Date(Date.now() + 2000).toISOString(), deadline = team ? new Date(Date.parse(cutoff) - 60_000).toISOString() : cutoff;
    await responseJson(await teacherApi.put(`${authoring}/workflow-settings`, { data: { submissionPolicy: { deadline, allowLate: team, lateLimitMinutes: team ? 1 : null } } }));
    if (team) {
      // Staff recovery must still preserve files when the learner activity has already closed.
      const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
      await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, availableUntil: cutoff, groupAssignments: settings.groups } }));
    }
    await expect.poll(() => Date.now(), { timeout: 6000 }).toBeGreaterThanOrEqual(Date.parse(cutoff));
    if (team) {
      expect((await student.get(`${endpoint}/workspace`)).status()).toBe(403);
      await teacherPage.goto(`/courses/${data.courseId}/gradebook/activities/${activityId}?report=overview`);
      await expect(teacherPage.getByText("Saved files were submitted automatically at the cutoff.", { exact: true })).toBeVisible();
    } else {
      // Reject writes even before any page visit triggers the overdue hand-in.
      expect((await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 1, replace: true, base64: "aW50IHgoKXt9" } })).status()).toBe(409);
      expect((await student.delete(`${endpoint}/preparation`, { data: { all: true, expectedRevision: 1 } })).status()).toBe(409);
      await studentPage.goto(assigned.replace(/^\/api/, ""));
      await expect(studentPage.getByText("Saved files were submitted automatically at the cutoff.", { exact: true })).toBeVisible();
      await expect(studentPage.getByText("Incomplete work was accepted automatically.", { exact: true })).toBeVisible();
      await expect(studentPage.getByRole("heading", { name: "Submitted work", exact: true })).toBeVisible();
    }
    // Repeated/concurrent staff reads reuse one immutable hand-in and one queue job.
    await Promise.all(Array.from({ length: 3 }, () => teacherApi.get(`${authoring}/manage-submissions?recoverAutomatic=1`).then(responseJson)));
    const rows = await prisma.$queryRaw<Array<{ id: string; metadata: { submissionTiming: { deadline: string; submittedAt: string; isLate: boolean; lateByMs: number }; incompleteAcknowledged: boolean; automaticHandIn: { cutoff: string; recoveredAt: string; acknowledgementSource: string } }; structureValidationSummary: { isValid: boolean }; status: string }>>`SELECT id,metadata,"structureValidationSummary",status FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${activityId} AND kind='final'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].structureValidationSummary.isValid).toBe(false);
    expect(rows[0].metadata.incompleteAcknowledged).toBe(true);
    expect(rows[0].metadata.automaticHandIn).toMatchObject({ cutoff, acknowledgementSource: "automatic_deadline" });
    expect(Date.parse(rows[0].metadata.automaticHandIn.recoveredAt)).toBeGreaterThanOrEqual(Date.parse(cutoff));
    expect(rows[0].metadata.submissionTiming).toEqual({ deadline, submittedAt: cutoff, isLate: team, lateByMs: team ? 60_000 : 0 });
    await expect.poll(async () => (await prisma.$queryRaw<Array<{ status: string }>>`SELECT status FROM "PluginCodingHomeworkSubmission" WHERE id=${rows[0].id}`)[0].status, { timeout: 45_000 }).toBe("challenge_ready");
    expect(model.starts).toHaveLength(3); expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(0);
    if (team) {
      const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
      await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, availableUntil: null, groupAssignments: settings.groups } }));
    }
    const receipt = await responseJson<State>(await student.get(`${endpoint}/workspace`)); expect(receipt.submission).toMatchObject({ automaticHandIn: true, incompleteAcknowledged: true });
    const before = receipt.submission!.id;
    expect((await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1, automatic: { cutoff } } })).status()).toBe(400);
    await responseJson(await teacherApi.delete(`${authoring}/manage-submissions`, { data: { submissionId: before, reason: "Teacher cancellation must not be undone by recovery." } }));
    const cancelled = await responseJson<State>(await student.get(`${endpoint}/workspace`)); expect(cancelled.submission).toBeNull(); expect(cancelled.automaticSubmissionIssue).toBe(false);
    await responseJson(await teacherApi.get(`${authoring}/manage-submissions?recoverAutomatic=1`));
    expect(await prisma.$queryRaw`SELECT id FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${activityId} AND kind='final' AND status<>'cancelled'`).toEqual([]);
  } finally {
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await student.dispose(); await model.close();
  }
});

test("unlimited late work stays unsubmitted after verification, and an empty draft is never handed in", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  test.setTimeout(90_000);
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student"); let activityId: string | undefined;
  try {
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Verify is not submit", config: {} });
    const authoring = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId, metadata: { assessmentMode: "summative" } } }));
    await responseJson(await teacherApi.put(`${authoring}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${authoring}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${authoring}/workflow-settings`, { data: { enabled: true, submissionPolicy: { deadline: new Date(Date.now() - 60_000).toISOString(), allowLate: false } } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`, endpoint = `${assigned}/coding-homework-grader`;
    expect((await responseJson<State>(await student.get(`${endpoint}/workspace`))).submission).toBeNull();
    await responseJson(await teacherApi.get(`${authoring}/manage-submissions?recoverAutomatic=1`));
    expect(await prisma.$queryRaw`SELECT id FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${activityId}`).toEqual([]);
    await responseJson(await teacherApi.put(`${authoring}/workflow-settings`, { data: { submissionPolicy: { deadline: new Date(Date.now() - 60_000).toISOString(), allowLate: true, lateLimitMinutes: null } } }));
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int solve(int x) { return x + 1; }").toString("base64") } }));
    await page.goto(assigned.replace(/^\/api/, ""));
    await page.getByRole("button", { name: "Check my submission", exact: true }).click();
    await expect(page.getByText("Structure is valid.", { exact: true })).toBeVisible();
    await expect(page.locator(".homework-not-submitted")).toContainText("Your work has not been submitted");
    await expect(page.locator(".homework-not-submitted")).toContainText("Submit my work");
    await expect(page.getByRole("button", { name: "Submit my work", exact: true })).toBeEnabled();
    await page.locator(".homework-structure-check").screenshot({ path: "tmp/homework-verified-not-submitted.png" });
    await responseJson(await teacherApi.get(`${authoring}/manage-submissions?recoverAutomatic=1`));
    expect((await responseJson<State>(await student.get(`${endpoint}/workspace`))).submission).toBeNull(); expect(model.starts).toHaveLength(0);
    await page.getByRole("button", { name: "Submit my work", exact: true }).click();
    await page.getByRole("dialog", { name: "Submit my work", exact: true }).getByRole("button", { name: "Submit my work", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Submitted work", exact: true })).toBeVisible();
  } finally {
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await student.dispose(); await model.close();
  }
});
