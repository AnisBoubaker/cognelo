import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("homework separates references and settings, keeps drafts across tabs, and uses compact checkboxes", async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(120_000);
  await ensureContentTypePluginEnabled("text-content");
  const model = await homeworkModelFixture(data);
  let releasePreparation: (() => void) | undefined;
  try {
    for (const title of ["Reference A", "Reference B"]) await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/content-resources`, { data: { contentTypeKey: "text", payload: { title, body: `${title}: C function arguments and return values.` }, isVisible: true } }));
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Homework editor tabs", config: {} });
    await page.goto(`/courses/${data.courseId}/activities/${activityId}`);
    await expect(page.getByRole("tab", { name: "Activity", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Reference materials", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Generate embeddings", exact: true })).toBeHidden();
    await page.getByLabel("Description", { exact: true }).fill("Keep this unsaved assignment description.");

    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    const referenceB = page.getByRole("checkbox", { name: "Reference B", exact: true });
    await expect(referenceB).toBeChecked(); await referenceB.uncheck();
    await expect(page.getByRole("button", { name: "Generate embeddings", exact: true })).toBeHidden();
    await expect(page.getByLabel("Students processed at once (1–4)")).toBeHidden();
    for (const choice of await page.locator('.homework-reference-materials input[type="checkbox"]').all()) {
      const size = await choice.boundingBox(); expect(size!.width).toBeLessThanOrEqual(20); expect(size!.height).toBeLessThanOrEqual(20);
    }
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("button", { name: "Generate embeddings", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enable final submissions", exact: true })).toBeDisabled();
    const concurrencySaved = page.waitForResponse(response => response.request().method() === "PUT" && response.url().endsWith("/workflow-settings"));
    await page.getByLabel("Students processed at once (1–4)").fill("3"); await concurrencySaved;
    await expect(page.getByRole("dialog", { name: "Save", exact: true })).toBeHidden();
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await expect(referenceB).not.toBeChecked();
    await page.getByRole("tab", { name: "Concepts", exact: true }).click();
    await page.getByRole("tab", { name: "Activity", exact: true }).click();
    await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Keep this unsaved assignment description.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Coding homework saved.", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await expect(referenceB).not.toBeChecked();

    // The progress dialog must remain visible while the Activity/References panels are hidden.
    let hold = true;
    const gate = new Promise<void>(resolve => { releasePreparation = resolve; });
    await page.route("**/coding-homework-grader/prepare-material", async route => {
      if (hold) { hold = false; await gate; }
      await route.continue().catch(() => {});
    });
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Generate embeddings", exact: true }).click();
    const progress = page.getByRole("dialog", { name: "Preparing reference materials…", exact: true });
    await expect(progress).toBeVisible();
    await progress.getByRole("button", { name: "Cancel", exact: true }).click();
    releasePreparation!();
    await expect(progress).toBeHidden();
    await expect(page.getByRole("button", { name: "Enable final submissions", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Generate embeddings", exact: true }).click();
    await expect(page.getByText("Reference selection is prepared.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Enable final submissions", exact: true }).click();
    await expect(page.getByRole("button", { name: "Disable final submissions", exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await expect(referenceB).not.toBeChecked(); await expect(referenceB).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.homework-reference-materials').screenshot({ path: "tmp/homework-reference-tab-mobile.png" });
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await expect(page.getByLabel("Students processed at once (1–4)")).toHaveValue("3");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('.homework-workflow-settings').screenshot({ path: "tmp/homework-settings-tab-mobile.png" });
  } finally { releasePreparation?.(); await model.close(); }
});
