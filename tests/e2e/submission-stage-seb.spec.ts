import { createHash } from "node:crypto";
import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";
import { buildSafeExamBrowserConfiguration } from "../../apps/api/src/lib/safe-exam-browser";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

for (const filesSeb of [false]) for (const questionsSeb of [false, true]) test(`staged SEB files=${filesSeb} questions=${questionsSeb} uses independent guards and one verified configuration`, async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data);
  const ordinary = await createAuthenticatedApi("student"), verified = await createAuthenticatedApi("student");
  let activityId: string | undefined;
  try {
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Independent stage SEB", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${activityId}`, plugin = `${base}/coding-homework-grader`;
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`, endpoint = `${assigned}/coding-homework-grader`;
    const authoring = await responseJson<{ assignment: object }>(await teacherApi.get(`${plugin}/authoring`));
    await responseJson(await teacherApi.put(`${plugin}/authoring`, { data: { assignment: { ...authoring.assignment, questionCount: 1 }, requirements: {} } }));
    await responseJson(await teacherApi.post(`${plugin}/provided-files`, { data: { fileName: "starter.h", base64: Buffer.from("int solve(int value);").toString("base64") } }));
    await responseJson(await teacherApi.put(`${plugin}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${plugin}/prepare-references`, { data: {} }));
    const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(`${base}/assign-all-groups`))).settings;
    await responseJson(await teacherApi.post(`${base}/assign-all-groups`, { data: { ...settings.general, assessmentMode: "summative", requireSafeExamBrowser: false,
      submissionStages: { files: { enabled: true, requireSafeExamBrowser: filesSeb }, questions: { enabled: true, requireSafeExamBrowser: questionsSeb } },
      groupAssignments: settings.groups.map(group => ({ ...group, assigned: true, overrideFields: [], submissionStages: {} }))
    } }));
    const access = await responseJson<{ access: { requiresSafeExamBrowser: boolean; accessGranted: boolean } }>(await ordinary.get(`${assigned}/seb`));
    expect(access.access.requiresSafeExamBrowser).toBe(filesSeb || questionsSeb);
    expect((await ordinary.get(`${endpoint}/assignment`)).status()).toBe(200);
    expect((await ordinary.get(`${endpoint}/provided-files-download`)).status()).toBe(200);
    expect((await ordinary.get(`${endpoint}/preparation`)).status()).toBe(filesSeb ? 403 : 200);
    if (filesSeb) {
      expect((await ordinary.post(`${endpoint}/preparation`, { data: {} })).status()).toBe(403);
      expect((await ordinary.post(`${endpoint}/hand-in`, { data: {} })).status()).toBe(403);
    }
    await page.goto(assigned.replace(/^\/api/, ""));
    const gate = page.getByRole("dialog", { name: "Open this activity in Safe Exam Browser?" });
    await expect(gate).toBeHidden();
    if (filesSeb) {
      await expect(page.getByText("Safe Exam Browser is required for this stage.", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Open in Safe Exam Browser", exact: true }).click();
      await expect(gate).toBeVisible();
    } else await expect(page.locator('input[type="file"][multiple]')).toBeEnabled();

    let configuration: ReturnType<typeof buildSafeExamBrowserConfiguration> | undefined, proof = "";
    if (filesSeb || questionsSeb) {
      const { launch } = await responseJson<{ launch: { downloadUrl: string } }>(await verified.post(`${assigned}/seb`, { data: {} }));
      const token = new URL(launch.downloadUrl).searchParams.get("token")!;
      configuration = buildSafeExamBrowserConfiguration({ courseId: data.courseId, groupId: data.groupId, activityId }, token);
      proof = createHash("sha256").update(`${configuration.startUrl}${configuration.configKey}`).digest("hex");
      expect((await verified.post(`${assigned}/seb/activate`, { data: { token, configKeyHash: "0".repeat(64) } })).status()).toBe(403);
      await responseJson(await verified.post(`${assigned}/seb/activate`, { data: { token, configKeyHash: proof } }));
      expect((await verified.get(`${endpoint}/preparation`)).status()).toBe(200);
      if (filesSeb) {
        await page.addInitScript(value => { (window as unknown as { SafeExamBrowser: unknown }).SafeExamBrowser = { version: "stage-integration-test", security: { configKey: value } }; }, proof);
        await page.goto(configuration.startUrl);
        await expect(page.locator('input[type="file"][multiple]')).toBeEnabled();
        await expect(gate).toBeHidden();
      }
    }
    const actor = filesSeb ? verified : ordinary;
    await responseJson(await actor.post(`${endpoint}/preparation`, { data: { kind: "file", fileName: "main.c", path: "main.c", expectedRevision: 0, base64: Buffer.from("int solve(int value) { return value + 3; }").toString("base64") } }));
    const handed = await responseJson<{ submission: { id: string } }>(await actor.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await ordinary.get(`${endpoint}/workspace`))).submission.status, { timeout: 40_000 }).toBe("challenge_ready");
    expect((await ordinary.get(`${endpoint}/submitted-file?path=main.c`)).status()).toBe(200);
    const beforeStart = (await ordinary.get(`${endpoint}/answering`)).status();
    if (questionsSeb) expect(beforeStart).toBe(403); else expect([200, 409]).toContain(beforeStart);
    const outside = await ordinary.post(`${endpoint}/answering`, { data: { submissionId: handed.submission.id } });
    expect(outside.status()).toBe(questionsSeb ? 403 : 200);
    await page.goto(assigned.replace(/^\/api/, ""));
    if (questionsSeb) {
      await expect(page.getByRole("button", { name: "Answer challenge questions", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Answer challenge questions", exact: true }).click();
      if (!filesSeb) {
        await expect(gate).toBeVisible();
        await page.addInitScript(value => { (window as unknown as { SafeExamBrowser: unknown }).SafeExamBrowser = { version: "stage-integration-test", security: { configKey: value } }; }, proof);
        await page.goto(configuration!.startUrl);
        await expect(page.getByRole("button", { name: "Answer challenge questions", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Answer challenge questions", exact: true }).click();
      }
    }
    await expect(page.getByRole("heading", { name: "Challenge questions", exact: true })).toBeVisible();
    await expect(gate).toBeHidden();
    expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(1);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Challenge questions", exact: true })).toBeVisible();
    await expect(gate).toBeHidden();
  } finally {
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await ordinary.dispose(); await verified.dispose(); await model.close();
  }
});

test("stage SEB controls persist General, section and student overrides without an activity-wide duplicate", async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(120_000);
  const title = "Stage SEB settings", id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title, config: {} });
  const settingsPath = `/api/courses/${data.courseId}/activities/${id}/assign-all-groups`;
  const read = async () => (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath))).settings;
  const initial = await read();
  await responseJson(await teacherApi.post(settingsPath, { data: { ...initial.general, assessmentMode: "summative", submissionStages: { files: { enabled: false, requireSafeExamBrowser: false }, questions: { enabled: false, requireSafeExamBrowser: true } }, groupAssignments: initial.groups.map(group => ({ ...group, assigned: true, overrideFields: [], submissionStages: {} })) } }));
  const open = async () => { await page.goto(`/courses/${data.courseId}/gradebook/activities/${id}?settings=1`); const dialog = page.getByRole("dialog", { name: title, exact: true }); await expect(dialog.getByRole("heading", { name: "Submission stages", exact: true })).toBeVisible(); return dialog; };
  let dialog = await open();
  const questions = dialog.getByRole("switch", { name: "Questions answering — Require Safe Exam Browser", exact: true });
  await expect(dialog.getByRole("switch", { name: "File submission — Require Safe Exam Browser", exact: true })).toHaveCount(0);
  await expect(questions).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Require Safe Exam Browser", exact: true })).toHaveCount(0);
  await questions.uncheck();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await read()).general.submissionStages).toMatchObject({ files: { requireSafeExamBrowser: false }, questions: { requireSafeExamBrowser: true } });
  dialog = await open(); await questions.uncheck();
  await dialog.getByRole("button", { name: "Save settings", exact: true }).click(); await expect(dialog).toBeHidden();
  dialog = await open();
  await dialog.getByRole("tab", { name: "Group assignment", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "Override File submission — Require Safe Exam Browser", exact: true })).toHaveCount(0);
  await dialog.getByRole("checkbox", { name: "Override Questions answering — Require Safe Exam Browser", exact: true }).check();
  await questions.check();
  await dialog.getByRole("button", { name: "Save settings", exact: true }).click(); await expect(dialog).toBeHidden();
  const saved = await read();
  expect(saved.general.submissionStages).toMatchObject({ files: { requireSafeExamBrowser: false }, questions: { requireSafeExamBrowser: false } });
  expect(saved.groups[0].submissionStages).toMatchObject({ questions: { requireSafeExamBrowser: true } });
  const student = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, email: credentialsFor("student").email } });
  await responseJson(await teacherApi.post(settingsPath, { data: { ...saved.general, groupAssignments: saved.groups.map(group => ({ ...group, exceptions: [{ participantId: student.id, submissionStages: { questions: { requireSafeExamBrowser: false } } }] })) } }));
  expect((await read()).groups[0].exceptions[0].submissionStages).toMatchObject({ questions: { requireSafeExamBrowser: false } });
  const learner = await createAuthenticatedApi("student");
  try {
    const access = await responseJson<{ access: { requiresSafeExamBrowser: boolean } }>(await learner.get(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/seb`));
    expect(access.access.requiresSafeExamBrowser).toBe(false);
  } finally { await learner.dispose(); }
  const before = await read();
  const disallowed = { files: { requireSafeExamBrowser: true } };
  for (const payload of [
    { ...before.general, submissionStages: disallowed, groupAssignments: before.groups },
    { ...before.general, groupAssignments: before.groups.map(group => ({ ...group, submissionStages: disallowed })) },
    { ...before.general, groupAssignments: before.groups.map(group => ({ ...group, exceptions: [{ participantId: student.id, submissionStages: disallowed }] })) }
  ]) {
    const rejected = await teacherApi.post(settingsPath, { data: payload });
    expect(rejected.status()).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: { code: "SUBMISSION_STAGE_SEB_UNSUPPORTED" } });
    expect(await read()).toEqual(before);
  }
  dialog = await open(); await questions.scrollIntoViewIfNeeded(); await dialog.screenshot({ path: "tmp/stage-seb-settings-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await questions.scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: "tmp/stage-seb-settings-mobile.png" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
