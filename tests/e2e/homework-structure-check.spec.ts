import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("students explicitly check structure, acknowledge gaps, and recheck after changing files", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const model = await homeworkModelFixture(data);
  try {
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Explicit structural check", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    const authoring = await responseJson<{ assignment: object }>(await teacherApi.get(`${base}/authoring`));
    await responseJson(await teacherApi.put(`${base}/authoring`, { data: { assignment: authoring.assignment, requirements: {
      requiredFiles: [{ path: "main.c" }, { path: "helpers.h" }],
      requiredFunctions: [{ name: "add", returnType: "int", parameterTypes: ["int", "int"] }, { name: "subtract", returnType: "int", parameterTypes: ["int", "int"] }]
    } } }));
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${base}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId, metadata: { assessmentMode: "summative" } } }));
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`);
    const check = page.getByRole("button", { name: "Check my submission", exact: true });
    const submit = page.getByRole("button", { name: "Submit my work", exact: true });
    const acknowledgement = page.getByRole("checkbox", { name: "I want to submit incomplete work.", exact: true });
    const panel = page.locator(".homework-structure-check");
    const upload = page.locator('input[type="file"][multiple]');
    await expect(upload).toBeEnabled(); await expect(check).toBeDisabled();
    await expect(panel.getByRole("alert")).toHaveCount(0); await expect(acknowledgement).toHaveCount(0); await expect(submit).toHaveCount(0);
    await expect(panel).toContainText("It does not run your code or prove that your solution is correct.");
    await upload.setInputFiles({ name: "main.c", mimeType: "text/plain", buffer: Buffer.from("int main(void) { return 0; }") });
    await expect(check).toBeEnabled(); await expect(panel.getByRole("alert")).toHaveCount(0); await expect(submit).toHaveCount(0);
    await check.click();
    await expect(panel.getByRole("alert")).toContainText("Some structural requirements are missing or do not match.");
    await expect(panel.locator("li")).toHaveCount(3);
    for (const requirement of ["helpers.h", "add", "subtract"]) await expect(panel.getByRole("alert")).toContainText(requirement);
    await expect(panel.getByRole("alert").locator("svg")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await panel.screenshot({ path: "tmp/homework-structure-incomplete-mobile.png" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(acknowledgement).not.toBeChecked(); await expect(submit).toHaveCount(0);
    await acknowledgement.check(); await expect(submit).toBeEnabled();
    await acknowledgement.uncheck(); await expect(submit).toHaveCount(0); await acknowledgement.check();
    await upload.setInputFiles([
      { name: "main.c", mimeType: "text/plain", buffer: Buffer.from("int add(int a, int b) { return 999; }\nint subtract(int a, int b) { return 999; }") },
      { name: "helpers.h", mimeType: "text/plain", buffer: Buffer.from("int add(int a, int b);\nint subtract(int a, int b);") }
    ]);
    await page.getByRole("dialog", { name: "Replace existing files?", exact: true }).getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText("helpers.h", { exact: true })).toBeVisible();
    await expect(panel.getByRole("alert")).toHaveCount(0); await expect(acknowledgement).toHaveCount(0); await expect(submit).toHaveCount(0);
    await check.click();
    // Wrong arithmetic still passes the explicitly structural check.
    await expect(panel.getByRole("status")).toContainText("Structure is valid.");
    await expect(panel.getByRole("status").locator("svg")).toBeVisible();
    await expect(submit).toBeEnabled(); await expect(acknowledgement).toHaveCount(0);
    await panel.screenshot({ path: "tmp/homework-structure-valid.png" });
    await submit.click();
    const confirmation = page.getByRole("dialog", { name: "Submit my work", exact: true });
    await expect(confirmation).toContainText("Once submitted, the work cannot be changed.");
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: /^Remove file: / }).first().click();
    await page.getByRole("dialog", { name: "Remove file", exact: true }).getByRole("button", { name: "Remove", exact: true }).click();
    await expect(panel.getByRole("status")).toHaveCount(0); await expect(submit).toHaveCount(0);
    expect(model.requests).toHaveLength(0);
    expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(0);
  } finally { await model.close(); }
});
