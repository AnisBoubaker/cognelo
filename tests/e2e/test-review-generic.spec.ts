import { prisma } from "@cognelo/db";
import { expect, test, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";

test("one Save all persists MCQ feedback and generic question grades together", async ({ bankCourse: data, teacherApi, teacherPage: page, studentPage }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const base = `/api/courses/${data.courseId}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string; title: string } } }>(await teacherApi.post(`${base}/tests`, {
      data: { title: `Mixed review ${data.token}`, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true } }
    }));
    const children: Array<{ id: string; activityId: string }> = [];
    for (const child of [
      { activityTypeKey: "mcq", title: "Choices", pointsPossible: 10, config: { source: ORIGINAL_SOURCE, randomizeChoices: false } },
      { activityTypeKey: "parsons-problem", title: "Arrangement", pointsPossible: 30,
        config: { prompt: "Arrange the program.", solution: "print(1)", language: "python", stripIndentation: false, groups: [], precedenceRules: [] } }
    ]) {
      const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacherApi.post(`${base}/activities/${created.activity.id}/test/items`, {
        data: { source: "local", ...child }
      }));
      children.push(item);
    }
    await assignCourseTest(data, created.activity.id, created.activity.title);
    const assigned = `${base}/groups/${data.groupId}/activities/assigned/${created.activity.id}`;
    const { runtime } = await responseJson<{ runtime: { attempt: { id: string } } }>(await student.post(`${assigned}/test`, { data: { sessionId: "mixed-review" } }));
    const id = runtime.attempt.id;
    await responseJson(await student.put(`${assigned}/test/items/${children[0].id}`, { data: {
      parentAttemptId: id, sessionId: "mixed-review", state: { answers: { "question-1": ["question-1-choice-1"] } }
    } }));
    await responseJson(await student.post(`${assigned}/test/submit`, { data: { parentAttemptId: id, sessionId: "mixed-review" } }));
    const initial = await prisma.grade.findFirstOrThrow({ where: { selectedAttemptId: id } });
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${created.activity.id}`);
    await page.getByRole("button", { name: "Review and grade all", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Review and grade", exact: true });
    const select = (number: number, title: string) => dialog.getByRole("button", { name: `Activity ${number}: ${title}`, exact: true }).click();
    const save = dialog.getByRole("button", { name: "Save all", exact: true });
    await expect(save).toHaveCount(1);
    await dialog.getByRole("textbox", { name: "Summary", exact: true }).fill("Reviewed choices.");
    await dialog.getByLabel("Final grade (out of 10)", { exact: true }).fill("6");
    await select(2, "Arrangement");
    await dialog.getByRole("textbox", { name: "Comments", exact: true }).fill("Reviewed arrangement.");
    await dialog.getByLabel("Final grade (out of 30)", { exact: true }).fill("15");
    await expect(dialog.getByRole("heading", { name: "10.50 / 20", exact: true })).toBeVisible();
    await select(1, "Choices");
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue("Reviewed choices.");
    expect((await prisma.grade.findUniqueOrThrow({ where: { id: initial.id } })).normalizedScore).toBe(initial.normalizedScore);
    let saves = 0;
    page.on("request", request => { if (request.method() === "PATCH" && request.url().endsWith(`/${id}/test-review`)) saves++; });
    await save.click(); await expect(save).toBeDisabled();
    expect(saves).toBe(1);
    await expect.poll(async () => (await prisma.grade.findUniqueOrThrow({ where: { id: initial.id } })).normalizedScore).toBe(10.5);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Review and grade all", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue("Reviewed choices.");
    await select(2, "Arrangement");
    await expect(dialog.getByRole("textbox", { name: "Comments", exact: true })).toHaveValue("Reviewed arrangement.");
    await expect(dialog.getByLabel("Final grade (out of 30)", { exact: true })).toHaveValue("15");
    await expect(save).toBeDisabled();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();

    const gradesPath = `${base}/groups/${data.groupId}/grades`;
    expect(JSON.stringify(await responseJson(await student.get(gradesPath)))).not.toContain("Reviewed choices.");
    await responseJson(await teacherApi.patch(`${base}/gradebook/items/${initial.gradebookItemId}/release`, { data: { released: true } }));
    const standalone = `${base}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
    await responseJson(await student.post(`${standalone}/mcq/submission`, { data: { answers: { "question-1": ["question-1-choice-1"] } } }));
    const standaloneItem = await prisma.gradebookItem.findFirstOrThrow({ where: { activityId: data.activityId, groupId: data.groupId } });
    await responseJson(await teacherApi.patch(`${base}/gradebook/items/${standaloneItem.id}/release`, { data: { released: true } }));
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}?tab=grades`);
    const standaloneRow = studentPage.locator(".table-row-student-grades").filter({ hasText: data.title });
    await standaloneRow.getByText("Grading details", { exact: true }).click();
    await expect(standaloneRow.getByText("Correct answers: 1 / 1", { exact: true })).toBeVisible();

    const gradeRow = studentPage.locator(".table-row-student-grades").filter({ hasText: created.activity.title });
    await gradeRow.getByText("Grading details", { exact: true }).click();
    await gradeRow.locator("summary").filter({ hasText: "1. Choices" }).click();
    await expect(gradeRow.getByText("Reviewed choices.", { exact: true })).toBeVisible();
    await expect(gradeRow.getByText("Correct answers: 1 / 1", { exact: true })).toBeVisible();
    await gradeRow.locator("summary").filter({ hasText: "2. Arrangement" }).click();
    await expect(gradeRow.getByText("Reviewed arrangement.", { exact: true })).toBeVisible();
    await expect(gradeRow.getByText(/^Order: /)).toBeVisible();
    await expect(gradeRow.getByRole("link", { name: "Open activity and submissions" })).toBeVisible();
    await studentPage.setViewportSize({ width: 390, height: 844 });
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await studentPage.screenshot({ path: "tmp/student-test-grades-mobile.png", fullPage: true });
    await studentPage.setViewportSize({ width: 1280, height: 900 });
    await studentPage.screenshot({ path: "tmp/student-test-grades-desktop.png", fullPage: true });
    await responseJson(await teacherApi.patch(`${base}/gradebook/items/${initial.gradebookItemId}/release`, { data: { released: false } }));
    await responseJson(await teacherApi.patch(`${base}/gradebook/items/${standaloneItem.id}/release`, { data: { released: false } }));
    await studentPage.reload();
    await expect(studentPage.getByText("No grades are available yet.", { exact: true })).toBeVisible();
  } finally { await student.dispose(); }
});
