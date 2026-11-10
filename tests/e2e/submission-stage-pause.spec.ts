import { prisma } from "@cognelo/db";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("closing questions pauses an in-flight set without publishing partial questions or consuming retries", async ({ bankCourse: data, teacherApi: api }) => {
  test.setTimeout(90_000);
  const model = await homeworkModelFixture(data, { hold: true, questionText: number => `For add(${number}, 2), what value is returned and why?` }), learner = await createAuthenticatedApi("student");
  let id: string | undefined;
  try {
    id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Pause active generation", config: {} });
    const base = `/api/courses/${data.courseId}`, author = `${base}/activities/${id}/coding-homework-grader`, path = `${base}/activities/${id}/assign-all-groups`, endpoint = `${base}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    const authored = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${author}/authoring`));
    await responseJson(await api.put(`${author}/authoring`, { data: { assignment: { ...authored.assignment, questionCount: 2 }, requirements: { requiredFiles: [{ path: "main.c" }] } } }));
    await responseJson(await api.put(`${author}/workflow-settings`, { data: { selected: [] } })); await responseJson(await api.post(`${author}/prepare-references`, { data: {} }));
    const set = async (enabled: boolean) => {
      const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(path))).settings;
      await responseJson(await api.post(path, { data: { ...settings.general, assessmentMode: "summative", submissionStages: { files: { enabled: true }, questions: { enabled } }, groupAssignments: settings.groups.map(group => ({ ...group, assigned: true })), confirmActiveStudents: true } }));
    };
    await set(true);
    await responseJson(await learner.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int a, int b) { return a + b; }").toString("base64") } }));
    const { submission } = await responseJson<{ submission: { id: string } }>(await learner.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    await expect.poll(() => model.starts.length).toBe(1);
    await set(false); model.release();
    const job = () => prisma.backgroundJob.findFirstOrThrow({ where: { queue: "coding-homework-grader", idempotencyKey: `submission:${submission.id}` } });
    await expect.poll(async () => (await job()).status).toBe("queued");
    expect((await job()).attempts).toBe(0); expect((await job()).runAfter.getUTCFullYear()).toBe(9999); expect(model.starts).toHaveLength(1);
    expect(await prisma.$queryRaw`SELECT id FROM "PluginCodingHomeworkChallengeQuestion" WHERE "submissionId"=${submission.id}`).toEqual([]);
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    await set(true);
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await learner.get(`${endpoint}/workspace`))).submission.status, { timeout: 30_000 }).toBe("challenge_ready");
    expect(model.starts).toHaveLength(3); expect((await job()).attempts).toBe(1);
    expect((await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PluginCodingHomeworkChallengeQuestion" WHERE "submissionId"=${submission.id}`)).toHaveLength(2);
  } finally {
    model.release(); if (id) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: id } } });
    await learner.dispose(); await model.close();
  }
});
