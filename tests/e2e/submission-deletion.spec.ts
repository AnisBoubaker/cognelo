import { prisma } from "@cognelo/db";
import { parseMcqSource } from "../../packages/plugin-activities/plugin-mcq/src/mcq";
import type { Page } from "@playwright/test";
import { expect, ORIGINAL_SOURCE, test } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings, CourseTestRuntime, DeletedSubmissionAudit } from "../../apps/web/src/lib/api";

const question = parseMcqSource(ORIGINAL_SOURCE, "none").questions[0]!;
const answers = { [question.id]: [question.choices.find((choice) => choice.isCorrect)!.id] };

for (const kind of ["mcq", "coding-exercise", "web-design-coding-exercise", "test"] as const) {
  test(`deletes a ${kind} submission with a required reason and keeps student-visible history`, { tag: "@regression" }, async ({ teacherPage: page, studentPage, teacherApi, bankCourse: data }) => {
    test.setTimeout(120_000);
    const studentApi = await createAuthenticatedApi("student");
    let activityId = data.activityId;
    const title = `Deletion ${kind} ${data.token}`;
    const files = [{ id: "html", path: "index.html", language: "html", starterCode: "<h1>Hello</h1>", isEditable: true, orderIndex: 0 }];
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
        activityId = await createCourseActivity(data, {
          activityTypeKey: kind, title,
          config: kind === "coding-exercise" ? { language: "python", prompt: "Write a program.", sampleTests: [] } : { files, previewEntry: "index.html" }
        });
        if (kind === "web-design-coding-exercise") {
          await responseJson(await teacherApi.put(`/api/courses/${data.courseId}/activities/${activityId}/web-design-coding-exercises/tests`, { data: {
            referenceFiles: files, shouldCaptureExpectedResult: false, shouldCropExpectedResult: false,
            tests: [{ id: "heading", name: "Heading", kind: "hidden", testCode: 'await expect(page.locator("h1")).toHaveText("Hello");', isEnabled: true, weight: 1, metadata: {} }]
          } }));
        }
      }
      if (kind !== "mcq") await assignCourseTest(data, activityId, title);
      const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
      const report = `/courses/${data.courseId}/gradebook/activities/${activityId}?origin=content&report=students`;
      await page.goto(report);
      await page.getByRole("button", { name: /^Actions for / }).click();
      await expect(page.getByRole("menuitem", { name: "Delete submission", exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
      if (kind === "mcq") {
        await responseJson(await studentApi.post(`${assigned}/mcq/submission`, { data: { answers } }));
      } else if (kind === "coding-exercise") {
        await responseJson(await studentApi.post(`${assigned}/coding-exercises/submit`, { data: { sourceCode: "print('preserved')" } }));
      } else if (kind === "web-design-coding-exercise") {
        await responseJson(await studentApi.post(`${assigned}/web-design-coding-exercises/submit`, { data: { files } }));
      } else {
        const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await studentApi.post(`${assigned}/test`, { data: { sessionId: data.token } }));
        const attemptPath = `/api/courses/${data.courseId}/gradebook/attempts/${runtime.attempt!.id}`;
        expect((await teacherApi.delete(attemptPath, { data: { reason: "Still answering" } })).status()).toBe(409);
        for (const item of runtime.test.items) await responseJson(await studentApi.put(`${assigned}/test/items/${item.id}`, { data: {
          parentAttemptId: runtime.attempt!.id, sessionId: data.token, state: { answers }
        } }));
        await responseJson(await studentApi.post(`${assigned}/test/submit`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: data.token } }));
      }
      const before = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId }, include: { testItemAttempts: true } });
      const deletionPath = `/api/courses/${data.courseId}/gradebook/attempts/${before.id}`;
      expect((await studentApi.delete(deletionPath, { data: { reason: "Not authorized" } })).status()).toBe(403);
      expect((await teacherApi.delete(deletionPath, { data: { reason: "   " } })).status()).toBe(400);
      await page.reload();
      const dialog = await openDeletion(page);
      const confirm = dialog.getByRole("button", { name: "Delete submission", exact: true });
      await expect(confirm).toBeDisabled();
      await dialog.getByRole("textbox").fill("   ");
      await expect(confirm).toBeDisabled();
      const reason = `Wrong submission — ${data.token}`;
      await dialog.getByRole("textbox").fill(reason);
      await expect(confirm).toBeEnabled();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: before.id } })).lifecycle).toBe(before.lifecycle);
      await openDeletion(page);
      await dialog.getByRole("textbox").fill(`  ${reason}  `);
      await confirm.click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText("Submission deleted.", { exact: true })).toBeVisible();
      await expect(page.getByText("Did not submit", { exact: true })).toBeVisible();
      const after = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: before.id }, include: { testItemAttempts: true } });
      expect(after).toMatchObject({ lifecycle: "deleted", submittedAt: before.submittedAt, startedAt: before.startedAt, pluginAttemptRef: before.pluginAttemptRef, metadata: { deletion: { reason } } });
      expect(after.testItemAttempts).toEqual(before.testItemAttempts);
      const events = await prisma.gradeEvent.findMany({ where: { attemptId: before.id, eventType: "submission_deleted" } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ reason, previousValue: { attempt: { lifecycle: before.lifecycle } } });
      const { audit } = await responseJson<{ audit: { deletedSubmissions: DeletedSubmissionAudit[] } }>(await studentApi.get(`${assigned}/submissions`));
      expect(audit.deletedSubmissions).toEqual([expect.objectContaining({ attemptId: before.id, reason, gradeSnapshot: null })]);
      await studentPage.goto(assigned.replace("/api", ""));
      await studentPage.getByRole("tab", { name: "Deleted submissions", exact: true }).click();
      await expect(studentPage.getByText(`Reason: ${reason}`, { exact: true })).toBeVisible();
      if (kind === "coding-exercise") {
        await expect(studentPage.locator(".code-renderer")).toContainText("print('preserved')");
        await studentPage.reload();
        await studentPage.getByRole("tab", { name: "Deleted submissions", exact: true }).click();
        await expect(studentPage.locator(".code-renderer")).toContainText("print('preserved')");
        await expect(studentPage.getByRole("tab", { name: "Previous submissions", exact: true })).toHaveCount(0);
      } else if (kind === "web-design-coding-exercise") {
        await expect(studentPage.locator(".code-renderer")).toContainText("<h1>Hello</h1>");
      }
    } finally { await studentApi.dispose(); }
  });
}

for (const assessmentMode of ["summative", "formative"] as const) {
test(`lets the teacher select an older ${assessmentMode} submission without deleting the latest`, { tag: "@regression" }, async ({ teacherPage: page, teacherApi, bankCourse: data }) => {
  const studentApi = await createAuthenticatedApi("student");
  try {
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: {
      ...settings.general, assessmentMode, confirmSummativeToFormative: assessmentMode === "formative",
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "max_attempts", maxAttempts: 3, gradeStrategy: "latest" },
      groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: group.overrideFields.filter((field) => field !== "attempts") }))
    } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
    const submissionPath = `${assigned}/mcq/${assessmentMode === "formative" ? "feedback" : "submission"}`;
    await responseJson(await studentApi.post(submissionPath, { data: { answers } }));
    await responseJson(await studentApi.post(submissionPath, { data: { answers: {} } }));
    const [first, latest] = await prisma.activityAttempt.findMany({ where: { activityId: data.activityId }, orderBy: { attemptNumber: "asc" } });
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}?groupId=${data.groupId}`);
    const dialog = await openDeletion(page);
    await expect(dialog.getByLabel("Submission", { exact: true })).toHaveValue(latest!.id);
    await dialog.getByLabel("Submission", { exact: true }).selectOption(first!.id);
    await expect(dialog).toContainText("Delete submission #1");
    await dialog.getByRole("textbox").fill("First submission used the wrong answers");
    await dialog.getByRole("button", { name: "Delete submission", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: first!.id } })).lifecycle).toBe("deleted");
    expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: latest!.id } })).lifecycle).toBe(latest!.lifecycle);
    if (assessmentMode === "summative") expect((await prisma.grade.findFirstOrThrow({ where: { gradebookItemId: latest!.gradebookItemId } })).selectedAttemptId).toBe(latest!.id);
    else expect(await prisma.grade.count({ where: { gradebookItemId: latest!.gradebookItemId } })).toBe(0);
  } finally { await studentApi.dispose(); }
});
}

async function openDeletion(page: Page) {
  await page.getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: "Delete submission", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete submission", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
