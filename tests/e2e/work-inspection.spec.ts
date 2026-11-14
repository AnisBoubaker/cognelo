import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { parseMcqSource } from "../../packages/plugin-activities/plugin-mcq/src/mcq";
import type { WorkInspection, WorkInspectionBlock } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings, CourseTestRuntime } from "../../apps/web/src/lib/api";

test("inspect saved MCQ work before submission, refresh it, and keep it read-only", async ({ bankCourse: data, teacherPage: teacher }, info) => {
  const student = await createAuthenticatedApi("student");
  try {
    const participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, email: credentialsFor("student").email } });
    const question = parseMcqSource(ORIGINAL_SOURCE, "none").questions[0];
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
    const save = async (choice: string) => responseJson(await student.put(`${assigned}/draft`, { data: { state: { answers: { [question.id]: [question.choices.find(c => c.blocks.some(b => b.type === "paragraph" && b.text === choice))!.id] } } } }));
    await save("Four");
    const endpoint = `/api/courses/${data.courseId}/gradebook/activities/${data.activityId}/work-in-progress?groupId=${data.groupId}&participantId=${participant.id}`;
    expect((await student.get(endpoint)).status()).toBe(403);
    await teacher.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}`);
    await teacher.getByRole("button", { name: /^Actions for / }).click();
    await expect(teacher.getByRole("menuitem", { name: "Inspect attempts", exact: true })).toHaveCount(0);
    await teacher.getByRole("menuitem", { name: "Inspect work in progress", exact: true }).click();
    const dialog = teacher.getByRole("dialog", { name: "Inspect work in progress", exact: true });
    await expect(dialog).toContainText("☑ Four");
    await expect(dialog.getByRole("button", { name: /Save|Submit|Grade/ })).toHaveCount(0);
    await save("Five");
    await dialog.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(dialog).toContainText("☑ Five");
    expect(await prisma.activityAttempt.count({ where: { activityId: data.activityId } })).toBe(0);
    expect(await prisma.gradeEvent.count({ where: { gradebookItem: { activityId: data.activityId } } })).toBe(0);
    await teacher.screenshot({ path: info.outputPath("work-inspection-desktop.png") });
    await teacher.setViewportSize({ width: 390, height: 844 });
    await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeInViewport();
    expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await teacher.screenshot({ path: info.outputPath("work-inspection-mobile.png") });
    await teacher.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  } finally { await student.dispose(); }
});

for (const kind of ["coding-exercise", "web-design-coding-exercise"] as const) {
  test(`inspect ${kind} saved source without executing or submitting it`, async ({ bankCourse: data, teacherApi: api, teacherPage: teacher }) => {
    const student = await createAuthenticatedApi("student");
    try {
      const source = kind === "coding-exercise" ? 'print("SAVED_WITHOUT_SUBMIT")' : '<script>window.inspectionExecuted = true</script><main>SAVED_WITHOUT_SUBMIT</main>';
      const files = [{ id: "html", path: "index.html", language: "html", starterCode: source, isEditable: true, orderIndex: 0 }];
      const id = await createCourseActivity(data, { activityTypeKey: kind, title: "Read saved source", config: kind === "coding-exercise" ? { language: "python", prompt: "Write a program.", starterCode: "", sampleTests: [] } : { prompt: "Build a page.", previewEntry: "index.html", files } });
      await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "formative" } } }));
      await responseJson(await student.put(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/draft`, { data: { state: kind === "coding-exercise" ? { sourceCode: source } : { files } } }));
      await teacher.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
      await teacher.getByRole("button", { name: /^Actions for / }).click(); await teacher.getByRole("menuitem", { name: "Inspect work in progress", exact: true }).click();
      const dialog = teacher.getByRole("dialog", { name: "Inspect work in progress", exact: true });
      await expect(dialog).toContainText("SAVED_WITHOUT_SUBMIT");
      expect(await teacher.evaluate(() => (window as unknown as { inspectionExecuted?: boolean }).inspectionExecuted)).toBeUndefined();
      expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    } finally { await student.dispose(); }
  });
}

test("inspect a private Parsons arrangement without creating another attempt or event", async ({ bankCourse: data, teacherApi: api, teacherPage: teacher }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const id = await createCourseActivity(data, { activityTypeKey: "parsons-problem", title: "Read saved arrangement", config: { prompt: "Reorder the lines.", language: "python", solution: "value = 42\nprint(value)", groups: [], precedenceRules: [], stripIndentation: false } });
    await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "formative" } } }));
    await responseJson(await student.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/parsons/attempt`, { data: {} }));
    const counts = async () => (await prisma.$queryRaw<Array<{ attempts: bigint; events: bigint }>>`SELECT (SELECT count(*) FROM "PluginParsonsAttempt" WHERE "activityId"=${id}) AS attempts,(SELECT count(*) FROM "PluginParsonsAttemptEvent" e JOIN "PluginParsonsAttempt" a ON a.id=e."attemptId" WHERE a."activityId"=${id}) AS events`)[0];
    const before = await counts();
    await teacher.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    await teacher.getByRole("button", { name: /^Actions for / }).click(); await teacher.getByRole("menuitem", { name: "Inspect work in progress", exact: true }).click();
    const dialog = teacher.getByRole("dialog", { name: "Inspect work in progress", exact: true });
    await expect(dialog).toContainText("print(value)");
    await expect(dialog).not.toContainText("Correct answer"); await dialog.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(dialog).toContainText("value = 42"); expect(await counts()).toEqual(before);
  } finally { await student.dispose(); }
});

test("inspect an active Test one question at a time without grading or finalizing it", async ({ bankCourse: data, teacherApi: api, teacherPage: teacher }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const course = `/api/courses/${data.courseId}`;
    const created = await responseJson<{ test: { activity: { id: string } } }>(await api.post(`${course}/tests`, { data: { title: "Test saved work", lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true } } }));
    const id = created.test.activity.id;
    const first = await responseJson<{ item: { id: string } }>(await api.post(`${course}/activities/${id}/test/items`, { data: { source: "local", activityTypeKey: "coding-exercise", title: "Program", config: { language: "python", prompt: "Write a program.", starterCode: "", sampleTests: [] }, pointsPossible: 10 } }));
    const second = await responseJson<{ item: { id: string } }>(await api.post(`${course}/activities/${id}/test/items`, { data: { source: "local", activityTypeKey: "mcq", title: "Choices", config: { source: ORIGINAL_SOURCE }, pointsPossible: 10 } }));
    await assignCourseTest(data, id, "Test saved work");
    const assigned = `${course}/groups/${data.groupId}/activities/assigned/${id}`;
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await student.post(`${assigned}/test`, { data: { sessionId: data.token } }));
    const parentAttemptId = runtime.attempt!.id;
    const question = parseMcqSource(ORIGINAL_SOURCE, "none").questions[0];
    await responseJson(await student.put(`${assigned}/test/items/${first.item.id}`, { data: { parentAttemptId, sessionId: data.token, state: { sourceCode: "print('TEST_SAVED_CODE')" } } }));
    await responseJson(await student.put(`${assigned}/test/items/${second.item.id}`, { data: { parentAttemptId, sessionId: data.token, state: { answers: { [question.id]: [question.choices[0].id] } } } }));
    await teacher.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    await teacher.getByRole("button", { name: /^Actions for / }).click(); await teacher.getByRole("menuitem", { name: "Inspect work in progress", exact: true }).click();
    const dialog = teacher.getByRole("dialog", { name: "Inspect work in progress", exact: true });
    await expect(dialog).toContainText("TEST_SAVED_CODE");
    await dialog.getByLabel("Question", { exact: true }).selectOption(second.item.id); await expect(dialog).toContainText("☑ Four");
    const parent = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: parentAttemptId } });
    expect(parent.lifecycle).toBe("started"); expect(parent.submittedAt).toBeNull();
    expect(await prisma.gradeEvent.count({ where: { attemptId: parentAttemptId } })).toBe(0);
    const url = `${course}/gradebook/activities/${id}/work-in-progress?groupId=${data.groupId}&participantId=${parent.participantId}&testItemId=foreign`;
    expect((await api.get(url)).status()).toBe(404);
  } finally { await student.dispose(); }
});

test("inspect homework preparation and frozen files without starting answering; stale preview keys are rejected", async ({ bankCourse: data, teacherApi: api, teacherPage: teacher }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const course = `/api/courses/${data.courseId}`, id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Read homework in progress", config: {} });
    await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    const base = `${course}/activities/${id}`;
    const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(`${base}/assign-all-groups`))).settings;
    await responseJson(await api.post(`${base}/assign-all-groups`, { data: { ...settings.general, assessmentMode: "summative", submissionStages: { files: { enabled: true }, questions: { enabled: false } }, groupAssignments: settings.groups } }));
    const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int main(void) { return 7; }").toString("base64") } }));
    const participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, email: credentialsFor("student").email } });
    const inspection = `${course}/gradebook/activities/${id}/work-in-progress?groupId=${data.groupId}&participantId=${participant.id}`;
    const before = await responseJson<WorkInspection>(await api.get(inspection));
    const file = before.sections.flatMap(section => section.blocks).find((block): block is Extract<WorkInspectionBlock, { kind: "file" }> => block.kind === "file")!;
    expect(JSON.stringify(before)).not.toContain("storedName");
    await teacher.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    await teacher.getByRole("button", { name: /^Actions for / }).click(); await teacher.getByRole("menuitem", { name: "Inspect work in progress", exact: true }).click();
    const dialog = teacher.getByRole("dialog", { name: "Inspect work in progress", exact: true });
    await expect(dialog).toContainText("return 7;");
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 1, replace: true, base64: Buffer.from("int main(void) { return 8; }").toString("base64") } }));
    expect((await api.get(`${inspection}&file=${encodeURIComponent(file.key)}`)).status()).toBe(409);
    await dialog.getByRole("button", { name: "Refresh", exact: true }).click(); await expect(dialog).toContainText("return 8;");
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 2 } }));
    await dialog.getByRole("button", { name: "Refresh", exact: true }).click(); await expect(dialog).toContainText("return 8;");
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
  } finally { await student.dispose(); }
});

test("failed progress requests show an explicit error and Retry restores the badges", async ({ bankCourse: data, teacherPage: teacher }) => {
  let failing = true;
  await teacher.route("**/api/courses/**/gradebook?**", async route => {
    if (route.request().url().includes("includeProgress=1") && failing) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", systemCode: "SYS-001", message: "System error (SYS-001)." } }) });
    else await route.continue();
  });
  await teacher.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}`);
  await expect(teacher.getByText("Progress could not be loaded.", { exact: true })).toBeVisible();
  await expect(teacher.locator(".gradebook-progress-column")).toContainText("Unavailable");
  failing = false;
  await teacher.getByRole("tabpanel").getByRole("button", { name: "Retry", exact: true }).click();
  await expect(teacher.locator(".gradebook-progress-column")).toContainText("Not started");
  await expect(teacher.getByText("Progress could not be loaded.", { exact: true })).toHaveCount(0);
  failing = true;
  await expect(teacher.getByText("Progress could not be loaded.", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(teacher.locator(".gradebook-progress-column")).toContainText("Not started");
  await expect(teacher.locator(".gradebook-progress-column")).not.toContainText("Unavailable");
});
