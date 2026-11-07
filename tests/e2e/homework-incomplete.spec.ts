import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createStoredZip } from "./fixtures/zip";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("teacher selects private solution signatures and student explicitly acknowledges incomplete work", async ({ bankCourse: data, teacherApi, teacherPage, studentPage }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student"); let id: string | undefined;
  try {
    id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Incomplete C homework", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${id}/coding-homework-grader`;
    await teacherPage.goto(`/courses/${data.courseId}/activities/${id}`);
    const solution = teacherPage.locator("section").filter({ has: teacherPage.getByRole("heading", { name: "Private teacher solution", exact: true }) }).last();
    await expect(solution.locator('input[type="file"][accept=".zip"]')).toBeEnabled();
    await solution.locator('input[type="file"][accept=".zip"]').setInputFiles({ name: "teacher.zip", mimeType: "application/zip", buffer: createStoredZip([{ path: "src/main.c", contents: "int add(int values[], int count) { return count; }" }]) });
    await solution.getByRole("checkbox", { name: "src/main.c", exact: true }).check();
    const fn = solution.getByRole("checkbox", { name: "int add(int*, int) src/main.c", exact: true });
    await fn.check(); await fn.uncheck();
    await solution.getByRole("button", { name: "Select functions with AI", exact: true }).click(); await expect(fn).toBeChecked();
    await teacherPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(teacherPage.getByText("Coding homework saved.", { exact: true })).toBeVisible();
    await teacherPage.reload();
    await expect(fn).toBeChecked();
    expect(await responseJson(await teacherApi.get(`${base}/authoring`))).toMatchObject({ requirements: { requirements: { requiredFunctions: [{ name: "add", filePath: "src/main.c", returnType: "int", parameterTypes: ["int*", "int"] }] } } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" }, gradebookSettings: { maxAttempts: 1, attemptLimitMode: "max_attempts", pointsPossible: 100 } } }));
    await teacherPage.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await teacherPage.getByRole("button", { name: "Generate embeddings", exact: true }).click();
    await expect(teacherPage.locator(".activity-reference-materials").getByText("Reference selection is prepared.", { exact: true })).toBeVisible();
    await teacherPage.getByRole("tab", { name: "Settings", exact: true }).click();
    await teacherPage.getByRole("button", { name: "Enable final submissions", exact: true }).click();
    await expect(teacherPage.getByRole("button", { name: "Disable final submissions", exact: true })).toBeVisible();
    const assigned = `/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    await studentPage.goto(assigned);
    await expect(studentPage.locator('input[type="file"][multiple]')).toBeEnabled();
    await studentPage.locator('input[type="file"][multiple]').setInputFiles({ name: "main.c", mimeType: "text/plain", buffer: Buffer.from("// Work is still incomplete.\n") });
    await expect(studentPage.getByText("main.c", { exact: true })).toBeVisible();
    await expect(studentPage.getByRole("button", { name: "Submit my work", exact: true })).toHaveCount(0);
    await studentPage.getByRole("button", { name: "Check my submission", exact: true }).click();
    const acknowledgement = studentPage.getByRole("checkbox", { name: "I want to submit incomplete work.", exact: true });
    await expect(acknowledgement).toBeVisible();
    await expect(studentPage.getByRole("button", { name: "Submit my work", exact: true })).toHaveCount(0);
    expect((await student.post(`/api${assigned}/coding-homework-grader/hand-in`, { data: { expectedRevision: 1 } })).status()).toBe(409);
    expect((await student.get(`/api${assigned}/coding-homework-grader/teacher-solution`)).status()).toBe(403);
    await acknowledgement.check(); await studentPage.getByRole("button", { name: "Submit my work", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Submit my work", exact: true }).getByRole("button", { name: "Submit my work", exact: true }).click();
    await expect(studentPage.getByRole("button", { name: "Answer challenge questions", exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(studentPage.locator("textarea")).toHaveCount(0);
    expect(await responseJson(await student.get(`/api${assigned}/coding-homework-grader/workspace`))).toMatchObject({ submission: { incompleteAcknowledged: true, questionCount: 3 } });
    await studentPage.setViewportSize({ width: 390, height: 844 });
    await expect(studentPage.getByRole("tablist", { name: "Submitted files", exact: true }).getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
    await expect(studentPage.locator(".homework-submitted-file-content")).toContainText("Work is still incomplete");
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  } finally {
    if (id) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: id } } });
    await student.dispose(); await model.close();
  }
});
