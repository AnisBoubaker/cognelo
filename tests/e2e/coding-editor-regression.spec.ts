import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/auth";
import {
  copyAndAssignBankActivity,
  createBankActivityThroughUi,
  openStudentActivity,
  provisionActivitySuite,
  publishCurrentBankActivity,
  removeActivitySuite,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

test.describe("coding exercise editor boundaries", () => {
  let data: ActivitySuiteData | undefined;

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("keeps an empty protected editor on one line and types from the cursor", async ({ teacherPage, studentPage }) => {
    test.setTimeout(180_000);
    if (!data) throw new Error("The activity suite was not provisioned.");

    const title = `E2E protected coding editor ${data.token}`;
    const bankActivityId = await createBankActivityThroughUi(teacherPage, data, {
      category: "Programming",
      typeName: "Coding exercise"
    });

    await teacherPage.getByLabel("Title", { exact: true }).fill(title);
    await teacherPage.getByLabel("Description").fill("Verify protected editor boundaries.");
    await teacherPage.getByRole("textbox", { name: "Prompt" }).fill("Write a short Python program for this regression check.");
    await teacherPage.getByLabel("Language", { exact: true }).selectOption("python");
    await teacherPage
      .getByText("Reference solution", { exact: true })
      .locator("..")
      .getByRole("textbox")
      .fill("print(f'Hello, {input().strip()}!')");
    await teacherPage
      .locator("label.editor-section-label")
      .filter({ hasText: /^Template$/ })
      .locator("..")
      .locator("textarea.code-editor-input")
      .fill("{{ STUDENT_CODE }}\n\n{{ TEST_CODE }}");
    await teacherPage.getByRole("button", { name: "Save coding exercise" }).click();
    await expect(teacherPage.getByText("Coding exercise saved.", { exact: true })).toBeVisible();
    await publishCurrentBankActivity(teacherPage);

    await copyAndAssignBankActivity(data, {
      activityTypeKey: "coding-exercise",
      bankActivityId,
      title
    });
    await openStudentActivity(studentPage, data, title);

    const studentCodeEditor = studentPage.getByRole("textbox", { name: title, exact: true });
    const studentEditorSurface = studentCodeEditor
      .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' monaco-code-editor ')][1]")
      .locator(".view-lines");
    await expect(studentEditorSurface.locator(".view-line")).toHaveCount(1);

    await studentEditorSurface.click();
    await studentPage.keyboard.type("abc");
    await expect.poll(() => getLastMonacoModelValue(studentPage)).toBe("abc");
    await expect(studentEditorSurface.locator(".view-line")).toHaveCount(1);
  });
});

async function getLastMonacoModelValue(page: Page) {
  return page.evaluate(() => {
    const monaco = (
      globalThis as typeof globalThis & {
        monaco?: { editor?: { getModels?: () => Array<{ getValue: () => string }> } };
      }
    ).monaco;
    return monaco?.editor?.getModels?.().at(-1)?.getValue();
  });
}
