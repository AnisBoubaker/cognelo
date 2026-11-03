import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("homework answer submission confirms blanks, reports errors through notifications, and yields to the deadline", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data.token);
  const student = await createAuthenticatedApi("student");
  const activities: string[] = [];
  async function readyHomework(title: string, timed = false) {
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title, config: {} }); activities.push(id);
    const base = `/api/courses/${data.courseId}/activities/${id}/coding-homework-grader`;
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${base}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative", ...(timed ? { timeLimitMinutes: 1 } : {}) } } }));
    const assigned = `/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    const endpoint = `/api${assigned}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int a, int b) { return a + b; }").toString("base64") } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${endpoint}/workspace`))).submission.status, { timeout: 30_000 }).toBe("challenge_ready");
    await page.goto(assigned);
    await page.getByRole("button", { name: "Answer challenge questions", exact: true }).click();
    await expect(page.locator('textarea[id^="answer-"]')).toHaveCount(3);
    const state = await responseJson<{ submissionId: string; questions: Array<{ id: string }> }>(await student.get(`${endpoint}/answering`));
    return { id, endpoint, ...state };
  }
  const dialog = page.getByRole("dialog", { name: "Submit answers?", exact: true });
  const submit = () => page.getByRole("button", { name: "Submit answers", exact: true }).click();
  try {
    const homework = await readyHomework("Confirm incomplete challenge answers");
    let posts = 0;
    page.on("request", request => { if (request.method() === "POST" && request.url().endsWith(`${homework.endpoint}/challenge-answers`)) posts++; });
    await submit();
    await expect(dialog).toContainText("Once submitted, your answers cannot be changed.");
    await expect(dialog.getByRole("listitem")).toHaveText(["Question 1", "Question 2", "Question 3"]);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(posts).toBe(0);

    const answers = page.locator('textarea[id^="answer-"]');
    await answers.nth(0).fill("   ");
    await answers.nth(1).fill("The function returns the sum of its arguments.");
    await submit();
    await expect(dialog.getByRole("listitem")).toHaveText(["Question 1", "Question 3"]);
    await page.screenshot({ path: "tmp/homework-answer-confirmation.png" });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(answers.nth(1)).toHaveValue("The function returns the sum of its arguments.");
    expect((await responseJson<{ submission: { status: string } }>(await student.get(`${homework.endpoint}/workspace`))).submission.status).toBe("challenge_ready");

    await answers.nth(0).fill("A first answer."); await answers.nth(2).fill("A third answer.");
    await submit();
    await expect(dialog).toContainText("Once submitted, your answers cannot be changed.");
    await expect(dialog.getByRole("listitem")).toHaveCount(0);
    await expect(dialog.getByText("There are unanswered questions:", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await answers.nth(0).fill(""); await answers.nth(2).fill("");

    let failOnce = true;
    await page.route(`**${homework.endpoint}/challenge-answers`, async route => {
      if (route.request().method() === "POST" && failOnce) {
        failOnce = false;
        return route.fulfill({ status: 503, json: { error: { code: "TEST_SUBMISSION_FAILURE", message: "Temporary answer submission failure." } } });
      }
      await route.continue();
    });
    await submit(); await dialog.getByRole("button", { name: "Submit answers", exact: true }).click();
    const toast = page.locator('section[role="alert"]').filter({ hasText: "Temporary answer submission failure." });
    await expect(toast).toBeVisible();
    await expect(page.locator('.section > p.error[role="alert"]')).toHaveCount(0);
    await expect(answers.nth(1)).toHaveValue("The function returns the sum of its arguments.");
    await toast.getByRole("button", { name: "Dismiss notification", exact: true }).click();
    await page.getByRole("button", { name: "Messages", exact: true }).click();
    const history = page.getByRole("region", { name: "Recent messages", exact: true });
    await expect(history).toContainText("Temporary answer submission failure.");
    await history.getByRole("button", { name: "Dismiss notification", exact: true }).click();

    await submit();
    await expect(dialog.getByRole("listitem")).toHaveText(["Question 1", "Question 3"]);
    await dialog.getByRole("button", { name: "Submit answers", exact: true }).click();
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${homework.endpoint}/workspace`))).submission.status).toBe("ready_for_grading");
    const persisted = await prisma.$queryRaw<Array<{ studentAnswer: string; answerSubmittedAt: Date }>>`SELECT "studentAnswer", "answerSubmittedAt" FROM "PluginCodingHomeworkChallengeQuestion" WHERE "submissionId"=${homework.submissionId} ORDER BY "orderIndex"`;
    expect(persisted.map(question => question.studentAnswer)).toEqual(["", "The function returns the sum of its arguments.", ""]);
    expect(persisted.every(question => question.answerSubmittedAt)).toBe(true);
    expect((await student.put(`${homework.endpoint}/challenge-answers`, { data: { submissionId: homework.submissionId, answers: [{ questionId: homework.questions[0].id, answer: "A late answer." }] } })).status()).toBe(409);
    await page.unroute(`**${homework.endpoint}/challenge-answers`);

    const timed = await readyHomework("Deadline with an open confirmation", true);
    await submit();
    await expect(dialog.getByRole("listitem")).toHaveText(["Question 1", "Question 2", "Question 3"]);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: timed.id } });
    await prisma.activityAttempt.update({ where: { id: attempt.id }, data: { startedAt: new Date(Date.now() - 61_000) } });
    await prisma.backgroundJob.updateMany({ where: { handlerKey: "coding-homework-grader.answering-deadline", payload: { path: ["coreAttemptId"], equals: attempt.id } }, data: { runAfter: new Date(0) } });
    await expect.poll(async () => (await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).lifecycle, { timeout: 20_000 }).toBe("submitted");
    await expect(dialog).toBeHidden();
    const blanks = await prisma.$queryRaw<Array<{ studentAnswer: string; answerSubmittedAt: Date }>>`SELECT "studentAnswer", "answerSubmittedAt" FROM "PluginCodingHomeworkChallengeQuestion" WHERE "submissionId"=${timed.submissionId}`;
    expect(blanks).toHaveLength(3); expect(blanks.every(question => question.studentAnswer === "" && question.answerSubmittedAt)).toBe(true);
  } finally {
    for (const id of activities) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: id } } });
    await student.dispose(); await model.close();
  }
});
