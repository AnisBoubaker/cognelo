import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import type { Activity, CourseTest, CourseTestItem, CourseActivityAssignmentSettings, CourseTestRuntime } from "../../apps/web/src/lib/api";

test("live Test corrections preserve answers, audit changes, notify students and keep grades private", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, studentPage, teacherPage }) => {
  test.setTimeout(120_000);
  const studentApi = await createAuthenticatedApi("student");
  try {
    const title = `Live corrections ${data.token}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title, lifecycle: "published", settings: { timeLimitMinutes: 30 }, contentPlacement: { isVisible: true }
    } }));
    const activityId = created.activity.id, testPath = `/api/courses/${data.courseId}/activities/${activityId}/test`;
    const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacherApi.post(`${testPath}/items`, { data: {
      source: "local", activityTypeKey: "mcq", title: "Original question", lifecycle: "published",
      config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 10
    } }));
    await assignCourseTest(data, activityId, title);
    const settingsPath = `/api/courses/${data.courseId}/activities/${activityId}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, messagingEnabled: true, groupAssignments: settings.groups } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    await studentPage.goto(assigned.replace('/api', ''));
    await studentPage.getByRole("button", { name: "Start Test", exact: true }).click();
    await studentPage.getByRole("dialog").getByRole("button", { name: "Start Test", exact: true }).click();
    await studentPage.getByLabel("Five", { exact: true }).check();
    await responseJson(await studentApi.get(`${assigned}/messages`));
    const childPath = `/api/courses/${data.courseId}/activities/${item.activityId}`;
    const rejected = await teacherApi.patch(childPath, { data: { title: "Corrected question" } });
    expect(rejected.status()).toBe(409);
    expect((await rejected.json()).error.details.canNotifyStudents).toBe(true);
    // The ordinary editor uses the existing confirmation and optional message dialog.
    await teacherPage.goto(`/courses/${data.courseId}/activities/${activityId}`);
    const titleField = teacherPage.getByLabel("Title", { exact: true });
    await titleField.fill(`${title} revised`);
    await teacherPage.getByRole("button", { name: "Save test settings", exact: true }).click();
    const warning = teacherPage.getByRole("dialog", { name: "Students are answering" });
    await expect(warning).toBeVisible();
    await warning.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await responseJson<{ test: CourseTest }>(await teacherApi.get(testPath))).test.activity.title).toBe(title);
    const correctedSource = "## Addition\nUpdated question: choose five.\n\n- [x] Five\n- [ ] Four";
    await responseJson(await teacherApi.patch(childPath, { data: { title: "Corrected question", config: { source: correctedSource }, confirmActiveStudents: true, studentMessage: "The question and answer key have been corrected." } }));
    await expect(studentPage.getByRole("heading", { name: "Corrected question", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(studentPage.getByText("Updated question: choose five.", { exact: true })).toBeVisible();
    await expect(studentPage.getByLabel("Five", { exact: true })).toBeChecked();
    await studentPage.getByRole("button", { name: "Open activity messages" }).click();
    await expect(studentPage.getByText("The question and answer key have been corrected.")).toBeVisible();
    await studentPage.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    // New questions appear in active attempts and removal preserves their history.
    const { item: added } = await responseJson<{ item: { id: string } }>(await teacherApi.post(`${testPath}/items`, { data: {
      source: "local", activityTypeKey: "mcq", title: "Temporary question", config: { source: ORIGINAL_SOURCE }, confirmActiveStudents: true
    } }));
    const live = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.get(`${assigned}/test`));
    expect(live.runtime.test.items.map((entry) => entry.id)).toContain(added.id);
    await responseJson(await teacherApi.delete(`${testPath}/items/${added.id}`, { data: { confirmActiveStudents: true } }));
    expect(await prisma.testItem.findUnique({ where: { id: added.id } })).toMatchObject({ removedAt: expect.any(Date) });
    await responseJson(await teacherApi.patch(`${testPath}/items/${item.id}`, { data: { pointsPossible: 20, confirmActiveStudents: true } }));
    await studentPage.getByRole("button", { name: "Submit the test", exact: true }).click();
    await studentPage.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await studentPage.getByRole("dialog").getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    const parent = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId }, include: { testItemAttempts: true } });
    expect(parent.lifecycle).toBe("graded");
    expect(parent.testItemAttempts[0]).toMatchObject({ rawScore: 1, rawMaxScore: 1, normalizedScore: 20 });
    const { runtime: previous } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.get(`${assigned}/test?view=previous`));
    expect(previous.test.items[0].itemAttempt!.rawScore).toBeNull();
    const privateChild = await responseJson<{ itemAttempt: { rawScore: number | null } }>(await studentApi.get(`${assigned}/test/items/${item.id}?parentAttemptId=${parent.id}&sessionId=test`));
    expect(privateChild.itemAttempt.rawScore).toBeNull();
    await responseJson(await teacherApi.patch(childPath, { data: { title: "Future question", config: { source: ORIGINAL_SOURCE } } }));
    const after = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.get(`${assigned}/test?view=previous`));
    expect(after.runtime.test.items[0].activity.title).toBe("Corrected question");
    expect(await prisma.courseAuditEvent.count({ where: { courseId: data.courseId, targetId: item.activityId, eventType: "activity_content_updated" } })).toBe(2);
  } finally { await studentApi.dispose(); }
});

test("coding exercises without hidden tests submit standalone and inside a Test", async ({ bankCourse: data, teacherApi }) => {
  test.setTimeout(90_000);
  const studentApi = await createAuthenticatedApi("student");
  try {
    const { test: created } = await responseJson<{ test: CourseTest }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title: `No hidden tests ${data.token}`, lifecycle: "published", contentPlacement: { isVisible: true }
    } }));
    const parentId = created.activity.id;
    const { item } = await responseJson<{ item: CourseTestItem }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${parentId}/test/items`, { data: {
      source: "local", activityTypeKey: "coding-exercise", title: "Ungraded coding", config: { language: "python", prompt: "Write a program.", starterCode: "", sampleTests: [] }
    } }));
    await assignCourseTest(data, parentId, created.activity.title);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${parentId}`;
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.post(`${assigned}/test`, { data: { sessionId: "no-tests" } }));
    // Entirely unanswered coding work is also allowed at final submission.
    const submitted = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.post(`${assigned}/test/submit`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: "no-tests" } }));
    expect(submitted.runtime.attempt!.lifecycle).toBe("submitted");
    expect(submitted.runtime.test.items[0].itemAttempt!.rawScore).toBeNull();
    const attempt = await prisma.testItemAttempt.findFirstOrThrow({ where: { testItemId: item.id } });
    expect(attempt).toMatchObject({ lifecycle: "submitted", rawScore: null });
    const { activity } = await responseJson<{ activity: Activity }>(await teacherApi.post(`/api/courses/${data.courseId}/activities`, { data: {
      activityTypeKey: "coding-exercise", title: "Standalone without tests", lifecycle: "published", config: { language: "python", prompt: "Write a program.", sampleTests: [] }
    } }));
    await assignCourseTest(data, activity.id, activity.title);
    const standalone = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activity.id}`;
    const result = await responseJson<{ execution: { resultSummary: unknown } }>(await studentApi.post(`${standalone}/coding-exercises/submit`, { data: { sourceCode: "print('saved')" } }));
    expect(result.execution.resultSummary).toEqual({ gradingWithheld: true });
    expect(await prisma.activityAttempt.findFirst({ where: { activityId: activity.id } })).toMatchObject({ lifecycle: "submitted" });
  } finally { await studentApi.dispose(); }
});

test("standalone prompt edits preserve answers and summative grades require release", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage, studentPage }) => {
  test.setTimeout(90_000);
  const studentApi = await createAuthenticatedApi("student");
  try {
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
    await studentPage.goto(assigned.replace("/api", ""));
    await studentPage.getByLabel("Four", { exact: true }).check();
    await responseJson(await studentApi.get(`${assigned}/messages`));
    await teacherPage.goto(data.editorPath);
    await teacherPage.getByRole("textbox", { name: "Student prompt", exact: true }).fill("The prompt has been clarified while you are answering.");
    await teacherPage.getByRole("button", { name: "Save multiple choice questions", exact: true }).click();
    const warning = teacherPage.getByRole("dialog", { name: "Students are answering" });
    await expect(warning).toBeVisible();
    await warning.getByRole("button", { name: "Apply changes", exact: true }).click();
    await expect(studentPage.getByText("The prompt has been clarified while you are answering.", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Submit answers?" }).getByRole("button", { name: "Submit answers", exact: true }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/groups/${data.groupId}$`));
    let history = await responseJson<{ grade: unknown; attempts: Array<{ grade: unknown }> }>(await studentApi.get(`${assigned}/mcq/submission`));
    expect(history.grade).toBeNull();
    expect(history.attempts.every((attempt) => attempt.grade === null)).toBe(true);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: data.activityId } });
    const releasePath = `/api/courses/${data.courseId}/gradebook/items/${attempt.gradebookItemId}/release`;
    await responseJson(await teacherApi.patch(releasePath, { data: { released: true } }));
    history = await responseJson(await studentApi.get(`${assigned}/mcq/submission`));
    expect(history.grade).toMatchObject({ rawScore: 1, rawMaxScore: 1 });
    await responseJson(await teacherApi.patch(releasePath, { data: { released: false } }));
    history = await responseJson(await studentApi.get(`${assigned}/mcq/submission`));
    expect(history.grade).toBeNull();
  } finally { await studentApi.dispose(); }
});

test("hidden-test corrections during a Test are audited and used for final grading", async ({ bankCourse: data, teacherApi }) => {
  test.setTimeout(120_000);
  const studentApi = await createAuthenticatedApi("student");
  try {
    const { test: created } = await responseJson<{ test: CourseTest }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: { title: "Live coding correction", lifecycle: "published", contentPlacement: { isVisible: true } } }));
    const parentId = created.activity.id;
    const { item } = await responseJson<{ item: CourseTestItem }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${parentId}/test/items`, { data: {
      source: "local", activityTypeKey: "coding-exercise", title: "Corrected coding", config: { language: "python", prompt: "Print the requested value.", sampleTests: [] }
    } }));
    const privatePath = `/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`;
    const privateData = (value: string) => ({ tests: [{ id: "hidden-one", name: "Output", stdin: "", expectedOutput: value, isEnabled: true, weight: 1 }], referenceSolution: `print(${value})`, privateConfig: { templateSource: "{{ STUDENT_CODE }}" } });
    await responseJson(await teacherApi.put(privatePath, { data: privateData("1") }));
    await assignCourseTest(data, parentId, created.activity.title);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${parentId}`;
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.post(`${assigned}/test`, { data: { sessionId: "live-private" } }));
    await responseJson(await studentApi.put(`${assigned}/test/items/${item.id}`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: "live-private", state: { sourceCode: "print(2)" } } }));
    await responseJson(await studentApi.get(`${assigned}/messages`));
    expect((await teacherApi.put(privatePath, { data: privateData("2") })).status()).toBe(409);
    await responseJson(await teacherApi.put(privatePath, { data: { ...privateData("2"), confirmActiveStudents: true } }));
    await responseJson(await studentApi.post(`${assigned}/test/submit`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: "live-private" } }));
    expect(await prisma.testItemAttempt.findFirstOrThrow({ where: { testItemId: item.id } })).toMatchObject({ lifecycle: "graded", rawScore: 1, rawMaxScore: 1 });
    const audit = await prisma.courseAuditEvent.findMany({ where: { courseId: data.courseId, targetId: item.activityId, eventType: "activity_private_content_updated" } });
    expect(audit).toHaveLength(2);
    expect(JSON.stringify(audit)).not.toContain("print(");
    const revisions = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginCodingExerciseAuthoringRevision" WHERE "activityId" = ${item.activityId}`;
    expect(Number(revisions[0].count)).toBe(2);
  } finally { await studentApi.dispose(); }
});
