import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { prisma } from "@cognelo/db";

for (const origin of ["content", "gradebook"] as const) {
  test(`untimed activity progress has its own column when opened from ${origin}`, async ({ bankCourse: data, teacherPage: teacher, studentPage: student }, info) => {
    test.setTimeout(90_000);
    await teacher.goto(`/courses/${data.courseId}?tab=${origin}`);
    await teacher.getByRole("tabpanel", { name: origin === "content" ? "Content" : "Gradebook", exact: true }).getByRole("link", { name: data.title, exact: true }).click();
    await teacher.getByRole("tab", { name: "Student results", exact: true }).click();
    const row = teacher.locator(".table-row-gradebook-detail").filter({ hasText: credentialsFor("student").email });
    const progress = row.locator(".gradebook-progress-column");
    await expect(progress).toHaveText("●Not started");
    await student.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`);
    await student.getByLabel("Four", { exact: true }).check();
    await expect(progress).toContainText("In progress", { timeout: 25_000 });
    const progressBox = await progress.boundingBox(), gradeBox = await row.locator(".gradebook-grade-cell").boundingBox();
    expect(progressBox && gradeBox && progressBox.x + progressBox.width <= gradeBox.x).toBe(true);
    await student.getByRole("button", { name: "Submit", exact: true }).click();
    await student.getByRole("dialog", { name: "Submit answers?", exact: true }).getByRole("button", { name: "Submit answers", exact: true }).click();
    await expect(progress).toContainText("Done", { timeout: 20_000 });
    await teacher.screenshot({ path: info.outputPath(`progress-${origin}-desktop.png`) });
    await teacher.setViewportSize({ width: 900, height: 1000 });
    await expect(teacher.locator(".table-list-gradebook-detail .table-head")).toBeHidden();
    const rowBox = await row.boundingBox(), actionBox = await row.getByRole("button", { name: /^Actions for / }).boundingBox();
    expect(rowBox && actionBox && actionBox.x + actionBox.width <= rowBox.x + rowBox.width).toBe(true);
    await teacher.setViewportSize({ width: 390, height: 844 });
    await expect(teacher.locator(".table-list-gradebook-detail .table-head")).toBeHidden();
    await expect(progress).toBeVisible();
    await progress.scrollIntoViewIfNeeded();
    expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await teacher.screenshot({ path: info.outputPath(`progress-${origin}-mobile.png`) });
  });
}

test("homework tracks preparation, submitted files, cancellation and file-only completion before grading", async ({ bankCourse: data, teacherApi: api, teacherPage: teacher }) => {
  test.setTimeout(150_000);
  const student = await createAuthenticatedApi("student");
  try {
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Homework progress", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${id}`, plugin = `${base}/coding-homework-grader`;
    const current = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${plugin}/authoring`));
    await responseJson(await api.put(`${plugin}/authoring`, { data: { assignment: current.assignment, requirements: { requiredFiles: [{ path: "main.c" }] } } }));
    await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(`${base}/assign-all-groups`))).settings;
    await responseJson(await api.post(`${base}/assign-all-groups`, { data: { ...settings.general, assessmentMode: "summative", submissionStages: { files: { enabled: true }, questions: { enabled: false } }, groupAssignments: settings.groups } }));
    await teacher.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    const row = teacher.locator(".table-row-gradebook-detail").filter({ hasText: credentialsFor("student").email });
    const progress = row.locator(".gradebook-progress-column");
    await expect(progress).toContainText("Not started");
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    const endpoint = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", fileName: "main.c", expectedRevision: 0, base64: Buffer.from("int main(void) { return 0; }\n").toString("base64") } }));
    await expect(progress).toContainText("File submission: in progress", { timeout: 20_000 });
    const handin = await responseJson<{ submission: { id: string } }>(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    await expect(progress).toContainText("File submission: submitted", { timeout: 20_000 });
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    expect(await prisma.backgroundJob.count({ where: { payload: { path: ["activityId"], equals: id } } })).toBe(0);
    await responseJson(await api.delete(`${plugin}/manage-submissions`, { data: { submissionId: handin.submission.id, reason: "Retry as file-only" } }));
    await expect(progress).toContainText("File submission: in progress", { timeout: 20_000 });
    const latest = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${plugin}/authoring`));
    await responseJson(await api.put(`${plugin}/authoring`, { data: { assignment: { ...latest.assignment, settings: { ...(latest.assignment.settings as object), questionGenerationEnabled: false } }, requirements: { requiredFiles: [{ path: "main.c" }] } } }));
    // Changing question mode deliberately closes submission; explicitly reopen files.
    const reopened = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(`${base}/assign-all-groups`))).settings;
    await responseJson(await api.post(`${base}/assign-all-groups`, { data: { ...reopened.general, submissionStages: { files: { enabled: true }, questions: { enabled: false } }, groupAssignments: reopened.groups } }));
    const preparation = await responseJson<{ draft: { revision: number } }>(await student.get(`${endpoint}/preparation`));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: preparation.draft.revision } }));
    await expect(progress).toContainText("Done", { timeout: 20_000 });
    await expect(row.locator(".gradebook-grade-cell")).toContainText("-");
    expect(await prisma.activityAttempt.count({ where: { activityId: id, lifecycle: "submitted" } })).toBe(1);
  } finally { await student.dispose(); }
});

test("Parsons progress reads private arrangements and recognizes new work after a formative check", async ({ bankCourse: data, teacherApi: api }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const id = await createCourseActivity(data, { activityTypeKey: "parsons-problem", title: "Arrangement progress", config: {
      language: "python", prompt: "Reorder these lines.", solution: "value = 42\nprint(value)", groups: [], precedenceRules: [], stripIndentation: false
    } });
    await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "formative" } } }));
    const endpoint = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/parsons/attempt`;
    const progress = async () => (await responseJson<{ progress: Array<{ state: string }> }>(await api.get(`/api/courses/${data.courseId}/gradebook?view=in-progress-attempts&includeProgress=1&activityId=${id}`))).progress[0].state;
    expect(await progress()).toBe("not_started");
    const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginParsonsAttempt" WHERE "activityId"=${id}`;
    expect(Number(count)).toBe(0);
    const { attempt } = await responseJson<{ attempt: { id: string; latestState: unknown } }>(await student.post(endpoint, { data: {} }));
    expect(await progress()).toBe("in_progress");
    await responseJson(await student.patch(endpoint, { data: { attemptId: attempt.id, state: attempt.latestState, event: { type: "check" } } }));
    expect(await progress()).toBe("done");
    await responseJson(await student.patch(endpoint, { data: { attemptId: attempt.id, state: attempt.latestState, event: { type: "move" } } }));
    expect(await progress()).toBe("in_progress");
    await responseJson(await student.patch(endpoint, { data: { attemptId: attempt.id, state: attempt.latestState, submit: true, complete: true } }));
    expect(await progress()).toBe("done");
  } finally { await student.dispose(); }
});
