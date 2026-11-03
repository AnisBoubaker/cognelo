import { createHash } from "node:crypto";
import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";
import { buildSafeExamBrowserConfiguration } from "../../apps/api/src/lib/safe-exam-browser";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

async function readyHomework(data: ActivitySuiteData, teacher: APIRequestContext, seb = false) {
  const activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Queued homework", config: {} });
  const teacherPath = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
  const current = await responseJson<{ assignment: Record<string, unknown> }>(await teacher.get(`${teacherPath}/authoring`));
  await responseJson(await teacher.put(`${teacherPath}/authoring`, { data: { assignment: { ...current.assignment, questionCount: 3 }, requirements: {} } }));
  await responseJson(await teacher.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId, metadata: { assessmentMode: "summative", timeLimitMinutes: 10, requireSafeExamBrowser: seb }, gradebookSettings: { maxAttempts: 1, attemptLimitMode: "max_attempts", pointsPossible: 100 } } }));
  await responseJson(await teacher.put(`${teacherPath}/workflow-settings`, { data: { selected: [] } }));
  await responseJson(await teacher.post(`${teacherPath}/prepare-references`, { data: {} }));
  await responseJson(await teacher.put(`${teacherPath}/workflow-settings`, { data: { enabled: true } }));
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
  return { activityId, teacherPath, assigned, endpoint: `${assigned}/coding-homework-grader` };
}
async function handIn(student: APIRequestContext, endpoint: string, index = 0) {
  await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", fileName: "main.c", path: "main.c", expectedRevision: 0, base64: Buffer.from(`int student_${index}(int x) { return x + ${index}; }`).toString("base64") } }));
  return responseJson<{ submission: { id: string } }>(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
}

test("homework enters SEB only when answering and recognizes the verified configuration on return", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data, { failFirst: 1 }); const student = await createAuthenticatedApi("student"); let id: string | undefined;
  try {
    const homework = await readyHomework(data, teacherApi, true); id = homework.activityId;
    await handIn(student, homework.endpoint);
    await page.goto(homework.assigned.replace(/^\/api/, ""));
    const dialog = page.getByRole("dialog", { name: "Open this activity in Safe Exam Browser?" });
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Answer challenge questions", exact: true })).toBeVisible({ timeout: 45_000 });
    expect((await student.post(`${homework.endpoint}/answering`, { data: {} })).status()).toBe(403);
    await page.getByRole("button", { name: "Answer challenge questions", exact: true }).click(); await expect(dialog).toBeVisible();
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    const { launch } = await responseJson<{ launch: { downloadUrl: string } }>(await student.post(`${homework.assigned}/seb`, { data: {} }));
    const token = new URL(launch.downloadUrl).searchParams.get("token")!;
    const config = buildSafeExamBrowserConfiguration({ courseId: data.courseId, groupId: data.groupId, activityId: id }, token);
    const proof = createHash("sha256").update(`${config.startUrl}${config.configKey}`).digest("hex");
    expect((await student.post(`${homework.assigned}/seb/activate`, { data: { token, configKeyHash: "0".repeat(64) } })).status()).toBe(403);
    // Simulate the native SEB JavaScript proof only; activation and cookie verification use the real server.
    await page.addInitScript(value => { (window as unknown as { SafeExamBrowser: unknown }).SafeExamBrowser = { version: "integration-test", security: { configKey: value } }; }, proof);
    await page.goto(config.startUrl);
    await expect(page.getByRole("button", { name: "Answer challenge questions", exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    await page.getByRole("button", { name: "Answer challenge questions", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Challenge questions", exact: true })).toBeVisible();
    await expect(dialog).toBeHidden(); expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(1);
    await page.reload(); await expect(page.getByRole("heading", { name: "Challenge questions", exact: true })).toBeVisible(); await expect(dialog).toBeHidden();
  } finally {
    if (id) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: id } } });
    await student.dispose(); await model.close();
  }
});

test("30 students use a bounded FIFO queue and cancelled running/queued work cannot publish late questions", async ({ bankCourse: data, teacherApi, browser }) => {
  test.setTimeout(240_000);
  const model = await homeworkModelFixture(data, { hold: true });
  const clients: APIRequestContext[] = [], userIds: string[] = []; let id: string | undefined;
  let studentContext: BrowserContext | undefined;
  try {
    const homework = await readyHomework(data, teacherApi); id = homework.activityId;
    expect((await teacherApi.put(`${homework.teacherPath}/workflow-settings`, { data: { concurrency: 5 } })).status()).toBe(400);
    const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } });
    const submissions: string[] = [];
    for (let index = 0; index < 30; index++) {
      const email = `queue-${data.token}-${index}@example.test`;
      const user = await prisma.user.create({ data: { email, firstName: "Queue", lastName: String(index), passwordHash: seed.passwordHash, isActive: true, mustChangePassword: false, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } }); userIds.push(user.id);
      await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email, role: "student" } }));
      const client = await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("student").password }); clients.push(client);
      submissions.push((await handIn(client, homework.endpoint, index)).submission.id);
    }
    await expect.poll(() => model.active).toBe(2); expect(model.maximum).toBe(2);
    // FIFO admits the oldest two jobs; their concurrent provider requests can arrive in either order.
    expect(model.starts.slice(0, 2).map(code => code.match(/student_(\d+)\(/)?.[1]).sort()).toEqual(["0", "1"]);
    expect(await prisma.backgroundJob.count({ where: { queue: "coding-homework-grader", status: "queued", payload: { path: ["activityId"], equals: id } } })).toBe(28);
    studentContext = await browser.newContext({ storageState: await clients[3].storageState(), locale: "en-CA" });
    const page = await studentContext.newPage();
    await page.goto(`${process.env.E2E_WEB_URL ?? "http://localhost:3000"}${homework.assigned.replace(/^\/api/, "")}`);
    const progress = page.locator(".homework-generation-status"), spinner = progress.locator(".homework-generation-spinner");
    await expect(progress).toContainText("Waiting to generate your questions…");
    await expect(progress).toContainText("Your position in line: 2");
    await expect(spinner).toBeVisible();
    expect(await spinner.evaluate(element => getComputedStyle(element).animationName)).toBe("homework-generation-spin");
    await expect(progress).not.toContainText(/leave this page|return later/i);
    await page.setViewportSize({ width: 390, height: 844 });
    await progress.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "tmp/homework-generation-queue-mobile.png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await spinner.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const interrupted = await prisma.backgroundJob.findUniqueOrThrow({ where: { queue_idempotencyKey: { queue: "coding-homework-grader", idempotencyKey: `submission:${submissions[10]}` } } });
    await prisma.backgroundJob.update({ where: { id: interrupted.id }, data: { status: "running", lockedBy: "stopped-worker-fixture", lockedAt: new Date(Date.now() - 180_000), attempts: 1 } });
    await responseJson(await teacherApi.put(`${homework.teacherPath}/workflow-settings`, { data: { concurrency: 4 } }));
    await expect.poll(() => model.active).toBe(4); expect(model.maximum).toBe(4);
    await expect(progress).toContainText("Question generation in progress…");
    await expect(progress).not.toContainText("Your position in line:");
    await expect(spinner).toBeVisible();
    for (const index of [0, 29]) await responseJson(await teacherApi.delete(`${homework.teacherPath}/manage-submissions`, { data: { submissionId: submissions[index], reason: "Allow a corrected submission." } }));
    model.release();
    await expect.poll(async () => (await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${id} AND status='challenge_ready'`)[0].count.toString(), { timeout: 90_000 }).toBe("28");
    expect(model.maximum).toBeLessThanOrEqual(4);
    expect((await prisma.backgroundJob.findUniqueOrThrow({ where: { id: interrupted.id } })).attempts).toBe(2);
    for (const index of [0, 29]) {
      expect(await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginCodingHomeworkChallengeQuestion" WHERE "submissionId"=${submissions[index]}`).toEqual([{ count: 0n }]);
      expect(await responseJson(await clients[index].get(`${homework.endpoint}/workspace`))).toMatchObject({ submission: null, previousCancelled: true });
    }
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    expect(await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginCodingHomeworkChallengeQuestion" q JOIN "PluginCodingHomeworkSubmission" s ON s.id=q."submissionId" WHERE s."activityId"=${id}`).toEqual([{ count: 84n }]);
    await expect(page.getByRole("button", { name: "Answer challenge questions", exact: true })).toBeVisible();
    await expect(progress).toHaveCount(0);
  } finally {
    await studentContext?.close();
    model.release(); if (id) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: id } } });
    await Promise.all(clients.map(client => client.dispose()));
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }); await model.close();
  }
});
