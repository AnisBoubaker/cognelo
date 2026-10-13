import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings, CourseTestRuntime } from "../../apps/web/src/lib/api";

for (const policy of ["untimed", "general extension", "student exception"] as const) {
  const timed = policy !== "untimed";
  test(`reopens the last submission with ${policy} without a new attempt`, { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage, studentPage }) => {
    const studentApi = await createAuthenticatedApi("student");
    try {
      const path = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
      if (timed) {
        const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(`${data.courseActivityPath}/assign-all-groups`));
        settings.general.timeLimitMinutes = 30;
        settings.general.assessmentMode = "summative";
        await responseJson(await teacherApi.post(`${data.courseActivityPath}/assign-all-groups`, { data: { ...settings.general, groupAssignments: settings.groups } }));
      }
      const report = `/courses/${data.courseId}/gradebook/activities/${data.activityId}${timed ? "?origin=content&report=students" : ""}`;
      await teacherPage.goto(report);
      await teacherPage.getByRole("button", { name: /Actions for .*Student/ }).first().click();
      await expect(teacherPage.getByRole("menuitem", { name: "Reopen last submission" })).toHaveCount(0);
      await teacherPage.keyboard.press("Escape");
      await studentPage.goto(path.replace("/api", ""));
      if (timed) await studentPage.getByRole("button", { name: "Start timed attempt" }).click();
      await studentPage.getByLabel("Four", { exact: true }).check();
      await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
      await studentPage.getByRole("dialog", { name: "Submit answers?" }).getByRole("button", { name: "Submit answers", exact: true }).click();
      await expect(studentPage).toHaveURL(new RegExp(`/groups/${data.groupId}$`));
      const before = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: data.activityId } });
      if (timed) {
        const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(`${data.courseActivityPath}/assign-all-groups`));
        settings.general.timeLimitMinutes = policy === "student exception" ? 45 : 60;
        if (policy === "student exception") {
          const section = settings.groups.find((group) => group.groupId === data.groupId)!;
          section.exceptions = [{ ...settings.general, teamId: null, participantId: before.participantId, overrideFields: ["timeLimit"], timeLimitMinutes: 60 }];
        }
        await responseJson(await teacherApi.post(`${data.courseActivityPath}/assign-all-groups`, { data: { ...settings.general, groupAssignments: settings.groups } }));
      } else {
        await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/gradebook/items/${before.gradebookItemId}/release`, { data: { released: true } }));
      }
      const itemBefore = await prisma.gradebookItem.findUniqueOrThrow({ where: { id: before.gradebookItemId } });
      const reopenPath = `/api/courses/${data.courseId}/gradebook/attempts/${before.id}/reopen`;
      expect((await studentApi.post(reopenPath)).status()).toBe(403);
      await teacherPage.reload();
      await teacherPage.getByRole("button", { name: /Actions for .*Student/ }).first().click();
      await teacherPage.getByRole("menuitem", { name: "Reopen last submission" }).click();
      const confirmation = teacherPage.getByRole("dialog", { name: "Reopen last submission" });
      await expect(confirmation).toContainText("Expired deadlines still apply");
      await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
      expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: before.id } })).lifecycle).toBe("graded");
      await teacherPage.getByRole("button", { name: /Actions for .*Student/ }).first().click();
      await teacherPage.getByRole("menuitem", { name: "Reopen last submission" }).click();
      await confirmation.getByRole("button", { name: "Reopen last submission", exact: true }).click();
      await expect(teacherPage.getByText("The last submission has been reopened.", { exact: true })).toBeVisible();
      const reopened = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: before.id } });
      expect(reopened).toMatchObject({ lifecycle: "started", attemptNumber: before.attemptNumber, startedAt: before.startedAt, submittedAt: null, gradedAt: null });
      expect(await prisma.gradebookItem.findUniqueOrThrow({ where: { id: before.gradebookItemId } })).toEqual(itemBefore);
      expect(await prisma.grade.findFirst({ where: { selectedAttemptId: before.id, isActive: true } })).toBeNull();
      expect((await teacherApi.post(reopenPath)).status()).toBe(409);
      await studentPage.goto(path.replace("/api", ""));
      await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
      await expect(studentPage.getByRole("button", { name: "Submit", exact: true })).toBeEnabled();
      if (timed) await expect(studentPage.getByRole("timer")).toContainText(/59:/);
      if (timed) {
        const { runtime } = await responseJson<{ runtime: { timing: { expiresAt: string } } }>(await studentApi.get(`${path}/timing`));
        expect(runtime.timing.expiresAt).toBe(new Date(before.startedAt.getTime() + 60 * 60_000).toISOString());
      }
      await studentPage.getByLabel("Five", { exact: true }).check();
      await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
      await studentPage.getByRole("dialog", { name: "Submit answers?" }).getByRole("button", { name: "Submit answers", exact: true }).click();
      await expect(studentPage).toHaveURL(new RegExp(`/groups/${data.groupId}$`));
      const attempts = await prisma.activityAttempt.findMany({ where: { activityId: data.activityId } });
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({ id: before.id, attemptNumber: before.attemptNumber, startedAt: before.startedAt, lifecycle: "graded" });
      const grade = await prisma.grade.findFirstOrThrow({ where: { selectedAttemptId: before.id, isActive: true } });
      expect(grade.normalizedScore).toBe(0);
      const audit = await prisma.gradeEvent.findFirstOrThrow({ where: { attemptId: before.id, eventType: "submission_reopened" } });
      expect(audit.previousValue).toMatchObject({ attempt: { lifecycle: "graded", submittedAt: before.submittedAt!.toISOString() } });
      await studentPage.goto(path.replace("/api", ""));
      await expect(studentPage.getByRole("tab", { name: "New attempt", exact: true })).toHaveCount(0);
    } finally { await studentApi.dispose(); }
  });
}

test("reopens all compound Test answers and resubmits the same sitting", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, studentPage }) => {
  const studentApi = await createAuthenticatedApi("student");
  try {
    const title = `Reopen Test ${data.token}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title, lifecycle: "published", settings: { timeLimitMinutes: 30, navigationMode: "free", randomizeItems: false, allowResume: false },
      contentPlacement: { parentId: null, titleSnapshot: title, isVisible: true, position: 1, metadata: {} }
    } }));
    const activityId = created.activity.id;
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
      source: "local", activityTypeKey: "mcq", title: "Addition", lifecycle: "published", config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 10, isRequired: true
    } }));
    await assignCourseTest(data, activityId, title);
    const path = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    await studentPage.goto(path.replace("/api", ""));
    await studentPage.getByRole("button", { name: "Start Test", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Start this Test now?" }).getByRole("button", { name: "Start Test", exact: true }).click();
    await studentPage.getByLabel("Four", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Submit Test", exact: true }).click();
    await studentPage.getByRole("dialog").getByRole("button", { name: "Submit Test", exact: true }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/groups/${data.groupId}$`));
    const before = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId }, include: { testItemAttempts: true } });
    const settingsPath = `/api/courses/${data.courseId}/activities/${activityId}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    settings.general.timeLimitMinutes = 45;
    const section = settings.groups.find((group) => group.groupId === data.groupId)!;
    section.exceptions = [{ ...settings.general, teamId: null, participantId: before.participantId, overrideFields: ["timeLimit"], timeLimitMinutes: 60 }];
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, groupAssignments: settings.groups } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/gradebook/attempts/${before.id}/reopen`));
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.get(`${path}/test?sessionId=new-session`));
    expect(runtime.attempt).toMatchObject({ id: before.id, lifecycle: "started", startedAt: before.startedAt.toISOString() });
    expect(runtime.resume.blocked).toBe(false);
    expect(runtime.timing.expiresAt).toBe(new Date(before.startedAt.getTime() + 60 * 60_000).toISOString());
    expect(runtime.test.items[0]!.itemAttempt!.lifecycle).toBe("started");
    expect(runtime.test.items[0]!.itemAttempt!.state).toEqual((before.testItemAttempts[0]!.result as { state: unknown }).state);
    await studentPage.goto(path.replace("/api", ""));
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
    await studentPage.getByLabel("Five", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Submit Test", exact: true }).click();
    await studentPage.getByRole("dialog").getByRole("button", { name: "Submit Test", exact: true }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/groups/${data.groupId}$`));
    expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(1);
    const after = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: before.id }, include: { testItemAttempts: true } });
    expect(after.startedAt).toEqual(before.startedAt);
    expect(after.testRevisionId).toBe(before.testRevisionId);
    expect(after.testItemAttempts[0]!.id).toBe(before.testItemAttempts[0]!.id);
    expect((await prisma.grade.findFirstOrThrow({ where: { selectedAttemptId: before.id } })).normalizedScore).toBe(0);
  } finally { await studentApi.dispose(); }
});

test("concurrent reopen is atomic and does not extend an expired deadline", { tag: "@regression" }, async ({ bankCourse: data, teacherApi }) => {
  const studentApi = await createAuthenticatedApi("student");
  try {
    const path = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(`${data.courseActivityPath}/assign-all-groups`));
    settings.general.assessmentMode = "summative";
    settings.general.timeLimitMinutes = 30;
    await responseJson(await teacherApi.post(`${data.courseActivityPath}/assign-all-groups`, { data: { ...settings.general, groupAssignments: settings.groups } }));
    await responseJson(await studentApi.post(`${path}/timing`));
    await responseJson(await studentApi.post(`${path}/mcq/submission`, { data: { answers: {} } }));
    const before = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: data.activityId } });
    const originalStart = new Date(Date.now() - 31 * 60_000);
    // Backdate this disposable fixture to exercise real server expiry without waiting 30 minutes.
    await prisma.activityAttempt.update({ where: { id: before.id }, data: { startedAt: originalStart } });
    const reopenPath = `/api/courses/${data.courseId}/gradebook/attempts/${before.id}/reopen`;
    const responses = await Promise.all([teacherApi.post(reopenPath), teacherApi.post(reopenPath)]);
    expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
    expect(await prisma.gradeEvent.count({ where: { attemptId: before.id, eventType: "submission_reopened" } })).toBe(1);
    const { runtime } = await responseJson<{ runtime: { timing: { isExpired: boolean; expiresAt: string } } }>(await studentApi.get(`${path}/timing`));
    expect(runtime.timing).toMatchObject({ isExpired: true, expiresAt: new Date(originalStart.getTime() + 30 * 60_000).toISOString() });
    const blocked = await studentApi.put(`${path}/draft`, { data: { state: { answers: {} } } });
    expect(blocked.status()).toBe(409);
    expect((await blocked.json()).error.code).toBe("ACTIVITY_TIME_LIMIT_EXPIRED");
    expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: before.id } })).startedAt).toEqual(originalStart);
  } finally { await studentApi.dispose(); }
});
