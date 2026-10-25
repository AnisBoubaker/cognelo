import type { APIRequestContext, Locator, Page } from "@playwright/test";
import type { StudentGroupingDto, StudentGroupingStudent } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { prisma } from "@cognelo/db";
import { test as base, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";

type ExceptionsData = { student: StudentGroupingStudent; first: StudentGroupingDto; second: StudentGroupingDto; settingsPath: string; assignedPath: string };
const test = base.extend<{ exceptionData: ExceptionsData; studentApi: APIRequestContext }>({
  studentApi: async ({}, provide) => {
    const api = await createAuthenticatedApi("student");
    try { await provide(api); } finally { await api.dispose(); }
  },
  exceptionData: async ({ bankCourse: data, teacherApi: api }, provide) => {
    const path = `/api/courses/${data.courseId}/groups/${data.groupId}/groupings`;
    const { students } = await responseJson<{ students: StudentGroupingStudent[] }>(await api.get(path));
    const student = students.find((student) => student.email === credentialsFor("student").email)!;
    const groupings: StudentGroupingDto[] = [];
    for (const title of ["Private accommodations", "Project teams"]) {
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(path, { data: {
        title, visibleToStudents: false, teams: [{ title: "Team 1", participantIds: [student.id] }]
      } }));
      groupings.push(grouping);
    }
    await provide({ student, first: groupings[0]!, second: groupings[1]!, settingsPath: `${data.courseActivityPath}/assign-all-groups`, assignedPath: `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}` });
  }
});

async function settings(api: APIRequestContext, path: string) {
  return (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(path))).settings;
}
async function save(api: APIRequestContext, path: string, value: CourseActivityAssignmentSettings, confirmSummativeToFormative = false) {
  await responseJson(await api.post(path, { data: { ...value.general, groupAssignments: value.groups, confirmSummativeToFormative } }));
}
async function openSettings(page: Page, courseId: string, title: string) {
  await page.goto(`/courses/${courseId}?tab=content`);
  await page.getByRole("button", { name: `Actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await expect(dialog.getByRole("button", { name: "Save settings", exact: true })).toBeEnabled();
  return dialog;
}
async function setTimeLimit(editor: Locator, minutes: string) {
  await editor.getByRole("checkbox", { name: "Time limit", exact: true }).check();
  await editor.getByRole("checkbox", { name: /Limit the time for each attempt/ }).check();
  await editor.getByLabel("Time limit (minutes)", { exact: true }).fill(minutes);
}

test.describe("team and student activity exceptions", { tag: "@regression" }, () => {
  test("applies live section and student timing with a cancellable warning and optional message", async ({ teacherPage, studentPage, teacherApi, studentApi, bankCourse: data, exceptionData: ex }) => {
    test.setTimeout(90_000);
    const value = await settings(teacherApi, ex.settingsPath);
    value.general.assessmentMode = "summative";
    value.general.timeLimitMinutes = 30;
    value.general.messagingEnabled = true;
    await save(teacherApi, ex.settingsPath, value);
    await studentPage.goto(ex.assignedPath.replace("/api", ""));
    await studentPage.getByRole("button", { name: "Start timed attempt" }).click();
    await studentPage.getByLabel("Four", { exact: true }).check();
    // Starting an attempt makes presence eligible on the shared 20-second heartbeat.
    await expect(studentPage.getByRole("button", { name: "Open activity messages" })).toBeVisible({ timeout: 30_000 });
    const before = await responseJson<{ runtime: { attempt: { id: string }; timing: { expiresAt: string } } }>(await studentApi.get(`${ex.assignedPath}/timing`));
    const dialog = await openSettings(teacherPage, data.courseId, data.title);
    await dialog.getByLabel("Time limit (minutes)", { exact: true }).fill("60");
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    const warning = teacherPage.getByRole("dialog", { name: "Students are answering", exact: true });
    await expect(warning).toBeVisible();
    await warning.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await settings(teacherApi, ex.settingsPath)).general.timeLimitMinutes).toBe(30);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    await warning.getByLabel("Message to students (optional)").fill("You now have one hour in total.");
    await warning.getByRole("button", { name: "Apply settings", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(studentPage.getByRole("timer")).toContainText(/59:/, { timeout: 30_000 });
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
    await studentPage.getByRole("button", { name: /Open activity messages/ }).click();
    const messages = studentPage.getByRole("dialog", { name: "Activity messages", exact: true });
    await expect(messages.getByText("You now have one hour in total.")).toBeVisible();
    await messages.getByRole("button", { name: "Close", exact: true }).click();
    const updated = await settings(teacherApi, ex.settingsPath);
    updated.groups[0]!.exceptions.push({ ...updated.general, teamId: null, participantId: ex.student.id, overrideFields: ["timeLimit"], timeLimitMinutes: 75 });
    await responseJson(await teacherApi.post(ex.settingsPath, { data: { ...updated.general, groupAssignments: updated.groups, confirmActiveStudents: true } }));
    await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(studentPage.getByRole("timer")).toContainText(/01:14:\d{2}/);
    const after = await responseJson<typeof before>(await studentApi.get(`${ex.assignedPath}/timing`));
    expect(after.runtime.attempt.id).toBe(before.runtime.attempt.id);
    expect(new Date(after.runtime.timing.expiresAt).getTime() - new Date(before.runtime.timing.expiresAt).getTime()).toBe(45 * 60_000);
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
    updated.groups[0]!.exceptions[0]!.timeLimitMinutes = null;
    await responseJson(await teacherApi.post(ex.settingsPath, { data: { ...updated.general, groupAssignments: updated.groups, confirmActiveStudents: true } }));
    await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(studentPage.getByRole("timer")).toHaveCount(0);
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
    updated.groups[0]!.exceptions[0]!.overrideFields.push("visibility");
    updated.groups[0]!.exceptions[0]!.contentPlacement = { isVisible: false, metadata: {} };
    await responseJson(await teacherApi.post(ex.settingsPath, { data: { ...updated.general, groupAssignments: updated.groups, confirmActiveStudents: true, studentMessage: "The activity is paused briefly." } }));
    await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeHidden();
    await expect(studentPage.getByRole("button", { name: /Open activity messages/ })).toBeVisible();
    await studentPage.getByRole("button", { name: /Open activity messages/ }).click();
    await expect(studentPage.getByRole("dialog", { name: "Activity messages", exact: true }).getByText("The activity is paused briefly.")).toBeVisible({ timeout: 10_000 });
    await studentPage.getByRole("dialog", { name: "Activity messages", exact: true }).getByRole("button", { name: "Close", exact: true }).click();
    updated.groups[0]!.exceptions[0]!.contentPlacement.isVisible = true;
    updated.groups[0]!.exceptions[0]!.timeLimitMinutes = 75;
    await responseJson(await teacherApi.post(ex.settingsPath, { data: { ...updated.general, groupAssignments: updated.groups, confirmActiveStudents: true } }));
    await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Submit answers?" }).getByRole("button", { name: "Submit answers", exact: true }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    const submitted = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: before.runtime.attempt.id } });
    expect(submitted.metadata).toMatchObject({ timeLimitSnapshotMinutes: 30, submittedTimeLimitMinutes: 75 });
    updated.general.timeLimitMinutes = 90;
    updated.groups[0]!.exceptions = [];
    await save(teacherApi, ex.settingsPath, updated);
    expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: submitted.id } })).metadata).toEqual(submitted.metadata);
  });

  test("refreshes extra student attempts on an already-open blocked page", async ({ studentPage, teacherApi, bankCourse: data, exceptionData: ex }) => {
    test.setTimeout(60_000);
    const value = await settings(teacherApi, ex.settingsPath);
    value.general.assessmentMode = "summative";
    value.general.gradebookSettings.attemptLimitMode = "max_attempts";
    value.general.gradebookSettings.maxAttempts = 1;
    await save(teacherApi, ex.settingsPath, value);
    await studentPage.goto(ex.assignedPath.replace("/api", ""));
    await studentPage.getByLabel("Four", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Submit answers?" }).getByRole("button", { name: "Submit answers", exact: true }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    await studentPage.goto(ex.assignedPath.replace("/api", ""));
    await expect(studentPage.getByRole("tab", { name: "Previous submissions", exact: true })).toBeVisible();
    await expect(studentPage.getByRole("tab", { name: "New attempt", exact: true })).toHaveCount(0);
    const updated = await settings(teacherApi, ex.settingsPath);
    updated.groups[0]!.exceptions.push({ ...updated.general, teamId: null, participantId: ex.student.id, overrideFields: ["attempts"], gradebookSettings: { ...updated.general.gradebookSettings, maxAttempts: 2 } });
    await save(teacherApi, ex.settingsPath, updated);
    await expect(studentPage.getByRole("tab", { name: "New attempt", exact: true })).toBeVisible({ timeout: 30_000 });
    await studentPage.getByRole("tab", { name: "New attempt", exact: true }).click();
    await expect(studentPage.getByRole("button", { name: "Submit", exact: true })).toBeEnabled();
  });

  test("edits and prioritizes team exceptions, applies student precedence, cancels drafts, and updates a started deadline", async ({ teacherPage: page, teacherApi, studentApi, bankCourse: data, exceptionData: ex }) => {
    const initial = await settings(teacherApi, ex.settingsPath);
    initial.general.assessmentMode = "summative";
    initial.general.timeLimitMinutes = 10;
    await save(teacherApi, ex.settingsPath, initial);
    let dialog = await openSettings(page, data.courseId, data.title);
    await dialog.getByRole("tab", { name: "Exceptions", exact: true }).click();
    await dialog.getByLabel("Section", { exact: true }).selectOption(data.groupId);
    const teamSection = dialog.getByRole("region", { name: "Team exceptions", exact: true });
    const studentSection = dialog.getByRole("region", { name: "Student exceptions", exact: true });
    const editor = dialog.getByRole("region", { name: "Exception settings", exact: true });
    await teamSection.getByLabel("Choose a team").selectOption(ex.first.teams[0]!.id);
    await teamSection.getByRole("button", { name: "Add exception", exact: true }).click();
    await setTimeLimit(editor, "20");
    await teamSection.getByLabel("Choose a team").selectOption(ex.second.teams[0]!.id);
    await teamSection.getByRole("button", { name: "Add exception", exact: true }).click();
    await setTimeLimit(editor, "30");
    await teamSection.getByRole("button", { name: "Higher priority for Project teams · Team 1", exact: true }).click();
    await studentSection.getByLabel("Choose a student").selectOption(ex.student.id);
    await studentSection.getByRole("button", { name: "Add exception", exact: true }).click();
    await setTimeLimit(editor, "40");
    await expect(editor.locator(".activity-override-field")).toHaveCount(10);
    expect((await settings(teacherApi, ex.settingsPath)).groups[0]!.exceptions).toEqual([]);
    await dialog.locator(".activity-settings-content").evaluate((element) => { element.scrollTop = 0; });
    await dialog.screenshot({ path: test.info().outputPath("activity-exceptions-desktop.png") });
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(dialog).toBeHidden();
    const saved = await settings(teacherApi, ex.settingsPath);
    expect(saved.groups[0]!.exceptions.map((exception) => exception.teamId ?? exception.participantId)).toEqual([ex.second.teams[0]!.id, ex.first.teams[0]!.id, ex.student.id]);
    const runtime = await responseJson<{ runtime: { timeLimitMinutes: number; timing: { expiresAt: string }; attempt: { id: string } } }>(await studentApi.post(`${ex.assignedPath}/timing`));
    expect(runtime.runtime.timeLimitMinutes).toBe(40);
    dialog = await openSettings(page, data.courseId, data.title);
    await dialog.getByRole("tab", { name: "Exceptions", exact: true }).click();
    await dialog.getByRole("region", { name: "Student exceptions" }).getByRole("button", { name: /^Remove exception/ }).click();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).last().click();
    expect((await settings(teacherApi, ex.settingsPath)).groups[0]!.exceptions).toHaveLength(3);
    dialog = await openSettings(page, data.courseId, data.title);
    await dialog.getByRole("tab", { name: "Exceptions", exact: true }).click();
    await dialog.getByRole("region", { name: "Student exceptions" }).getByRole("button", { name: /^Remove exception/ }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await dialog.locator(".activity-settings-content").evaluate((element) => { element.scrollTop = 0; });
    await dialog.screenshot({ path: test.info().outputPath("activity-exceptions-mobile.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(dialog).toBeHidden();
    const assigned = await responseJson<{ activity: { assignment: { metadata: { timeLimitMinutes: number } } } }>(await studentApi.get(ex.assignedPath));
    expect(assigned.activity.assignment.metadata.timeLimitMinutes).toBe(30);
    const resumed = await responseJson<typeof runtime>(await studentApi.get(`${ex.assignedPath}/timing`));
    expect(resumed.runtime.timeLimitMinutes).toBe(30);
    expect(new Date(resumed.runtime.timing.expiresAt).getTime()).toBe(new Date(runtime.runtime.timing.expiresAt).getTime() - 10 * 60_000);
  });

  test("enforces all exception policies in learner access, attempts, grading, and challenges without exposing private targets", async ({ teacherApi, studentApi, bankCourse: data, exceptionData: ex }) => {
    const value = await settings(teacherApi, ex.settingsPath);
    value.general = { ...value.general, assessmentMode: "summative", availableFrom: "2035-01-01T00:00:00.000Z", availableUntil: "2036-01-01T00:00:00.000Z", timeLimitMinutes: 10, requireSafeExamBrowser: true, contentPlacement: { ...value.general.contentPlacement, isVisible: false }, gradebookSettings: { ...value.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 1 } };
    const group = value.groups[0]!;
    group.overrideFields = [];
    group.exceptions = [{ teamId: ex.first.teams[0]!.id,
      overrideFields: ["availableFrom", "availableUntil", "timeLimit", "visibility", "requireSafeExamBrowser", "gradeChallenges", "pointsPossible", "grading", "attempts", "gradeStrategy"],
      availableFrom: null, availableUntil: null, timeLimitMinutes: null, contentPlacement: { isVisible: true, metadata: {} }, requireSafeExamBrowser: false, gradeChallengesEnabled: true,
      gradebookSettings: { pointsPossible: 50, gradingMode: "pass_fail", passThresholdPoints: 50, passThresholdOutOf: 50, attemptLimitMode: "max_attempts", maxAttempts: 2, gradeStrategy: "first", dropLowestAttempt: false }
    }, { participantId: ex.student.id, overrideFields: ["pointsPossible", "grading", "attempts", "gradeStrategy", "gradeChallenges"], gradeChallengesEnabled: false,
      gradebookSettings: { pointsPossible: 20, gradingMode: "pass_fail", passThresholdPoints: 0, passThresholdOutOf: 20, attemptLimitMode: "max_attempts", maxAttempts: 3, gradeStrategy: "best", dropLowestAttempt: false }
    }];
    await save(teacherApi, ex.settingsPath, value);
    const activity = await responseJson<{ activity: { assignment: { availableFrom: null; availableUntil: null; metadata: Record<string, unknown> } } }>(await studentApi.get(ex.assignedPath));
    expect(activity.activity.assignment).toMatchObject({ availableFrom: null, availableUntil: null, metadata: { timeLimitMinutes: null, requireSafeExamBrowser: false, gradeChallengesEnabled: false } });
    expect(JSON.stringify(activity)).not.toContain(ex.first.teams[0]!.id);
    expect(JSON.stringify(activity)).not.toContain("assignmentExceptions");
    const content = await responseJson<{ contentItems: Array<{ courseGroupActivityId: string }> }>(await studentApi.get(`/api/courses/${data.courseId}/groups/${data.groupId}/content?visibleOnly=true`));
    expect(content.contentItems.some((item) => item.courseGroupActivityId === data.assignmentId)).toBe(true);
    const runtime = await responseJson<{ runtime: { timeLimitMinutes: null; availability: { maxAttempts: number } } }>(await studentApi.get(`${ex.assignedPath}/timing`));
    expect(runtime.runtime.timeLimitMinutes).toBeNull(); expect(runtime.runtime.availability.maxAttempts).toBe(3);
    for (const choice of [2, 1, 2]) await responseJson(await studentApi.post(`${ex.assignedPath}/mcq/submission`, { data: { answers: { "question-1": [`question-1-choice-${choice}`] } } }));
    expect((await studentApi.post(`${ex.assignedPath}/mcq/submission`, { data: { answers: { "question-1": ["question-1-choice-1"] } } })).status()).toBe(409);
    const grade = await prisma.grade.findFirstOrThrow({ where: { participantId: ex.student.id, gradebookItem: { activityId: data.activityId } }, include: { selectedAttempt: true } });
    expect(grade).toMatchObject({ normalizedScore: 20, normalizedMaxScore: 20, isPass: true, selectedAttempt: { attemptNumber: 2, isLate: false } });
    const firstEvent = await prisma.gradeEvent.findFirstOrThrow({ where: { participantId: ex.student.id, gradebookItemId: grade.gradebookItemId, eventType: "auto_graded" }, orderBy: { createdAt: "asc" } });
    expect(firstEvent.nextValue).toMatchObject({ isPass: true, normalizedScore: 0 });
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/gradebook/items/${grade.gradebookItemId}/release`, { data: { released: true } }));
    const challenge = await studentApi.post(`/api/courses/${data.courseId}/gradebook/attempts/${grade.selectedAttemptId}/challenges`, { data: { feedbackRef: "unused", feedbackVersion: 1, explanation: "Please review this grading decision for this submission." } });
    expect(challenge.status()).toBe(409); expect(await challenge.json()).toMatchObject({ error: { code: "GRADE_CHALLENGES_DISABLED" } });
    group.exceptions[1]!.gradeChallengesEnabled = true;
    await save(teacherApi, ex.settingsPath, value);
    const grades = await responseJson<{ grades: { rows: Array<{ gradeChallengesEnabled: boolean }> } }>(await studentApi.get(`/api/courses/${data.courseId}/groups/${data.groupId}/grades`));
    expect(grades.grades.rows[0]!.gradeChallengesEnabled).toBe(true);
    group.exceptions[1]!.overrideFields.push("visibility"); group.exceptions[1]!.contentPlacement = { isVisible: false, metadata: {} };
    await save(teacherApi, ex.settingsPath, value);
    expect((await studentApi.get(ex.assignedPath)).status()).toBe(403);
    const hiddenContent = await responseJson<typeof content>(await studentApi.get(`/api/courses/${data.courseId}/groups/${data.groupId}/content?visibleOnly=true`));
    expect(hiddenContent.contentItems.some((item) => item.courseGroupActivityId === data.assignmentId)).toBe(false);
  });

  test("inherits cleared section dates, follows current team membership, and rejects invalid exception windows atomically", async ({ teacherApi, studentApi, bankCourse: data, exceptionData: ex }) => {
    const value = await settings(teacherApi, ex.settingsPath);
    value.general = { ...value.general, assessmentMode: "summative", availableFrom: "2035-01-01T00:00:00.000Z", availableUntil: "2036-01-01T00:00:00.000Z", timeLimitMinutes: 10 };
    const group = value.groups[0]!;
    group.overrideFields = ["availableFrom", "availableUntil", "timeLimit"];
    group.availableFrom = null; group.availableUntil = null; group.timeLimitMinutes = 15;
    group.exceptions = [{ teamId: ex.first.teams[0]!.id, overrideFields: ["timeLimit"], timeLimitMinutes: 30 }];
    await save(teacherApi, ex.settingsPath, value);
    const reopened = await settings(teacherApi, ex.settingsPath);
    expect(reopened.groups[0]).toMatchObject({ availableFrom: null, availableUntil: null, timeLimitMinutes: 15 });
    await save(teacherApi, ex.settingsPath, reopened);
    const learnerTime = async () => (await responseJson<{ activity: { assignment: { metadata: { timeLimitMinutes: number } } } }>(await studentApi.get(ex.assignedPath))).activity.assignment.metadata.timeLimitMinutes;
    expect(await learnerTime()).toBe(30);
    const groupingPath = `/api/courses/${data.courseId}/groups/${data.groupId}/groupings/${ex.first.id}`;
    const { grouping: empty } = await responseJson<{ grouping: StudentGroupingDto }>(await teacherApi.patch(groupingPath, { data: { ...ex.first, teams: ex.first.teams.map((team) => ({ ...team, participantIds: [] })) } }));
    expect(await learnerTime()).toBe(15);
    for (const target of [{ teamId: empty.teams[0]!.id }, { participantId: ex.student.id }]) {
      const invalid = await teacherApi.post(ex.settingsPath, { data: { ...value.general, timeLimitMinutes: 99, groupAssignments: [{ ...group, exceptions: [{ ...target, overrideFields: ["availableFrom", "availableUntil"], availableFrom: "2036-01-01T00:00:00.000Z", availableUntil: "2035-01-01T00:00:00.000Z" }] }] } });
      expect(invalid.status()).toBe(400);
      expect(await invalid.json()).toMatchObject({ error: { code: "INVALID_AVAILABILITY_WINDOW" } });
      expect((await settings(teacherApi, ex.settingsPath)).general.timeLimitMinutes).toBe(10);
    }
    await responseJson(await teacherApi.patch(groupingPath, { data: { ...empty, teams: empty.teams.map((team) => ({ ...team, participantIds: [ex.student.id] })) } }));
    expect(await learnerTime()).toBe(30);
  });

  test("rejects unauthorized and foreign targets atomically, retains omitted exceptions, and cleans up deleted targets", async ({ teacherApi, studentApi, bankCourse: data, exceptionData: ex }) => {
    const value = await settings(teacherApi, ex.settingsPath);
    value.general.assessmentMode = "summative";
    value.groups[0]!.exceptions = [{ teamId: ex.first.teams[0]!.id, overrideFields: ["timeLimit"], timeLimitMinutes: 25 }, { participantId: ex.student.id, overrideFields: ["gradeChallenges"], gradeChallengesEnabled: true }];
    await save(teacherApi, ex.settingsPath, value);
    expect((await studentApi.post(ex.settingsPath, { data: { ...value.general, groupAssignments: value.groups } })).status()).toBe(403);
    const { group: other } = await responseJson<{ group: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/groups`, { data: { title: "Other section" } }));
    const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacherApi.post(`/api/courses/${data.courseId}/groups/${other.id}/groupings`, { data: { title: "Other grouping", teams: [{ title: "Other team" }] } }));
    const { participant: foreign } = await responseJson<{ participant: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/groups/${other.id}/participants`, { data: { email: `exception-pending-${data.token}@example.test`, firstName: "Other", lastName: "Student", role: "student" } }));
    for (const target of [{ teamId: grouping.teams[0]!.id }, { participantId: foreign.id }, { teamId: ex.first.teams[0]!.id, participantId: ex.student.id }]) {
      const invalid = await teacherApi.post(ex.settingsPath, { data: { ...value.general, timeLimitMinutes: 99, groupAssignments: [{ ...value.groups[0], exceptions: [{ ...target, overrideFields: ["timeLimit"], timeLimitMinutes: 90 }] }] } });
      expect(invalid.status()).toBe(400);
      const unchanged = await settings(teacherApi, ex.settingsPath);
      expect(unchanged.general.timeLimitMinutes).toBe(value.general.timeLimitMinutes);
      expect(unchanged.groups.find((group) => group.groupId === data.groupId)!.exceptions).toHaveLength(2);
    }
    const legacy = value.groups.map(({ exceptions: _exceptions, ...group }) => group);
    await responseJson(await teacherApi.post(ex.settingsPath, { data: { ...value.general, groupAssignments: legacy } }));
    expect((await settings(teacherApi, ex.settingsPath)).groups.find((group) => group.groupId === data.groupId)!.exceptions).toHaveLength(2);
    await responseJson(await teacherApi.delete(`/api/courses/${data.courseId}/groups/${data.groupId}/groupings/${ex.first.id}`, { data: { revision: ex.first.revision } }));
    expect(await prisma.activityAssignmentException.count({ where: { groupActivityId: data.assignmentId, teamId: ex.first.teams[0]!.id } })).toBe(0);
    const current = await settings(teacherApi, ex.settingsPath);
    current.general.assessmentMode = "formative";
    await save(teacherApi, ex.settingsPath, current, true);
    expect((await settings(teacherApi, ex.settingsPath)).groups.find((group) => group.groupId === data.groupId)!.exceptions[0]!.overrideFields).toEqual([]);
    await responseJson(await teacherApi.delete(`/api/courses/${data.courseId}/groups/${data.groupId}/participants/${ex.student.id}`));
    expect(await prisma.activityAssignmentException.count({ where: { groupActivityId: data.assignmentId } })).toBe(0);
  });
});
