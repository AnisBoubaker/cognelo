import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings, CourseTest, CourseTestItem, CourseTestRuntime } from "../../apps/web/src/lib/api";

const answers = { "question-1": ["question-1-choice-1"] };
const closed = "This activity is closed. Its questions and answers are no longer available.";
const settingLabel = "Hide activity content when no further attempts are allowed";

test("opt-in closes the final submission and every review path while retaining released grades", async ({ bankCourse: data, teacherApi, teacherPage, studentPage }, testInfo) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student");
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
  const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
  try {
    const { asset } = await responseJson<{ asset: { url: string } }>(await teacherApi.post("/api/media-assets", { multipart: { file: {
      name: "exam.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
    } } }));
    await responseJson(await teacherApi.patch(data.courseActivityPath, { data: { description: `Private exam illustration ![Exam diagram](${asset.url})` } }));
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    expect(settings.general.hideAfterAttempts).toBe(false);
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", releaseSolution: true,
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 1 },
      groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] })) } }));
    await teacherPage.goto(`/courses/${data.courseId}`);
    await teacherPage.getByRole("button", { name: `Actions for ${data.title}`, exact: true }).click();
    await teacherPage.getByRole("menuitem", { name: "Settings", exact: true }).click();
    const dialog = teacherPage.getByRole("dialog", { name: data.title, exact: true });
    const toggle = dialog.getByRole("checkbox", { name: settingLabel, exact: true });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(dialog).toBeHidden();
    await studentPage.goto(assigned.replace("/api", ""));
    expect((await student.get(asset.url)).status()).toBe(200);
    await studentPage.getByLabel("Four", { exact: true }).check();
    const submission = studentPage.waitForResponse((response) => response.url().endsWith("/mcq/submission") && response.request().method() === "POST");
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Submit answers?" }).getByRole("button", { name: "Submit answers", exact: true }).click();
    expect(await (await submission).json()).toEqual({ activityContentClosed: true });
    await expect(studentPage.getByText(closed, { exact: true })).toBeVisible();
    await expect(studentPage.getByText("Attempt 1 submitted", { exact: false })).toBeVisible();
    await expect(studentPage.getByLabel("Four", { exact: true })).toHaveCount(0);
    await expect(studentPage.getByRole("tab", { name: "Previous submissions", exact: true })).toHaveCount(0);
    for (const suffix of ["", "/mcq/submission", "/draft", "/messages"]) {
      const response = await student.get(assigned + suffix);
      expect(response.status(), suffix).toBe(403);
      expect((await response.json()).error.code).toBe("ACTIVITY_CONTENT_CLOSED");
    }
    expect((await student.post(`${assigned}/mcq/submission`, { data: { answers } })).status()).toBe(403);
    expect((await student.post(`${assigned}/solution`)).status()).toBe(403);
    expect((await student.get(asset.url)).status()).toBe(403);
    expect(await responseJson(await student.get(`${assigned}/submissions`))).toEqual({ audit: { submittedAttemptCount: 1, deletedSubmissions: [] } });
    const group = await responseJson<{ group: { activities: Array<{ activityId: string; activity: { config: unknown; description: string; bankActivity: unknown; activityVersion: unknown } }> } }>(await student.get(`/api/courses/${data.courseId}/groups/${data.groupId}`));
    expect(group.group.activities.find((entry) => entry.activityId === data.activityId)?.activity).toMatchObject({ config: {}, description: "", bankActivity: null, activityVersion: null });
    expect((await teacherApi.get(assigned)).status()).toBe(200);
    const item = await prisma.gradebookItem.findFirstOrThrow({ where: { activityId: data.activityId, groupId: data.groupId } });
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/gradebook/items/${item.id}/release`, { data: { released: true } }));
    const grades = await responseJson<{ grades: { rows: Array<{ score: number; feedback: unknown; gradingReport: unknown; contentClosed: boolean }> } }>(await student.get(`/api/courses/${data.courseId}/groups/${data.groupId}/grades`));
    expect(grades.grades.rows).toEqual([expect.objectContaining({ score: 100, feedback: null, gradingReport: null, contentClosed: true })]);
    expect((await student.post(`${assigned}/solution`)).status()).toBe(403);
    await studentPage.reload();
    await expect(studentPage.getByText(closed, { exact: true })).toBeVisible();
    await expect(studentPage.getByText(/100 \/ 100/)).toBeVisible();
    await studentPage.screenshot({ path: testInfo.outputPath("closed-activity.png") });
    await studentPage.setViewportSize({ width: 390, height: 844 });
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await student.dispose(); }
});

test("extra attempts, live exceptions, reopened work, and teacher opt-out restore access", async ({ bankCourse: data, teacherApi, studentPage }) => {
  const student = await createAuthenticatedApi("student");
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
  const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
  try {
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    const policy = { ...settings.general, assessmentMode: "summative", hideAfterAttempts: true,
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 1 },
      groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] })), confirmActiveStudents: true };
    await responseJson(await teacherApi.post(settingsPath, { data: policy }));
    await responseJson(await student.post(`${assigned}/mcq/submission`, { data: { answers } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: data.activityId } });
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.getByText(closed, { exact: true })).toBeVisible();
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/reopen`, { data: {} }));
    await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
    await responseJson(await student.post(`${assigned}/mcq/submission`, { data: { answers } }));
    expect(await prisma.activityAttempt.count({ where: { activityId: data.activityId } })).toBe(1);
    await responseJson(await teacherApi.post(settingsPath, { data: { ...policy, groupAssignments: policy.groupAssignments.map((group) => group.groupId === data.groupId ? {
      ...group, exceptions: [{ participantId: attempt.participantId, overrideFields: ["attempts"], gradebookSettings: { attemptLimitMode: "max_attempts", maxAttempts: 2 } }]
    } : group) } }));
    expect((await student.get(assigned)).status()).toBe(200);
    await responseJson(await student.post(`${assigned}/mcq/submission`, { data: { answers } }));
    expect((await student.get(assigned)).status()).toBe(403);
    await responseJson(await teacherApi.post(settingsPath, { data: { ...policy, hideAfterAttempts: false } }));
    expect((await student.get(assigned)).status()).toBe(200);
    expect((await student.get(`${assigned}/mcq/submission`)).status()).toBe(200);
    await responseJson(await teacherApi.delete(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}`, { data: { reason: "Technical issue" } }));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...policy, availableUntil: new Date(Date.now() - 1000).toISOString() } }));
    const audit = await responseJson<{ audit: { deletedSubmissions: Array<{ reason: string; metadata: unknown }> } }>(await student.get(`${assigned}/submissions`));
    expect(audit.audit.deletedSubmissions).toEqual([expect.objectContaining({ reason: "Technical issue", metadata: {} })]);
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.getByText("Technical issue", { exact: true })).toBeVisible();
    await expect(studentPage.getByLabel("Four", { exact: true })).toHaveCount(0);
  } finally { await student.dispose(); }
});

for (const timeLimitMinutes of [10, null]) test(`a Test protects its children and finalizes after Until (duration ${timeLimitMinutes})`, async ({ bankCourse: data, teacherApi, studentPage }) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student");
  try {
    const { test: created } = await responseJson<{ test: CourseTest }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: { title: "Restricted exam", lifecycle: "published", contentPlacement: { isVisible: true } } }));
    const parentId = created.activity.id;
    const { item } = await responseJson<{ item: CourseTestItem }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${parentId}/test/items`, { data: { source: "local", activityTypeKey: "mcq", title: "Private exam question", config: { source: ORIGINAL_SOURCE, randomizeChoices: false } } }));
    await assignCourseTest(data, parentId, created.activity.title);
    const settingsPath = `/api/courses/${data.courseId}/activities/${parentId}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    const policy = { ...settings.general, hideAfterAttempts: true, timeLimitMinutes,
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 1 },
      groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] })), confirmActiveStudents: true };
    await responseJson(await teacherApi.post(settingsPath, { data: policy }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${parentId}`;
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await student.post(`${assigned}/test`, { data: { sessionId: "restricted-session" } }));
    expect(runtime.attempt).not.toBeNull();
    expect((await student.get(assigned)).status()).toBe(200);
    await responseJson(await student.put(`${assigned}/test/items/${item.id}`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: "restricted-session", state: { answers } } }));
    // The Until date closes access even though the duration still has time left.
    await responseJson(await teacherApi.post(settingsPath, { data: { ...policy, availableUntil: new Date(Date.now() - 1000).toISOString() } }));
    for (const path of [assigned, `${assigned}/test?view=previous`, `${assigned}/test?sessionId=restricted-session`]) expect((await student.get(path)).status()).toBe(403);
    const submitted = await responseJson(await student.post(`${assigned}/test/submit`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: "restricted-session", onlyIfExpired: true } }));
    expect(submitted).toEqual({ activityContentClosed: true });
    expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: runtime.attempt!.id } })).lifecycle).not.toBe("started");
    expect((await student.get(`${assigned}/test/items/${item.id}?parentAttemptId=${runtime.attempt!.id}`)).status()).toBe(403);
    expect((await student.get(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${item.activity.id}`)).status()).toBe(404);
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.getByText(closed, { exact: true })).toBeVisible();
    await expect(studentPage.getByText("Private exam question", { exact: true })).toHaveCount(0);
  } finally { await student.dispose(); }
});

test("closing dates block programming, Web Design, Parsons and homework content routes", async ({ bankCourse: data, teacherApi }) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student");
  try {
    for (const [activityTypeKey, paths] of [
      ["coding-exercise", ["coding-exercises/history", "coding-exercises/run", "coding-exercises/submit"]],
      ["web-design-coding-exercise", ["web-design-coding-exercises/submit", "web-design-coding-exercises/expected-result"]],
      ["parsons-problem", ["parsons/submissions"]],
      ["coding-homework-grader", ["coding-homework-grader/assignment", "coding-homework-grader/submission", "coding-homework-grader/activity-file?attachmentId=known-id", "coding-homework-grader/processing-job?jobId=known-id"]]
    ] as const) {
      const { activity } = await responseJson<{ activity: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/activities`, {
        data: { activityTypeKey, title: `Restricted ${activityTypeKey}`, lifecycle: "published", config: {} }
      }));
      const path = `/api/courses/${data.courseId}/activities/${activity.id}/assign-all-groups`;
      const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(path));
      await responseJson(await teacherApi.post(path, { data: { ...settings.general, hideAfterAttempts: true, availableUntil: "2000-01-01T00:00:00Z",
        groupAssignments: settings.groups.map((group) => ({ ...group, assigned: group.groupId === data.groupId, overrideFields: [] })) } }));
      const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activity.id}`;
      for (const suffix of ["", ...paths.map((value) => `/${value}`)]) {
        const response = await student.get(assigned + suffix);
        expect(response.status(), `${activityTypeKey}: ${suffix}`).toBe(403);
        expect((await response.json()).error.code).toBe("ACTIVITY_CONTENT_CLOSED");
      }
      expect((await teacherApi.get(assigned)).status()).toBe(200);
    }
  } finally { await student.dispose(); }
});

test("closing an expired standalone page preserves its saved answer as submitted work", async ({ bankCourse: data, teacherApi, studentPage }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    const policy = { ...settings.general, assessmentMode: "summative", hideAfterAttempts: true, timeLimitMinutes: 10,
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 1 },
      groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] })), confirmActiveStudents: true };
    await responseJson(await teacherApi.post(settingsPath, { data: policy }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
    const { runtime } = await responseJson<{ runtime: { attempt: { id: string } } }>(await student.post(`${assigned}/timing`));
    await responseJson(await student.put(`${assigned}/draft`, { data: { state: { answers } } }));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...policy, availableUntil: new Date(Date.now() - 60_000).toISOString() } }));
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.getByText(closed, { exact: true })).toBeVisible();
    await expect.poll(async () => (await prisma.activityAttempt.findUniqueOrThrow({ where: { id: runtime.attempt.id } })).lifecycle).toBe("submitted");
    const saved = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: runtime.attempt.id } });
    expect(saved.metadata).toMatchObject({ savedResponse: { answers } });
    await expect(studentPage.getByText("Attempt 1 submitted", { exact: false })).toBeVisible();
    expect((await student.get(`${assigned}/draft`)).status()).toBe(403);
  } finally { await student.dispose(); }
});

test("closing an expired Test page recovers persisted child answers without disclosing them", async ({ bankCourse: data, teacherApi, studentPage }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const { test: created } = await responseJson<{ test: CourseTest }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: { title: "Expired restricted exam", lifecycle: "published", contentPlacement: { isVisible: true } } }));
    const parentId = created.activity.id;
    const { item } = await responseJson<{ item: CourseTestItem }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${parentId}/test/items`, { data: { source: "local", activityTypeKey: "mcq", title: "Saved private question", config: { source: ORIGINAL_SOURCE, randomizeChoices: false } } }));
    await assignCourseTest(data, parentId, created.activity.title);
    const settingsPath = `/api/courses/${data.courseId}/activities/${parentId}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    const policy = { ...settings.general, hideAfterAttempts: true, timeLimitMinutes: null,
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 1 },
      groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] })), confirmActiveStudents: true };
    await responseJson(await teacherApi.post(settingsPath, { data: policy }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${parentId}`;
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await student.post(`${assigned}/test`, { data: { sessionId: "recovery-session" } }));
    await responseJson(await student.put(`${assigned}/test/items/${item.id}`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: "recovery-session", state: { answers } } }));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...policy, availableUntil: new Date(Date.now() - 60_000).toISOString() } }));
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.getByText(closed, { exact: true })).toBeVisible();
    await expect.poll(async () => (await prisma.activityAttempt.findUniqueOrThrow({ where: { id: runtime.attempt!.id } })).lifecycle).toBe("submitted");
    const child = await prisma.testItemAttempt.findUniqueOrThrow({ where: { parentAttemptId_testItemId: { parentAttemptId: runtime.attempt!.id, testItemId: item.id } } });
    expect(child.result).toMatchObject({ state: { answers } });
    expect((await student.get(`${assigned}/test?view=previous`)).status()).toBe(403);
    await expect(studentPage.getByText("Attempt 1 submitted", { exact: false })).toBeVisible();
  } finally { await student.dispose(); }
});
