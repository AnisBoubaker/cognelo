import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

test("file-only guidance shows only applicable file timing and completes without a question stage", async ({ bankCourse: data, teacherApi: api, studentPage: page }, info) => {
  const student = await createAuthenticatedApi("student");
  try {
    const course = `/api/courses/${data.courseId}`;
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "File-only stage guide", config: {} });
    const base = `${course}/activities/${id}`, plugin = `${base}/coding-homework-grader`;
    const authored = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${plugin}/authoring`));
    await responseJson(await api.put(`${plugin}/authoring`, { data: { assignment: { ...authored.assignment, settings: { questionGenerationEnabled: false } }, requirements: { requiredFiles: [{ path: "main.c" }] } } }));
    await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(`${base}/assign-all-groups`))).settings;
    const deadline = new Date(Date.now() + 3_600_000).toISOString();
    await responseJson(await api.post(`${base}/assign-all-groups`, { data: { ...settings.general, assessmentMode: "summative", availableUntil: new Date(Date.now() + 7_200_000).toISOString(),
      submissionStages: { files: { enabled: true, timeLimitMinutes: 15, deadline }, questions: { enabled: false, timeLimitMinutes: 25, requireSafeExamBrowser: true } }, groupAssignments: settings.groups } }));
    const assigned = `${course}/groups/${data.groupId}/activities/assigned/${id}`;
    await page.goto(assigned.replace(/^\/api/, ""));
    const guide = page.getByRole("region", { name: "How to complete this homework", exact: true });
    const files = guide.getByRole("region", { name: "Submit your work", exact: true });
    await expect(guide).toContainText("No challenge questions are required.");
    await expect(guide.getByRole("listitem")).toHaveCount(1);
    await expect(files).toContainText("Up to 15 minutes");
    await expect(files.locator(`time[datetime="${deadline}"]`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Answer challenge questions", exact: true })).toHaveCount(0);
    await expect(guide).not.toContainText("Safe Exam Browser");
    await page.screenshot({ path: info.outputPath("file-only-guide-desktop.png") });
    const endpoint = `${assigned}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", fileName: "main.c", expectedRevision: 0, base64: Buffer.from("int main(void) { return 0; }").toString("base64") } }));
    await page.reload(); await expect(files).toContainText("Your file-submission time limit has started.");
    const state = await responseJson<{ submissionClosesAt: string; preparationStartedAt: string }>(await student.get(`${endpoint}/workspace`));
    expect(Date.parse(state.submissionClosesAt)).toBe(Date.parse(state.preparationStartedAt) + 15 * 60_000);
    await expect(files.locator(`time[datetime="${state.submissionClosesAt}"]`)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 }); await guide.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("file-only-guide-mobile.png") });
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    await page.reload(); await expect(files).toContainText("Submitted");
    await expect(guide.getByRole("listitem")).toHaveCount(1);
    expect(await prisma.activityAttempt.count({ where: { activityId: id, lifecycle: "submitted" } })).toBe(1);
  } finally { await student.dispose(); }
});

test("two-stage guidance distinguishes not activated from disabled and omits absent timing", async ({ bankCourse: data, teacherApi: api, studentPage: page }, info) => {
  const course = `/api/courses/${data.courseId}`;
  const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Two-stage homework guide", config: {} });
  const base = `${course}/activities/${id}`, plugin = `${base}/coding-homework-grader`;
  await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
  const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(`${base}/assign-all-groups`))).settings;
  await responseJson(await api.post(`${base}/assign-all-groups`, { data: { ...settings.general, assessmentMode: "summative", availableUntil: null,
    submissionStages: { files: { enabled: false, timeLimitMinutes: null, deadline: null }, questions: { enabled: false, timeLimitMinutes: null, deadline: null, requireSafeExamBrowser: false } }, groupAssignments: settings.groups } }));
  await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`);
  const guide = page.getByRole("region", { name: "How to complete this homework", exact: true });
  await expect(guide).toContainText("This homework has two stages.");
  await expect(guide.getByRole("listitem")).toHaveCount(2);
  await expect(guide.getByRole("region", { name: "Submit your work", exact: true })).toContainText("Awaiting teacher activation");
  await expect(guide.getByRole("region", { name: "Answer challenge questions", exact: true })).toContainText("Awaiting teacher activation");
  await expect(guide).not.toContainText("Time allowed"); await expect(guide.locator("time")).toHaveCount(0);
  await expect(guide).not.toContainText("timer starts"); await expect(guide).not.toContainText("Safe Exam Browser");
  await expect(page.getByRole("button", { name: "Answer challenge questions", exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath("two-stage-guide-desktop.png") });
  const answerDeadline = new Date(Date.now() + 7_200_000).toISOString(), overallDeadline = new Date(Date.now() + 3_600_000).toISOString();
  settings.general.availableUntil = overallDeadline;
  settings.general.submissionStages = { ...settings.general.submissionStages, files: { enabled: false }, questions: { enabled: false, timeLimitMinutes: 20, deadline: answerDeadline, requireSafeExamBrowser: true } };
  settings.general.assessmentMode = "summative";
  await responseJson(await api.post(`${base}/assign-all-groups`, { data: { ...settings.general, groupAssignments: settings.groups } }));
  await expect(guide).toContainText("Safe Exam Browser is required", { timeout: 10_000 });
  const questions = guide.getByRole("region", { name: "Answer challenge questions", exact: true });
  await expect(questions).toContainText("Up to 20 minutes");
  await expect(questions.locator(`time[datetime="${overallDeadline}"]`)).toBeVisible();
  expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
  const authored = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${plugin}/authoring`));
  await responseJson(await api.put(`${plugin}/authoring`, { data: { assignment: { ...authored.assignment, settings: { ...(authored.assignment.settings as object), questionGenerationEnabled: false } }, requirements: {} } }));
  await expect(guide).toContainText("No challenge questions are required.", { timeout: 10_000 });
  await expect(guide.getByRole("listitem")).toHaveCount(1); await expect(guide).not.toContainText("Safe Exam Browser");
});
