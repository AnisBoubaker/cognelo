import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

test("learner payloads exclude keys and concurrent submissions consume one allowance", async ({ bankCourse: data, teacherApi, studentPage }) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student");
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
  try {
    for (const path of [assigned, `/api/courses/${data.courseId}`, `/api/courses/${data.courseId}/groups/${data.groupId}`, "/api/courses"]) {
      const payload = await responseJson(await student.get(path));
      expect(JSON.stringify(payload)).not.toContain(ORIGINAL_SOURCE);
      expect(JSON.stringify(payload)).not.toContain('"isCorrect":');
    }
    const activity = await responseJson<{ activity: { config: Record<string, unknown> } }>(await teacherApi.get(data.courseActivityPath));
    expect(activity.activity.config.source).toBe(ORIGINAL_SOURCE);
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", timeLimitMinutes: null,
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 1 },
      groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] })) } }));
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.getByLabel("Four", { exact: true })).toBeVisible();
    const results = await Promise.all(Array.from({ length: 4 }, () => student.post(`${assigned}/mcq/submission`, { data: { answers: { "question-1": ["question-1-choice-1"] } } })));
    expect(results.filter((result) => result.ok())).toHaveLength(1);
    for (const result of results.filter((result) => !result.ok())) {
      expect([400, 409]).toContain(result.status());
      expect((await result.json()).error.code).toBe("ATTEMPT_LIMIT_REACHED");
    }
    expect(await prisma.activityAttempt.count({ where: { activityId: data.activityId, lifecycle: { not: "deleted" } } })).toBe(1);
  } finally { await student.dispose(); }
});

test("future Test authoring is denied and runtime children use safe projections", async ({ bankCourse: data, teacherApi }) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student");
  try {
    const { test: created } = await responseJson<{ test: { activityId: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: { title: "Confidential Test", description: "Disposable regression fixture" } }));
    const id = created.activityId;
    for (const item of [
      { activityTypeKey: "mcq", title: "Choices", config: { source: ORIGINAL_SOURCE } },
      { activityTypeKey: "parsons-problem", title: "Arrange", config: { prompt: "Arrange the program.", solution: "if ready:\n  work()\nfinish()", language: "python", stripIndentation: true, groups: [], precedenceRules: [] } }
    ]) await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${id}/test/items`, { data: { source: "local", ...item, pointsPossible: 5 } }));
    await assignCourseTest(data, id, "Confidential Test");
    const assignment = await prisma.courseGroupActivity.findFirstOrThrow({ where: { activityId: id, groupId: data.groupId } });
    await prisma.courseGroupActivity.update({ where: { id: assignment.id }, data: { availableFrom: new Date(Date.now() + 3600_000) } });
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    expect((await student.get(assigned)).status()).toBe(403);
    expect((await student.get(`/api/courses/${data.courseId}/activities/${id}/test`)).status()).toBe(403);
    expect((await teacherApi.get(`/api/courses/${data.courseId}/activities/${id}/test`)).ok()).toBe(true);
    await prisma.courseGroupActivity.update({ where: { id: assignment.id }, data: { availableFrom: null } });
    const runtime = await responseJson(await student.get(`${assigned}/test`));
    expect(JSON.stringify(runtime)).not.toMatch(/\[x\]|"solution"|"sourceIndex"|"expectedIndent"|"activityVersion"|"bankActivity"|"activityFingerprint"/);
    expect(JSON.stringify(runtime)).toContain("studentDocument");
    expect(JSON.stringify(runtime)).toContain("studentBlocks");
  } finally { await student.dispose(); }
});

test("SEB launch and access credentials cannot authenticate or renew a session", async ({ bankCourse: data }) => {
  const { createSafeExamBrowserLaunchToken, createSafeExamBrowserAccessToken } = await import("../../packages/core/src/safe-exam-browser");
  const student = await createAuthenticatedApi("student");
  try {
    const { user } = await responseJson<{ user: { id: string } }>(await student.get("/api/users/me"));
    const scope = { userId: user.id, courseId: data.courseId, groupId: data.groupId, activityId: data.activityId };
    for (const createToken of [createSafeExamBrowserLaunchToken, createSafeExamBrowserAccessToken]) {
      const token = await createToken(scope, process.env.JWT_SECRET!);
      for (const path of ["/api/users/me", `/api/courses/${data.courseId}`]) {
        const response = await student.get(path, { headers: { Cookie: `cognelo_session=${token}` } });
        expect(response.status()).toBe(401);
        expect(response.headers()["set-cookie"] ?? "").not.toContain("Max-Age=28800");
      }
    }
    expect((await student.get("/api/users/me")).ok()).toBe(true);
  } finally { await student.dispose(); }
});

test("Parsons public blocks can be saved and checked without reference metadata", async ({ bankCourse: data, teacherApi, studentPage }) => {
  const { createCourseActivity } = await import("./fixtures/activity-suite");
  const student = await createAuthenticatedApi("student");
  try {
    const id = await createCourseActivity(data, { activityTypeKey: "parsons-problem", title: "Private arrangement", config: {
      prompt: "Arrange the program.", solution: "if ready:\n  work()\nfinish()", language: "python", stripIndentation: true, groups: [], precedenceRules: []
    } });
    await assignCourseTest(data, id, "Private arrangement");
    const path = `/api/courses/${data.courseId}/activities/${id}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(path));
    await responseJson(await teacherApi.post(path, { data: { ...settings.general, assessmentMode: "formative", confirmSummativeToFormative: true, groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] })) } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    const { attempt } = await responseJson<{ attempt: { id: string; latestState: { configFingerprint: string; blocks: Array<{ id: string; displayText: string; currentIndent: number }> } } }>(await student.post(`${assigned}/parsons/attempt`, { data: {} }));
    expect(JSON.stringify(attempt)).not.toMatch(/"solution"|"sourceIndex"|"physicalLineIndex"|"expectedIndent"|"originalText"/);
    const ordered = ["if ready:", "work()", "finish()"].map((text, index) => ({ ...attempt.latestState.blocks.find((block) => block.displayText === text)!, currentIndent: index === 1 ? 1 : 0 }));
    const checked = await responseJson<{ attempt: { latestState: { lastEvaluation: { isCorrect: boolean } } } }>(await student.patch(`${assigned}/parsons/attempt`, { data: { attemptId: attempt.id, state: { ...attempt.latestState, blocks: ordered }, event: { type: "check" } } }));
    expect(checked.attempt.latestState.lastEvaluation.isCorrect).toBe(true);
    expect(JSON.stringify(checked)).not.toMatch(/"sourceIndex"|"expectedIndent"|"originalText"/);
    await studentPage.goto(assigned.replace("/api", ""));
    await expect(studentPage.locator(".parsons-block-row")).toHaveCount(3);
  } finally { await student.dispose(); }
});
