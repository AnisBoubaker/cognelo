import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createStoredZip } from "./fixtures/zip";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("challenge generation excludes unchanged provided functions and retains modified code", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  test.setTimeout(150_000);
  const model = await homeworkModelFixture(data, { hold: true, questionText: number => number === 1
    ? "Explain how provided_loader reads its result and why the implementation is correct."
    : `Question ${number}: explain the return value of the submitted implementation and the statement that determines it.` });
  const student = await createAuthenticatedApi("student");
  const activities: string[] = [];
  const supplied = "int provided_loader(void) { return 7; }";
  const helper = "int provided_helper(void) { return 2; }";
  const own = "int solve(int value) { return value + 1; }";
  async function createHomework(title: string, count = 1) {
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title, config: {} }); activities.push(id);
    const base = `/api/courses/${data.courseId}/activities/${id}/coding-homework-grader`;
    const authoring = await responseJson<{ assignment: object }>(await teacherApi.get(`${base}/authoring`));
    await responseJson(await teacherApi.put(`${base}/authoring`, { data: { assignment: { ...authoring.assignment, questionCount: count, candidateLimit: 1 }, requirements: {} } }));
    await responseJson(await teacherApi.post(`${base}/provided-files`, { data: { fileName: "provided.c", base64: Buffer.from(supplied).toString("base64") } }));
    return { id, base };
  }
  async function openAndSubmit(homework: { id: string; base: string }, code: string) {
    await responseJson(await teacherApi.put(`${homework.base}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${homework.base}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${homework.base}/workflow-settings`, { data: { enabled: true } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: homework.id, metadata: { assessmentMode: "summative" } } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${homework.id}`;
    const endpoint = `${assigned}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "moved/student.c", expectedRevision: 0, base64: Buffer.from(code).toString("base64") } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    return { assigned, endpoint };
  }
  try {
    const mixed = await createHomework("Provided functions are excluded", 2);
    await responseJson(await teacherApi.post(`${mixed.base}/provided-files`, { data: { fileName: "starter.zip", mimeType: "application/zip", base64: createStoredZip([{ path: "starter/include/helper.h", contents: helper }]).toString("base64") } }));
    // A matching private teacher solution must never make the student's own implementation ineligible.
    await responseJson(await teacherApi.put(`${mixed.base}/teacher-solution`, { data: { fileName: "private.c", base64: Buffer.from(own).toString("base64") } }));
    const first = await openAndSubmit(mixed, `${supplied.replace("return 7;", "/* student's formatting */ return 7 ;")}\n${helper}\n${own}`);
    await expect.poll(() => model.active, { timeout: 30_000 }).toBe(1);
    const [frozen] = await prisma.$queryRaw<Array<{ metadata: { providedCode: { sourceVersion: string; functions: Array<{ name: string; hash: string }> } } }>>`SELECT metadata FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${mixed.id}`;
    expect(frozen.metadata.providedCode.functions.map(fn => fn.name).sort()).toEqual(["provided_helper", "provided_loader"]);
    expect(JSON.stringify(frozen.metadata.providedCode)).not.toContain("return 7");
    const authoring = await responseJson<{ providedFiles: Array<{ id: string; originalName: string }> }>(await teacherApi.get(`${mixed.base}/authoring`));
    const loader = authoring.providedFiles.find(file => file.originalName === "provided.c")!;
    await responseJson(await teacherApi.delete(`${mixed.base}/provided-files?attachmentId=${loader.id}`));
    await responseJson(await teacherApi.post(`${mixed.base}/provided-files`, { data: { fileName: "provided.c", base64: Buffer.from(supplied.replace("7", "99")).toString("base64") } }));
    model.release();
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${first.endpoint}/workspace`))).submission.status, { timeout: 40_000 }).toBe("challenge_ready");
    const questions = await prisma.$queryRaw<Array<{ questionText: string; functionName: string; metadata: unknown }>>`SELECT q."questionText", f."functionName", s.metadata FROM "PluginCodingHomeworkChallengeQuestion" q JOIN "PluginCodingHomeworkSubmissionFunction" f ON f.id=q."submissionFunctionId" JOIN "PluginCodingHomeworkSubmission" s ON s.id=q."submissionId" WHERE s."activityId"=${mixed.id}`;
    expect(questions).toHaveLength(2); expect(questions.every(question => question.functionName === "solve")).toBe(true);
    expect(questions.every(question => !question.questionText.includes("provided_loader"))).toBe(true);
    expect(questions[0].metadata).toMatchObject({ providedCode: { sourceVersion: frozen.metadata.providedCode.sourceVersion }, excludedProvidedFunctionCount: 2 });
    expect(model.starts).toHaveLength(3); // One rejected question about excluded code was retried.
    expect(model.starts.every(code => code === own)).toBe(true);
    const publicWorkspace = JSON.stringify(await responseJson(await student.get(`${first.endpoint}/workspace`)));
    expect(publicWorkspace).not.toContain("providedCode"); expect(publicWorkspace).not.toContain("sourceVersion");

    const changed = await createHomework("Literal changes stay eligible");
    const second = await openAndSubmit(changed, supplied.replace("7", "8"));
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${second.endpoint}/workspace`))).submission.status, { timeout: 30_000 }).toBe("challenge_ready");
    const [target] = await prisma.$queryRaw<Array<{ functionName: string; functionCode: string }>>`SELECT f."functionName", f."functionCode" FROM "PluginCodingHomeworkChallengeQuestion" q JOIN "PluginCodingHomeworkSubmissionFunction" f ON f.id=q."submissionFunctionId" JOIN "PluginCodingHomeworkSubmission" s ON s.id=q."submissionId" WHERE s."activityId"=${changed.id}`;
    expect(target).toMatchObject({ functionName: "provided_loader", functionCode: supplied.replace("7", "8") });

    const unchanged = await createHomework("Only unchanged provided code");
    const callsBefore = model.starts.length;
    const third = await openAndSubmit(unchanged, supplied);
    await expect.poll(async () => (await responseJson<{ submission: { processingStatus: string } }>(await student.get(`${third.endpoint}/workspace`))).submission.processingStatus, { timeout: 30_000 }).toBe("failed");
    expect(await responseJson(await student.get(`${third.endpoint}/workspace`))).toMatchObject({ submission: { generationIssue: "no_eligible_code" } });
    expect(model.starts).toHaveLength(callsBefore);
    const job = await prisma.backgroundJob.findFirstOrThrow({ where: { payload: { path: ["activityId"], equals: unchanged.id } } });
    expect(job.attempts).toBe(1);
    await page.goto(third.assigned.replace(/^\/api/, ""));
    await expect(page.getByText("No new or modified function could be identified for challenge questions. Contact your teacher to review the submission.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Answer challenge questions", exact: true })).toHaveCount(0);
  } finally {
    model.release();
    for (const id of activities) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: id } } });
    await student.dispose(); await model.close();
  }
});
