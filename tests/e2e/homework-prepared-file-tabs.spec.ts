import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";

test("prepared files use the same explorer with confirmed delete crosses and refreshed replacement content", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Prepare with file tabs", config: {} });
  await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId, metadata: { assessmentMode: "summative" } } }));
  await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`);
  const upload = page.locator('input[type="file"][multiple]');
  await expect(upload).toBeEnabled();
  await upload.setInputFiles([
    { name: "a.c", mimeType: "text/plain", buffer: Buffer.from("int alpha(void) { return 1; }") },
    { name: "b.c", mimeType: "text/plain", buffer: Buffer.from("int beta(void) { return 2; }") }
  ]);
  const viewer = page.locator(".homework-submitted-files");
  const tabs = page.getByRole("tablist", { name: "Prepared files", exact: true });
  const panel = viewer.getByRole("tabpanel");
  const first = tabs.getByRole("tab", { name: "a.c", exact: true });
  const second = tabs.getByRole("tab", { name: "b.c", exact: true });
  await expect(tabs.getByRole("tab")).toHaveCount(2);
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("int alpha(void)");
  await expect(viewer.getByRole("button", { name: /^Remove file: / })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "View", exact: true })).toHaveCount(0);
  await expect(viewer.locator("textarea, input, [contenteditable=true]")).toHaveCount(0);
  await second.click(); await expect(panel).toContainText("int beta(void)");
  await page.getByRole("button", { name: "Check my submission", exact: true }).click();
  await expect(page.getByText("Structure is valid.", { exact: true })).toBeVisible();
  await tabs.getByRole("button", { name: "Remove file: b.c", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Remove file", exact: true });
  await expect(confirm).toContainText("Remove b.c from your prepared work?");
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(second).toHaveAttribute("aria-selected", "true"); await expect(panel).toContainText("int beta(void)");
  await expect(page.getByText("Structure is valid.", { exact: true })).toBeVisible();
  await tabs.getByRole("button", { name: "Remove file: b.c", exact: true }).click();
  await confirm.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(second).toHaveCount(0); await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("int alpha(void)"); await expect(panel).not.toContainText("int beta(void)");
  await expect(page.getByText("Structure is valid.", { exact: true })).toHaveCount(0);
  await upload.setInputFiles({ name: "a.c", mimeType: "text/plain", buffer: Buffer.from("int replaced_alpha(void) { return 3; }") });
  await page.getByRole("dialog", { name: "Replace existing files?", exact: true }).getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(panel).toContainText("int replaced_alpha(void)"); await expect(panel).not.toContainText("int alpha(void)");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await viewer.screenshot({ path: "tmp/homework-prepared-tabs-mobile.png" });
  await tabs.getByRole("button", { name: "Remove file: a.c", exact: true }).click();
  await confirm.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(tabs).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check my submission", exact: true })).toBeDisabled();
  await upload.setInputFiles({ name: "new.c", mimeType: "text/plain", buffer: Buffer.from("int new_work(void) { return 4; }") });
  await expect(tabs.getByRole("tab", { name: "new.c", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("int new_work(void)");
});
