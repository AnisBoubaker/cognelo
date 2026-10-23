import { expect, test } from "./fixtures/bank-course";
import { responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

test("course and section reports share settings, preserve context, and fit narrow screens", async ({
  bankCourse: data, teacherApi, teacherPage: page
}, testInfo) => {
  const coursePath = `/courses/${data.courseId}?tab=content`;
  const reportPath = `/courses/${data.courseId}/gradebook/activities/${data.activityId}?origin=content&report=overview`;
  const groupPath = `${coursePath}&view=group&groupId=${data.groupId}`;
  const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
  const settings = page.getByRole("dialog", { name: data.title, exact: true });
  const settingsButton = page.getByRole("button", { name: "Settings", exact: true });

  await page.goto(coursePath);
  await page.getByRole("link", { name: data.title, exact: true }).first().click();
  await expect(page).toHaveURL(reportPath);
  await expect(page.getByRole("tab", { name: "Class overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: "Edit activity", exact: true })).toHaveClass(/secondary/);
  await settingsButton.click();
  for (const name of ["General", "Group assignment", "AI settings", "Exceptions"]) {
    await expect(settings.getByRole("tab", { name, exact: true })).toBeVisible();
  }
  await settings.getByLabel("Enable activity messaging", { exact: true }).check();
  await settings.getByRole("button", { name: "Cancel", exact: true }).last().click();
  const before = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
  expect(before.settings.general.messagingEnabled).toBe(false);

  await page.getByRole("tab", { name: "Student results", exact: true }).click();
  await settingsButton.click();
  await expect(settings.getByLabel("Enable activity messaging", { exact: true })).not.toBeChecked();
  // The fixture directly assigns a summative activity before General settings exist.
  await settings.getByLabel("Assessment mode", { exact: true }).selectOption("summative");
  await settings.getByLabel("Enable activity messaging", { exact: true }).check();
  await settings.getByRole("checkbox", { name: /^Limit the time for each attempt/ }).check();
  await settings.getByLabel("Time limit (minutes)", { exact: true }).fill("35");
  await settings.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(settings).toBeHidden();
  await expect(page).toHaveURL(reportPath);
  await expect(page.getByRole("tab", { name: "Student results", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Message students", exact: true })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  const after = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
  expect(after.settings.general).toMatchObject({ messagingEnabled: true, timeLimitMinutes: 35 });

  await page.getByRole("link", { name: "Back to course content", exact: true }).click();
  await page.getByRole("button", { name: `Actions for ${data.title}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await expect(settings.getByLabel("Enable activity messaging", { exact: true })).toBeChecked();
  await expect(settings.getByLabel("Time limit (minutes)", { exact: true })).toHaveValue("35");
  await settings.getByRole("button", { name: "Cancel", exact: true }).last().click();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");

  await page.goto(groupPath);
  await page.getByRole("link", { name: data.title, exact: true }).first().click();
  await expect(page).toHaveURL(`${reportPath}&groupId=${data.groupId}`);
  await expect(page.getByRole("tab", { name: "Class overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: "Back to course content", exact: true })).toHaveAttribute("href", groupPath);
  await expect(page.getByRole("button", { name: "Message students", exact: true })).toBeVisible();
  await expect(page.getByText("Loading student answers...", { exact: true })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("report-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(settingsButton).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const contextBox = await page.locator(".activity-report-heading .workspace-context").boundingBox();
  const actionsBox = await page.locator(".activity-report-actions").boundingBox();
  expect(contextBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(actionsBox!.y - (contextBox!.y + contextBox!.height)).toBeLessThanOrEqual(24);
  await page.screenshot({ path: testInfo.outputPath("report-mobile.png") });
  await settingsButton.click();
  await expect(settings.getByLabel("Time limit (minutes)", { exact: true })).toHaveValue("35");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await settings.getByRole("button", { name: "Cancel", exact: true }).last().click();
  await page.getByRole("link", { name: "Back to course content", exact: true }).click();
  await expect(page).toHaveURL(groupPath);

  // The return destination follows the selected tab, even though the report URL still says overview.
  await page.goto(`${reportPath}&groupId=${data.groupId}`);
  await page.getByRole("tab", { name: "Student results", exact: true }).click();
  await page.getByRole("link", { name: "Edit activity", exact: true }).click();
  const studentResultsPath = reportPath.replace("report=overview", "report=students") + `&groupId=${data.groupId}`;
  await expect(page.getByRole("link", { name: "Back to student results", exact: true })).toHaveAttribute("href", studentResultsPath);
  await page.getByRole("link", { name: "Back to student results", exact: true }).click();
  await expect(page).toHaveURL(studentResultsPath);
  await expect(page.getByRole("tab", { name: "Student results", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: "Back to course content", exact: true })).toHaveAttribute("href", groupPath);
});
