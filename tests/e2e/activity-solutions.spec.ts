import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

test("formative solution is opt-in, explicit, and revocable without losing the answer", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage, studentPage }) => {
  test.setTimeout(120_000);
  const studentApi = await createAuthenticatedApi("student");
  const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
  const readSettings = async () => (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath))).settings;
  try {
    const initial = await readSettings();
    expect(initial.general.releaseSolution).toBe(false);
    await responseJson(await teacherApi.post(settingsPath, { data: { ...initial.general, assessmentMode: "formative", confirmSummativeToFormative: true, groupAssignments: initial.groups } }));
    expect((await studentApi.post(`${assigned}/solution`)).status()).toBe(403);
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.getByRole("tab", { name: "Solution", exact: true })).toBeHidden();
    await studentPage.getByLabel("Five", { exact: true }).check();
    await teacherPage.goto(`/courses/${data.courseId}?tab=content`);
    await teacherPage.getByRole("button", { name: `Actions for ${data.title}` }).click();
    await teacherPage.getByRole("menuitem", { name: "Settings", exact: true }).click();
    const dialog = teacherPage.getByRole("dialog", { name: data.title, exact: true });
    await expect(dialog.getByRole("checkbox", { name: "Release solution", exact: true })).not.toBeChecked();
    await dialog.getByRole("checkbox", { name: "Release solution", exact: true }).check();
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    const warning = teacherPage.getByRole("dialog", { name: "Students are answering", exact: true });
    await warning.getByRole("button", { name: "Apply settings", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect((await readSettings()).general.releaseSolution).toBe(true);
    expect(await responseJson(await studentApi.get(`${assigned}/solution`))).toEqual({ available: true });
    await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    const tab = studentPage.getByRole("tab", { name: "Solution", exact: true });
    await expect(tab).toBeVisible();
    let reveals = 0;
    studentPage.on("request", (request) => { if (request.url().endsWith("/solution") && request.method() === "POST") reveals++; });
    await tab.click();
    const panel = studentPage.getByRole("tabpanel", { name: "Solution", exact: true });
    await expect(panel.getByText("Try it yourself first", { exact: true })).toBeVisible();
    expect(reveals).toBe(0);
    expect(await prisma.activityAttempt.count({ where: { activityId: data.activityId } })).toBe(0);
    await panel.getByRole("button", { name: "Show solution", exact: true }).click();
    await expect(panel.getByRole("checkbox", { checked: true })).toHaveCount(1);
    expect(reveals).toBe(1);
    await studentPage.screenshot({ path: "tmp/solution-desktop.png", fullPage: true });
    await studentPage.setViewportSize({ width: 390, height: 844 });
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await studentPage.screenshot({ path: "tmp/solution-mobile.png", fullPage: true });
    await studentPage.setViewportSize({ width: 1280, height: 720 });
    await studentPage.getByRole("tab", { name: "New attempt", exact: true }).click();
    await expect(studentPage.getByLabel("Five", { exact: true })).toBeChecked();
    await studentPage.getByRole("button", { name: "Check answers", exact: true }).click();
    await expect(studentPage.getByText("Missed correct answer.", { exact: true })).toBeHidden();
    await expect(studentPage.getByTitle("Missed correct answer.")).toBeHidden();
    await tab.click();
    await panel.getByRole("button", { name: "Show solution", exact: true }).click();
    const enabled = await readSettings();
    const { releaseSolution: _omitted, ...legacy } = enabled.general;
    await responseJson(await teacherApi.post(settingsPath, { data: { ...legacy, groupAssignments: enabled.groups, confirmActiveStudents: true } }));
    expect((await readSettings()).general.releaseSolution).toBe(true);
    await responseJson(await teacherApi.post(settingsPath, { data: { ...enabled.general, releaseSolution: false, groupAssignments: enabled.groups, confirmActiveStudents: true } }));
    expect((await studentApi.post(`${assigned}/solution`)).status()).toBe(403);
    await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(tab).toBeHidden();
    await expect(panel).toBeHidden();
  } finally { await studentApi.dispose(); }
});

test("summative solutions require both releases and repeatable grades stay private", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, studentPage }) => {
  test.setTimeout(90_000);
  const studentApi = await createAuthenticatedApi("student");
  const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
  try {
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    const update = { ...settings.general, assessmentMode: "summative", releaseSolution: true,
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 3 },
      groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] })), confirmActiveStudents: true };
    await responseJson(await teacherApi.post(settingsPath, { data: update }));
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.getByRole("tab", { name: "Solution", exact: true })).toBeHidden();
    expect((await studentApi.post(`${assigned}/solution`)).status()).toBe(403);
    await responseJson(await studentApi.post(`${assigned}/mcq/submission`, { data: { answers: { "question-1": ["question-1-choice-1"] } } }));
    const hidden = await responseJson<{ grades: { rows: unknown[] } }>(await studentApi.get(`/api/courses/${data.courseId}/groups/${data.groupId}/grades`));
    expect(hidden.grades.rows).toEqual([]);
    const item = await prisma.gradebookItem.findFirstOrThrow({ where: { activityId: data.activityId, groupId: data.groupId } });
    const release = `/api/courses/${data.courseId}/gradebook/items/${item.id}/release`;
    await responseJson(await teacherApi.patch(release, { data: { released: true } }));
    expect(await responseJson(await studentApi.get(`${assigned}/solution`))).toEqual({ available: true });
    await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    const tab = studentPage.getByRole("tab", { name: "Solution", exact: true });
    await expect(tab).toBeVisible();
    await tab.click();
    await studentPage.getByRole("button", { name: "Show solution", exact: true }).click();
    await expect(studentPage.getByRole("tabpanel").getByRole("checkbox", { checked: true })).toHaveCount(1);
    await responseJson(await teacherApi.patch(release, { data: { released: false } }));
    await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(tab).toBeHidden();
    expect((await studentApi.post(`${assigned}/solution`)).status()).toBe(403);
    await responseJson(await teacherApi.post(settingsPath, { data: { ...update, releaseSolution: false } }));
    await responseJson(await teacherApi.patch(release, { data: { released: true } }));
    expect((await studentApi.post(`${assigned}/solution`)).status()).toBe(403);
    await studentPage.reload();
    await expect(tab).toBeHidden();
  } finally { await studentApi.dispose(); }
});

test("one Test switch reveals only the supported child solutions", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, studentPage }) => {
  test.setTimeout(120_000);
  const studentApi = await createAuthenticatedApi("student");
  try {
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title: `Solutions ${data.token}`, lifecycle: "published", contentPlacement: { isVisible: true }
    } }));
    const id = created.activity.id;
    const items = [
      { activityTypeKey: "mcq", title: "MCQ solution", config: { source: ORIGINAL_SOURCE } },
      { activityTypeKey: "parsons-problem", title: "Parsons solution", config: { prompt: "Reorder these lines.", solution: "value = 42\nprint(value)", language: "python" } },
      { activityTypeKey: "coding-exercise", title: "Programming solution", config: { language: "python", prompt: "Print the answer.", starterCode: "", sampleTests: [] } },
      { activityTypeKey: "web-design-coding-exercise", title: "Web solution", config: { prompt: "Build this page.", files: [{ id: "html", path: "index.html", language: "html", starterCode: "<p>Start</p>", isEditable: true, orderIndex: 0 }] } }
    ];
    for (const item of items) {
      const { item: child } = await responseJson<{ item: { activityId: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${id}/test/items`, { data: { source: "local", ...item } }));
      const childPath = `/api/courses/${data.courseId}/activities/${child.activityId}`;
      if (item.activityTypeKey === "coding-exercise") await responseJson(await teacherApi.put(`${childPath}/coding-exercises/hidden-tests`, { data: { tests: [], referenceSolution: 'print("reference-program")', privateConfig: { templateCode: "{{ STUDENT_CODE }}" } } }));
      if (item.activityTypeKey === "web-design-coding-exercise") await responseJson(await teacherApi.put(`${childPath}/web-design-coding-exercises/tests`, { data: { tests: [], referenceFiles: [{ id: "html", path: "index.html", language: "html", starterCode: "<p>reference-web</p>", isEditable: true, orderIndex: 0 }] } }));
      expect((await studentApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${child.activityId}/solution`)).ok()).toBe(false);
    }
    await assignCourseTest(data, id, "Solutions");
    const settingsPath = `/api/courses/${data.courseId}/activities/${id}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, releaseSolution: true, groupAssignments: settings.groups } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    expect((await studentApi.post(`${assigned}/solution`)).status()).toBe(403);
    const grade = await prisma.gradebookItem.findFirstOrThrow({ where: { activityId: id, groupId: data.groupId } });
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/gradebook/items/${grade.id}/release`, { data: { released: true } }));
    const result = await responseJson<{ solution: { activities: unknown[] } }>(await studentApi.post(`${assigned}/solution`));
    expect(result.solution.activities).toHaveLength(4);
    expect(JSON.stringify(result)).not.toMatch(/privateConfig|validationSummary|expectedOutput|testCode/);
    await studentPage.goto(assigned.replace("/api", ""));
    await studentPage.getByRole("tab", { name: "Solution", exact: true }).click();
    await studentPage.getByRole("button", { name: "Show solution", exact: true }).click();
    const panel = studentPage.getByRole("tabpanel", { name: "Solution", exact: true });
    for (const item of items) await expect(panel.getByRole("heading", { name: item.title, exact: true })).toBeVisible();
    await expect(panel.getByText('print("reference-program")', { exact: false })).toBeVisible();
    await expect(panel.getByText("reference-web", { exact: false })).toBeVisible();
    await studentPage.screenshot({ path: "tmp/solution-test.png", fullPage: true });
  } finally { await studentApi.dispose(); }
});

test("Programming Homework has no solution setting or learner tab", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage, studentPage }) => {
  const studentApi = await createAuthenticatedApi("student");
  try {
    const title = `Homework without solution ${data.token}`;
    const { activity } = await responseJson<{ activity: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/activities`, {
      data: { activityTypeKey: "coding-homework-grader", title, lifecycle: "published", contentPlacement: { isVisible: true } }
    }));
    const settingsPath = `/api/courses/${data.courseId}/activities/${activity.id}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: {
      ...settings.general, assessmentMode: "formative", releaseSolution: true,
      groupAssignments: settings.groups.map((group) => ({ ...group, assigned: group.groupId === data.groupId }))
    } }));
    const saved = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    expect(saved.settings.general.releaseSolution).toBe(false);
    await teacherPage.goto(`/courses/${data.courseId}?tab=content`);
    await teacherPage.getByRole("button", { name: `Actions for ${title}` }).click();
    await teacherPage.getByRole("menuitem", { name: "Settings", exact: true }).click();
    await expect(teacherPage.getByRole("dialog", { name: title }).getByRole("checkbox", { name: "Release solution", exact: true })).toBeHidden();
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activity.id}`;
    expect(await responseJson(await studentApi.get(`${assigned}/solution`))).toEqual({ available: false });
    expect((await studentApi.post(`${assigned}/solution`)).status()).toBe(403);
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(studentPage.getByRole("tab", { name: "Solution", exact: true })).toBeHidden();
  } finally { await studentApi.dispose(); }
});
