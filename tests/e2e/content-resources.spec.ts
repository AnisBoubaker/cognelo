import { readFile } from "node:fs/promises";
import { confirmSharedDialog, expect, test } from "./fixtures/auth";
import {
  provisionActivitySuite,
  removeActivitySuite,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

test.describe.serial("course content resources and folders", () => {
  let data: ActivitySuiteData | undefined;
  let folderTitle = "";
  let textTitle = "";
  let githubTitle = "";
  let fileTitle = "";

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
    folderTitle = `E2E resources ${data.token}`;
    textTitle = `E2E notes ${data.token}`;
    githubTitle = `E2E repository ${data.token}`;
    fileTitle = `E2E handout ${data.token}`;
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("creates nested text content, preserves it on duplication, and enforces inherited visibility", async ({
    teacherPage,
    studentPage
  }) => {
    test.setTimeout(180_000);
    if (!data) throw new Error("The content-resource suite was not provisioned.");

    await teacherPage.goto(`/courses/${data.courseId}?tab=content`);
    await createAndRenameRootFolder(teacherPage, folderTitle);

    await openCourseElementPicker(teacherPage);
    const picker = teacherPage.getByRole("dialog", { name: "Choose course element" });
    await choosePickerFolder(picker, folderTitle);
    await picker.getByRole("tab", { name: "Material", exact: true }).click();
    await picker.getByRole("button", { name: /^Text(?:\s|$)/ }).click();

    const settings = teacherPage.getByRole("dialog").filter({ has: teacherPage.getByRole("button", { name: "Save material" }) });
    await settings.getByLabel("Title", { exact: true }).fill(textTitle);
    await settings.getByLabel("Content", { exact: true }).fill("## Nested notes\n\nVisible only while the parent folder is visible.");
    await settings.getByRole("button", { name: "Save material" }).click();
    await expect(settings).toBeHidden();
    await expect(teacherPage.getByText(textTitle, { exact: true })).toBeVisible();

    await teacherPage.getByRole("button", { name: `Actions for ${textTitle}` }).click();
    await teacherPage.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    const duplicate = teacherPage.getByRole("dialog").filter({
      has: teacherPage.getByRole("button", { name: "Duplicate", exact: true })
    });
    const copyTitle = `${textTitle} independent copy`;
    await duplicate.locator("input").fill(copyTitle);
    await duplicate.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(duplicate).toBeHidden();
    await expect(teacherPage.getByText(copyTitle, { exact: true })).toBeVisible();

    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    const folderToggle = studentPage.locator("button.student-accordion-title-button").filter({ hasText: folderTitle });
    await expect(folderToggle).toBeVisible({ timeout: 60_000 });
    if ((await folderToggle.getAttribute("aria-expanded")) === "false") await folderToggle.click();
    await expect(studentPage.getByText(textTitle, { exact: true })).toBeVisible();
    await expect(studentPage.getByText(copyTitle, { exact: true })).toBeVisible();

    await teacherPage.getByRole("button", { name: `Actions for ${folderTitle}` }).click();
    await teacherPage.getByRole("menuitem", { name: "Hidden", exact: true }).click();
    await studentPage.reload();
    await expect(studentPage.getByText(folderTitle, { exact: true })).toHaveCount(0);
    await expect(studentPage.getByText(textTitle, { exact: true })).toHaveCount(0);

    await teacherPage.getByRole("button", { name: `Actions for ${folderTitle}` }).click();
    await teacherPage.getByRole("menuitem", { name: "Visible", exact: true }).click();
    await teacherPage.getByRole("button", { name: `Actions for ${copyTitle}` }).click();
    await teacherPage.getByRole("menuitem", { name: "Remove", exact: true }).click();
    await confirmSharedDialog(teacherPage, "Remove");
    await expect(teacherPage.getByText(copyTitle, { exact: true })).toHaveCount(0);
    await expect(teacherPage.getByText(textTitle, { exact: true })).toBeVisible();
  });

  test("creates a GitHub resource with a normalized link and exposes it to the learner", async ({
    teacherPage,
    studentPage
  }) => {
    if (!data) throw new Error("The content-resource suite was not provisioned.");
    await teacherPage.goto(`/courses/${data.courseId}?tab=content`);
    await openCourseElementPicker(teacherPage);
    const picker = teacherPage.getByRole("dialog", { name: "Choose course element" });
    await picker.getByRole("tab", { name: "Material", exact: true }).click();
    await picker.getByRole("button", { name: /^GitHub repo(?:\s|$)/ }).click();

    const settings = teacherPage.getByRole("dialog").filter({ has: teacherPage.getByRole("button", { name: "Save material" }) });
    await settings.getByLabel("Title", { exact: true }).fill(githubTitle);
    await settings.getByLabel("GitHub repository URL").fill("http://github.com/openai/openai-node///#readme");
    await settings.getByRole("button", { name: "Save material" }).click();
    await expect(settings).toBeHidden();

    const teacherLink = teacherPage.getByRole("link", { name: githubTitle, exact: true });
    await expect(teacherLink).toHaveAttribute("href", "https://github.com/openai/openai-node");
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    const studentLink = studentPage.getByRole("link", { name: githubTitle, exact: true });
    await expect(studentLink).toHaveAttribute("href", "https://github.com/openai/openai-node", { timeout: 30_000 });
    await expect(studentLink).toHaveAttribute("target", "_blank");
  });

  test("uploads and downloads an exact file through the file content plugin", async ({
    teacherPage,
    studentPage
  }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The content-resource suite was not provisioned.");
    const fileContents = `Cognelo E2E file ${data.token}\nSecond line\n`;

    await teacherPage.goto(`/courses/${data.courseId}?tab=content`);
    await openCourseElementPicker(teacherPage);
    const picker = teacherPage.getByRole("dialog", { name: "Choose course element" });
    await picker.getByRole("tab", { name: "Material", exact: true }).click();
    await picker.getByRole("button", { name: /^File(?:\s|$)/ }).click();

    const settings = teacherPage.getByRole("dialog").filter({ has: teacherPage.getByRole("button", { name: "Save material" }) });
    await settings.getByLabel("Title", { exact: true }).fill(fileTitle);
    await settings.getByLabel("File", { exact: true }).setInputFiles({
      name: `handout-${data.token}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(fileContents)
    });
    await settings.getByRole("button", { name: "Save material" }).click();
    await expect(settings).toBeHidden();

    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    const downloadPromise = studentPage.waitForEvent("download");
    await studentPage.getByRole("link", { name: fileTitle, exact: true }).click({ timeout: 30_000 });
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`handout-${data.token}.txt`);
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("The content resource download did not expose a local path.");
    expect(await readFile(downloadPath, "utf8")).toBe(fileContents);
  });

  test("moves content with the shared drag handle and keeps the saved order after reload", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The content-resource suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}?tab=content`);
    const source = page.getByRole("button", { name: `Drag ${githubTitle}` });
    const target = page.locator(`[data-content-item-id]`).filter({ hasText: folderTitle }).first();
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("The content rows could not be measured for drag-and-drop.");
    const sourcePoint = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
    const targetPoint = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
    await source.dispatchEvent("pointerdown", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: sourcePoint.x,
      clientY: sourcePoint.y,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse"
    });
    await page.evaluate(({ x, y }) => {
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, buttons: 1, clientX: x, clientY: y, isPrimary: true, pointerId: 1, pointerType: "mouse" }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, buttons: 0, clientX: x, clientY: y, isPrimary: true, pointerId: 1, pointerType: "mouse" }));
    }, targetPoint);
    await expect
      .poll(async () => page.locator(`[data-content-item-id]`).filter({ hasText: githubTitle }).first().evaluate((row) => Number.parseFloat(getComputedStyle(row).paddingLeft)))
      .toBeGreaterThan(14);
    await page.reload();
    await expect
      .poll(async () => page.locator(`[data-content-item-id]`).filter({ hasText: githubTitle }).first().evaluate((row) => Number.parseFloat(getComputedStyle(row).paddingLeft)))
      .toBeGreaterThan(14);
  });
});

async function openCourseElementPicker(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Content tree actions" }).click();
  await page.getByRole("menuitem", { name: "New activity", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Choose course element" })).toBeVisible();
}

async function createAndRenameRootFolder(page: import("@playwright/test").Page, title: string) {
  await page.getByRole("button", { name: "Content tree actions" }).click();
  await page.getByRole("menuitem", { name: "New root folder", exact: true }).click();
  const input = page.getByLabel("Rename New folder");
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

async function choosePickerFolder(dialog: import("@playwright/test").Locator, title: string) {
  await dialog.getByRole("button", { name: /Root/ }).click();
  await dialog.getByRole("option", { name: title, exact: true }).click();
}
