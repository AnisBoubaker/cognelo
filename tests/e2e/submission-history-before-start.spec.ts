import { prisma } from "@cognelo/db";
import { parseMcqSource } from "../../packages/plugin-activities/plugin-mcq/src/mcq";
import { expect, ORIGINAL_SOURCE, test } from "./fixtures/bank-course";
import { assignCourseTest, createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import type { CourseActivityAssignmentSettings, CourseTestRuntime } from "../../apps/web/src/lib/api";

for (const kind of ["coding-exercise", "mcq", "parsons-problem", "test"] as const) {
  test(`opens ${kind} history before starting the next timed attempt without writing answers`, { tag: "@regression" }, async ({ studentPage: page, teacherApi, bankCourse: data }) => {
    const studentApi = await createAuthenticatedApi("student");
    const question = parseMcqSource(ORIGINAL_SOURCE, "none").questions[0]!;
    const answers = { [question.id]: [question.choices.find((choice) => choice.isCorrect)!.id] };
    const title = `History before start ${data.token}`;
    let activityId = data.activityId;
    try {
      if (kind === "test") {
        const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
          title, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true }
        } }));
        activityId = created.activity.id;
        await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
          source: "local", activityTypeKey: "mcq", title: "Question", config: { source: ORIGINAL_SOURCE }, pointsPossible: 10
        } }));
      } else if (kind !== "mcq") {
        activityId = await createCourseActivity(data, { activityTypeKey: kind, title, config: kind === "coding-exercise"
          ? { language: "python", prompt: "Write a program.", starterCode: "", sampleTests: [] }
          : { language: "python", prompt: "Reorder the code.", solution: "print('first')\nprint('second')", groups: [], precedenceRules: [], stripIndentation: false }
        });
      }
      if (kind !== "mcq") await assignCourseTest(data, activityId, title);
      const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
      if (kind === "coding-exercise") {
        await responseJson(await studentApi.post(`${assigned}/coding-exercises/submit`, { data: { sourceCode: "print('history')" } }));
      } else if (kind === "mcq") {
        await responseJson(await studentApi.post(`${assigned}/mcq/submission`, { data: { answers } }));
      } else if (kind === "parsons-problem") {
        const { attempt } = await responseJson<{ attempt: { id: string; latestState: unknown } }>(await studentApi.post(`${assigned}/parsons/attempt`, { data: {} }));
        await responseJson(await studentApi.patch(`${assigned}/parsons/attempt`, { data: { attemptId: attempt.id, state: attempt.latestState, submit: true, complete: true } }));
      } else {
        const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.post(`${assigned}/test`, { data: { sessionId: data.token } }));
        for (const item of runtime.test.items) await responseJson(await studentApi.put(`${assigned}/test/items/${item.id}`, { data: {
          parentAttemptId: runtime.attempt!.id, sessionId: data.token, state: { answers }
        } }));
        await responseJson(await studentApi.post(`${assigned}/test/submit`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: data.token } }));
      }
      const before = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } });
      const settingsPath = `/api/courses/${data.courseId}/activities/${activityId}/assign-all-groups`;
      const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
      await responseJson(await teacherApi.post(settingsPath, { data: {
        ...settings.general, assessmentMode: "summative", timeLimitMinutes: 30,
        gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 3 },
        groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] }))
      } }));
      const writes: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith(assigned) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.method() + " " + new URL(request.url()).pathname);
      });
      await page.clock.install();
      await page.goto(assigned.replace("/api", ""));
      const start = page.getByRole("button", { name: kind === "test" ? "Start Test" : "Start timed attempt", exact: true });
      await expect(start).toBeVisible();
      await expect(page.getByRole("tab", { name: "Previous submissions", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Previous submissions", exact: true }).click();
      if (kind === "coding-exercise") {
        const history = page.locator(".coding-exercise-attempt-accordion");
        await expect(history).toHaveCount(1);
        await history.locator("summary").click();
        await expect(history).toContainText("print('history')");
      } else if (kind === "mcq") {
        await expect(page.getByRole("heading", { name: "Submission", exact: true })).toBeVisible();
      } else if (kind === "parsons-problem") {
        await expect(page.getByRole("heading", { name: "Previous submissions", exact: true })).toBeVisible();
      } else {
        await expect(page.getByText("Submitted Test", { exact: true })).toBeVisible();
      }
      await page.clock.fastForward(1500);
      await expect(page.getByRole("timer")).toHaveCount(0);
      expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(1);
      expect(writes).toEqual([]);
      await page.getByRole("tab", { name: "New attempt", exact: true }).click();
      await expect(start).toBeVisible();
      expect(writes).toEqual([]);
      await start.click();
      if (kind === "test") await page.getByRole("dialog", { name: "Start this Test now?" }).getByRole("button", { name: "Start Test", exact: true }).click();
      await expect(page.getByRole("timer")).toBeVisible();
      await expect.poll(() => prisma.activityAttempt.count({ where: { activityId } })).toBe(2);
      const preserved = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: before.id } });
      expect(preserved).toMatchObject({ lifecycle: before.lifecycle, submittedAt: before.submittedAt, startedAt: before.startedAt, metadata: before.metadata });
    } finally { await studentApi.dispose(); }
  });
}
