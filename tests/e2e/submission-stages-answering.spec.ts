import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";
import { prisma } from "@cognelo/db";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

test("homework answering honors own/global/neither deadlines and optional duration after the explicit start", async ({ bankCourse: data, browser }) => {
  test.setTimeout(180_000);
  const model = await homeworkModelFixture(data), api = model.api, learner = await createAuthenticatedApi("student"), page = await browser.newPage({ storageState: await learner.storageState() });
  const ids: string[] = [];
  try {
    for (const [ownOffset, overallOffset, minutes] of [[5, null, null], [null, 10, null], [10, 5, 20], [5, 10, 20], [null, null, 1], [null, null, null]] as const) {
      const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Answering stage matrix", config: {} }); ids.push(id);
      const base = `/api/courses/${data.courseId}/activities/${id}/coding-homework-grader`, assignmentUrl = `/api/courses/${data.courseId}/activities/${id}/assign-all-groups`, endpoint = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
      const authored = await responseJson<{ assignment: object; requirements: { requirements: object } }>(await api.get(`${base}/authoring`));
      await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...authored.assignment, questionCount: 1 }, requirements: authored.requirements.requirements } }));
      const now = Date.now(), own = ownOffset === null ? null : new Date(now + ownOffset * 60_000).toISOString(), overall = overallOffset === null ? null : new Date(now + overallOffset * 60_000).toISOString();
      const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(assignmentUrl))).settings;
      await responseJson(await api.post(assignmentUrl, { data: { ...settings.general, availableUntil: overall, submissionStages: { files: { deadline: new Date(now + 60_000).toISOString() }, questions: { deadline: own, timeLimitMinutes: minutes } }, groupAssignments: settings.groups.map(group => ({ ...group, assigned: true })) } }));
      await responseJson(await api.put(`${base}/workflow-settings`, { data: { selected: [] } })); await responseJson(await api.post(`${base}/prepare-references`, { data: {} })); await responseJson(await api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
      await responseJson(await learner.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int x, int y) { return x + y; }").toString("base64") } }));
      await responseJson(await learner.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
      await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await learner.get(`${endpoint}/workspace`))).submission.status, { timeout: 40_000 }).toBe("challenge_ready");
      expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
      await page.goto(endpoint.replace(/^\/api/, "").replace(/\/coding-homework-grader$/, ""));
      const start = page.waitForResponse(response => response.url().endsWith(`${endpoint}/answering`) && response.request().method() === "POST");
      await page.getByRole("button", { name: "Answer challenge questions", exact: true }).click();
      const result = await (await start).json(), runtime = result.runtime;
      expect(runtime.timeLimitMinutes).toBe(minutes);
      const ends = [own, overall, minutes === null ? null : new Date(Date.parse(runtime.attempt.startedAt) + minutes * 60_000).toISOString()].filter((v): v is string => v !== null).map(Date.parse);
      expect(runtime.timing.expiresAt).toBe(ends.length ? new Date(Math.min(...ends)).toISOString() : null);
      await expect(page.locator(".homework-challenge-question textarea")).toHaveCount(1);
      if (ownOffset === null && overallOffset === null && minutes === null) {
        await page.goto("about:blank");
        const questionId = result.questions[0].id;
        await responseJson(await learner.put(`${endpoint}/challenge-answers`, { data: { submissionId: result.submissionId, answers: [{ questionId, answer: "Saved before the stage deadline." }] } }));
        const live = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(assignmentUrl))).settings;
        const expiredDeadline = new Date(Date.now() - 1000).toISOString();
        await responseJson(await api.post(assignmentUrl, { data: { ...live.general, confirmActiveStudents: true, submissionStages: { questions: { deadline: expiredDeadline } }, groupAssignments: live.groups } }));
        expect((await learner.put(`${endpoint}/challenge-answers`, { data: { submissionId: result.submissionId, answers: [{ questionId, answer: "Too late" }] } })).status()).toBe(409);
        await responseJson(await learner.post(`${endpoint}/challenge-answers`, { data: { submissionId: result.submissionId, answers: [{ questionId, answer: "Must not replace saved work after expiry" }] } }));
        const [savedQuestion] = await prisma.$queryRaw<Array<{ studentAnswer: string; answerSubmittedAt: Date | null }>>`SELECT "studentAnswer","answerSubmittedAt" FROM "PluginCodingHomeworkChallengeQuestion" WHERE id=${questionId}`;
        expect(savedQuestion.studentAnswer).toBe("Saved before the stage deadline."); expect(savedQuestion.answerSubmittedAt).not.toBeNull();
        expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: runtime.attempt.id } })).metadata).toMatchObject({ submittedAvailableUntil: expiredDeadline, submittedStageDeadline: expiredDeadline, submittedStageId: "questions" });
      }
      await responseJson(await api.delete(`${base}/manage-submissions`, { data: { submissionId: result.submissionId, reason: "Finish isolated stage scenario" } }));
    }
  } finally { await page.close(); await learner.dispose(); for (const id of ids) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: id } } }); await model.close(); }
});
