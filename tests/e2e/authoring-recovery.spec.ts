import { responseJson } from "./fixtures/activity-suite";
import { expect, ORIGINAL_SOURCE, test } from "./fixtures/bank-course";

test.describe("authoring draft protection", { tag: "@regression" }, () => {
  test("keeps edits across tabs and Continue editing, then discards without saving", async ({ teacherPage: page, teacherApi, bankCourse: data }) => {
    await page.goto(data.editorPath);
    const title = page.getByLabel("Title", { exact: true });
    const draftTitle = `${data.title} unsaved`;
    await title.fill(draftTitle);
    await page.locator("#mcq-source").fill(ORIGINAL_SOURCE.replace("Addition", "Unsaved question"));
    await page.getByRole("tab", { name: "Concepts", exact: true }).click();
    await page.getByRole("tab", { name: "Activity", exact: true }).click();
    await expect(title).toHaveValue(draftTitle);
    await expect(page.locator("#mcq-source")).toHaveValue(/Unsaved question/);

    await page.getByRole("link", { name: "Courses", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Leave this page?" });
    await dialog.getByRole("button", { name: "Continue editing" }).click();
    await expect(page).toHaveURL(data.editorPath);
    await expect(title).toHaveValue(draftTitle);

    await page.getByRole("link", { name: "Courses", exact: true }).click();
    await dialog.getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL("/courses");
    const saved = await responseJson<{ activity: { title: string; config: { source: string } } }>(await teacherApi.get(data.courseActivityPath));
    expect(saved.activity).toMatchObject({ title: data.title, config: { source: ORIGINAL_SOURCE } });
    await page.goto(data.editorPath);
    await expect(title).toHaveValue(data.title);
    await expect(page.locator("#mcq-source")).toHaveValue(ORIGINAL_SOURCE);
  });

  test("keeps the draft and navigation blocked after a failed save, then saves and leaves on retry", async ({ teacherPage: page, teacherApi, bankCourse: data }) => {
    await page.goto(data.editorPath);
    const draftTitle = `${data.title} saved on retry`;
    const draftSource = ORIGINAL_SOURCE.replace("Addition", "Retried question");
    await page.getByLabel("Title", { exact: true }).fill(draftTitle);
    await page.locator("#mcq-source").fill(draftSource);
    await page.route(`**${data.courseActivityPath}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      await route.fulfill({ status: 503, json: { error: { code: "INTERNAL_ERROR", message: "E2E temporary save failure." } } });
    });
    await page.getByRole("link", { name: "Courses", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Leave this page?" });
    const failedSave = page.waitForResponse((response) => response.request().method() === "PATCH" && response.status() === 503);
    await dialog.getByRole("button", { name: "Save and leave" }).click();
    await failedSave;
    await expect(dialog.getByRole("button", { name: "Save and leave" })).toBeEnabled();
    await expect(page.getByText("E2E temporary save failure.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(data.editorPath);
    const unchanged = await responseJson<{ activity: { title: string } }>(await teacherApi.get(data.courseActivityPath));
    expect(unchanged.activity.title).toBe(data.title);

    await dialog.getByRole("button", { name: "Continue editing" }).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(draftTitle);
    await expect(page.locator("#mcq-source")).toHaveValue(draftSource);
    await page.unroute(`**${data.courseActivityPath}`);
    await page.getByRole("link", { name: "Courses", exact: true }).click();
    await dialog.getByRole("button", { name: "Save and leave" }).click();
    await expect(page).toHaveURL("/courses");
    await page.goto(data.editorPath);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(draftTitle);
    await expect(page.locator("#mcq-source")).toHaveValue(draftSource);
  });

  test("preserves unsaved authoring through a network session-check failure and recovery", async ({ teacherPage: page, bankCourse: data }) => {
    await page.goto(data.editorPath);
    const draftTitle = `${data.title} kept through reconnect`;
    await page.getByLabel("Title", { exact: true }).fill(draftTitle);
    await page.route("**/api/users/me", (route) => route.abort("connectionfailed"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const warning = page.getByRole("status").filter({ hasText: "Your activity remains open" });
    await expect(warning).toBeVisible();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(draftTitle);
    await expect(page).toHaveURL(data.editorPath);

    await page.unroute("**/api/users/me");
    await warning.getByRole("button", { name: "Retry" }).click();
    await expect(warning).toBeHidden();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(draftTitle);
    await page.getByRole("button", { name: "Save multiple choice questions" }).click();
    await expect(page.getByText("Multiple choice questions activity saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(draftTitle);
  });
});
