import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";
import type { CourseActivityAssignmentSettings, CourseTestRuntime } from "../../apps/web/src/lib/api";

test("compound Test applies live exceptions and ignores stale automatic submission", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, studentPage }) => {
  test.setTimeout(60_000);
  const studentApi = await createAuthenticatedApi("student");
  try {
    const title = `Live Test ${data.token}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title, lifecycle: "published", settings: { timeLimitMinutes: 30, navigationMode: "free", randomizeItems: false, allowResume: true },
      contentPlacement: { parentId: null, titleSnapshot: title, isVisible: true, position: 1, metadata: {} }
    } }));
    const activityId = created.activity.id;
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
      source: "local", activityTypeKey: "mcq", title: "Live addition", lifecycle: "published", config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 10, isRequired: true
    } }));
    await assignCourseTest(data, activityId, title);
    const settingsPath = `/api/courses/${data.courseId}/activities/${activityId}/assign-all-groups`;
    const assignedPath = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    await studentPage.goto(assignedPath.replace("/api", ""));
    await studentPage.getByRole("button", { name: "Start Test", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Start this Test now?" }).getByRole("button", { name: "Start Test", exact: true }).click();
    await studentPage.getByLabel("Four", { exact: true }).check();
    await expect(studentPage.getByRole("button", { name: "Open activity messages" })).toBeVisible();
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    const { runtime: initial } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.get(`${assignedPath}/test`));
    settings.general.timeLimitMinutes = 45;
    settings.general.assessmentMode = "summative";
    const section = settings.groups.find((group) => group.groupId === data.groupId)!;
    const student = section.students.find((participant) => participant.email === credentialsFor("student").email)!;
    section.exceptions = [{
      ...settings.general, participantId: student.id, teamId: null,
      overrideFields: ["timeLimit"], timeLimitMinutes: 60
    }];
    const update = { ...settings.general, groupAssignments: settings.groups };
    const rejected = await teacherApi.post(settingsPath, { data: update });
    expect(rejected.status()).toBe(409);
    await responseJson(await teacherApi.post(settingsPath, { data: { ...update, confirmActiveStudents: true } }));
    await expect(studentPage.getByRole("timer")).toContainText(/59:/, { timeout: 30_000 });
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
    const { runtime: extended } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.get(`${assignedPath}/test`));
    expect(extended.attempt!.id).toBe(initial.attempt!.id);
    expect(new Date(extended.timing.expiresAt!).getTime() - new Date(initial.timing.expiresAt!).getTime()).toBe(30 * 60_000);
    const { runtime: staleSubmission } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.post(`${assignedPath}/test/submit`, { data: {
      parentAttemptId: initial.attempt!.id, sessionId: "stale-browser", onlyIfExpired: true
    } }));
    expect(staleSubmission.attempt!.lifecycle).toBe("started");
    await studentPage.getByRole("button", { name: "Submit Test", exact: true }).click();
    await studentPage.getByRole("dialog").getByRole("button", { name: "Submit Test", exact: true }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    settings.general.timeLimitMinutes = 90;
    section.exceptions = [];
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, groupAssignments: settings.groups } }));
    const { runtime: previous } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.get(`${assignedPath}/test?view=previous`));
    expect(previous.timing.timeLimitMinutes).toBe(60);
    expect(previous.attempt!.id).toBe(initial.attempt!.id);
  } finally { await studentApi.dispose(); }
});
