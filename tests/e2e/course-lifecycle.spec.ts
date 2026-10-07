import { expect, test } from "./fixtures/auth";
import {
  provisionActivitySuite,
  removeActivitySuite,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

test.describe.serial("course lifecycle settings", () => {
  let data: ActivitySuiteData | undefined;

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("archives and restores a course while persisting its metadata and student content layout", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The course lifecycle suite was not provisioned.");
    const archivedTitle = `${data.courseTitle} archived`;
    await page.goto(`/courses/${data.courseId}?tab=settings&section=general`);
    await page.getByLabel("Title", { exact: true }).fill(archivedTitle);
    await page.getByLabel("Description").fill("Updated through the general course settings workflow.");
    await page.getByLabel("Publication status").selectOption("archived");
    await page.getByLabel("Student content layout").selectOption("folder_tabs");
    await page.getByRole("button", { name: "Save course" }).click();
    await expect(page.getByRole("status")).toContainText("General course settings saved.");
    await page.reload();
    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(archivedTitle);
    await expect(page.getByLabel("Description")).toHaveValue("Updated through the general course settings workflow.");
    await expect(page.getByLabel("Publication status")).toHaveValue("archived");
    await expect(page.getByLabel("Student content layout")).toHaveValue("folder_tabs");

    await page.goto("/courses");
    const courseCard = page.getByRole("link").filter({ hasText: archivedTitle });
    await expect(courseCard).toContainText("Archived");

    await page.goto(`/courses/${data.courseId}?tab=settings&section=general`);
    await page.getByLabel("Title", { exact: true }).fill(data.courseTitle);
    await page.getByLabel("Publication status").selectOption("published");
    await page.getByLabel("Student content layout").selectOption("accordion");
    await page.getByRole("button", { name: "Save course" }).click();
    await expect(page.getByRole("status")).toContainText("General course settings saved.");
  });
});
