import { prisma } from "@cognelo/db";
import type { Page } from "@playwright/test";
import type { StudentGroupingDto } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings, CourseTestRuntime, TimedActivityRuntime } from "../../apps/web/src/lib/api";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";

for (const compound of [false, true]) {
  test(`${compound ? "compound Test" : "standalone activity"} caps its timer at live Until exceptions and submits at closing`, { tag: "@regression" }, async ({ bankCourse: data, teacherApi, studentPage }) => {
    test.setTimeout(90_000);
    const studentApi = await createAuthenticatedApi("student");
    try {
      let activityId = data.activityId;
      if (compound) {
        const title = `Until Test ${data.token}`;
        const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
          title, lifecycle: "published", settings: { timeLimitMinutes: 30, navigationMode: "free", randomizeItems: false, allowResume: true },
          contentPlacement: { parentId: null, titleSnapshot: title, isVisible: true, position: 1, metadata: {} }
        } }));
        activityId = created.activity.id;
        await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
          source: "local", activityTypeKey: "mcq", title: "Closing deadline", lifecycle: "published", config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 10, isRequired: true
        } }));
        await assignCourseTest(data, activityId, title);
      }
      const settingsPath = `/api/courses/${data.courseId}/activities/${activityId}/assign-all-groups`;
      const assignedPath = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
      const runtimePath = `${assignedPath}/${compound ? "test" : "timing"}`;
      const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
      const section = settings.groups.find((group) => group.groupId === data.groupId)!;
      const student = section.students.find((participant) => participant.email === credentialsFor("student").email)!;
      settings.general.assessmentMode = "summative";
      settings.general.timeLimitMinutes = 30;
      settings.general.availableFrom = null;
      settings.general.availableUntil = new Date(Date.now() + 5 * 60_000).toISOString();
      section.overrideFields = [];
      const save = async () => responseJson(await teacherApi.post(settingsPath, { data: {
        ...settings.general, groupAssignments: settings.groups, confirmActiveStudents: true
      } }));
      const runtime = async () => (await responseJson<{ runtime: CourseTestRuntime | TimedActivityRuntime }>(await studentApi.get(runtimePath))).runtime;
      await save();
      await studentPage.goto(assignedPath.replace("/api", ""));
      if (compound) {
        await studentPage.getByRole("button", { name: "Start Test", exact: true }).click();
        await studentPage.getByRole("dialog", { name: "Start this Test now?" }).getByRole("button", { name: "Start Test", exact: true }).click();
      } else {
        await studentPage.getByRole("button", { name: "Start timed attempt" }).click();
      }
      await studentPage.getByLabel("Four", { exact: true }).check();
      const initial = await runtime();
      const attemptId = initial.attempt!.id;
      const startedAt = new Date(initial.attempt!.startedAt).getTime();
      const checkDeadline = async (until: string) => {
        expect((await runtime()).timing.expiresAt).toBe(until);
        await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expectDisplayedDeadline(studentPage, until);
        await expect(studentPage.getByLabel("Four", { exact: true })).toBeChecked();
        expect((await runtime()).attempt!.id).toBe(attemptId);
      };
      await checkDeadline(settings.general.availableUntil);

      section.overrideFields = ["availableUntil"];
      section.availableUntil = new Date(Date.now() + 4 * 60_000).toISOString();
      await save();
      await checkDeadline(section.availableUntil);
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/groupings`, { data: {
        title: "Hidden accommodations", visibleToStudents: false, teams: [{ title: "Team 1", participantIds: [student.id] }]
      } }));
      const teamUntil = new Date(Date.now() + 3 * 60_000).toISOString();
      section.exceptions = [{ ...settings.general, teamId: grouping.teams[0]!.id, participantId: null, overrideFields: ["availableUntil"], availableUntil: teamUntil }];
      await save();
      await checkDeadline(teamUntil);

      // A student exception replaces the earlier team/section dates rather than
      // being capped by them; only that effective date competes with duration.
      const studentRule = { ...settings.general, teamId: null, participantId: student.id,
        overrideFields: ["availableUntil", "timeLimit"] as Array<"availableUntil" | "timeLimit">,
        availableUntil: new Date(Date.now() + 8 * 60_000).toISOString() as string | null, timeLimitMinutes: 60 };
      section.exceptions.push(studentRule);
      await save();
      await checkDeadline(studentRule.availableUntil!);
      if (compound) {
        const response = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.post(`${assignedPath}/test/submit`, { data: {
          parentAttemptId: attemptId, sessionId: "stale-browser", onlyIfExpired: true
        } }));
        expect(response.runtime.attempt!.lifecycle).toBe("started");
      } else {
        const stale = await studentApi.post(`${assignedPath}/timing/finalize`, { data: {} });
        expect(stale.status()).toBe(409);
        expect((await stale.json()).error.code).toBe("ACTIVITY_TIME_LIMIT_ACTIVE");
      }

      studentRule.availableUntil = null;
      await save();
      await checkDeadline(new Date(startedAt + 60 * 60_000).toISOString());
      studentRule.availableUntil = new Date(startedAt + 90 * 60_000).toISOString();
      await save();
      await checkDeadline(new Date(startedAt + 60 * 60_000).toISOString());

      // Expire only the availability window; the one-hour time limit remains.
      studentRule.availableUntil = new Date(Date.now() - 1000).toISOString();
      await save();
      expect((await runtime()).timing).toMatchObject({ expiresAt: studentRule.availableUntil, isExpired: true, remainingSeconds: 0 });
      await studentPage.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`), { timeout: 30_000 });
      const submitted = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      expect(["submitted", "graded"]).toContain(submitted.lifecycle);
      expect(submitted.metadata).toMatchObject({ submittedAvailableUntil: studentRule.availableUntil, submittedTimeLimitMinutes: 60 });
      studentRule.availableUntil = new Date(Date.now() + 90 * 60_000).toISOString();
      studentRule.timeLimitMinutes = 90;
      await save();
      expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attemptId } })).metadata).toEqual(submitted.metadata);
      if (compound) {
        const { runtime: previous } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.get(`${assignedPath}/test?view=previous`));
        expect(previous.timing.expiresAt).toBe((submitted.metadata as { submittedAvailableUntil: string }).submittedAvailableUntil);
      }
    } finally { await studentApi.dispose(); }
  });
}

async function expectDisplayedDeadline(page: Page, deadline: string) {
  await expect.poll(async () => {
    const text = await page.getByRole("timer").textContent();
    const match = text?.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return Number.POSITIVE_INFINITY;
    const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    return Math.abs(seconds - Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000)));
  }).toBeLessThanOrEqual(2);
}
