import type { Page } from "@playwright/test";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import {
  createBankActivityThroughUi,
  provisionActivitySuite,
  removeActivitySuite,
  responseJson,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

test.describe.serial("subject programming-language defaults", () => {
  let data: ActivitySuiteData | undefined;

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
    const api = await createAuthenticatedApi("teacher");
    try {
      await responseJson(
        await api.patch(`/api/subjects/${data.subjectId}`, {
          data: { programmingLanguage: "cpp" }
        })
      );
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("shows the configured default on the subject", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await mockProgrammingLanguages(page);
    await page.goto(`/subjects/${data.subjectId}/edit`);
    const language = page.getByLabel("Default programming language");
    await expect(language).toHaveValue("cpp");
    await expect(language.getByRole("option", { name: "Multiple programming languages" })).toHaveCount(1);
    await expect(language.getByRole("option", { name: "Bash" })).toHaveCount(1);
  });

  test("presets a new course programming exercise", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await mockProgrammingLanguages(page);
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: "Content tree actions" }).click();
    await page.getByRole("menuitem", { name: "New activity" }).click();
    const picker = page.getByRole("dialog", { name: "Choose course element" });
    await picker.getByRole("tab", { name: "Programming", exact: true }).click();
    await picker.getByRole("button", { name: /^Coding exercise/ }).click();
    await expect(page.getByLabel("Language", { exact: true })).toHaveValue("cpp");
  });

  test("presets a new bank programming exercise", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await mockProgrammingLanguages(page);
    await createBankActivityThroughUi(page, data, { category: "Programming", typeName: /^Coding exercise/ });
    await expect(page.getByLabel("Language", { exact: true })).toHaveValue("cpp");
  });

  test("requires an exercise-level choice for a multiple-language subject", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const api = await createAuthenticatedApi("teacher");
    try {
      await responseJson(
        await api.patch(`/api/subjects/${data.subjectId}`, {
          data: { programmingLanguage: "multiple" }
        })
      );
    } finally {
      await api.dispose();
    }

    await mockProgrammingLanguages(page);
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: "Content tree actions" }).click();
    await page.getByRole("menuitem", { name: "New activity" }).click();
    const picker = page.getByRole("dialog", { name: "Choose course element" });
    await picker.getByRole("tab", { name: "Programming", exact: true }).click();
    await picker.getByRole("button", { name: /^Coding exercise/ }).click();

    const language = page.getByLabel("Language", { exact: true });
    await expect(language).toHaveValue("");
    await expect(language.getByRole("option", { name: "--- Choose ---" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Generate prompt automatically" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save coding exercise" })).toBeDisabled();

    await language.selectOption("bash");
    await expect(page.getByRole("button", { name: "Save coding exercise" })).toBeEnabled();
  });
});

async function mockProgrammingLanguages(page: Page) {
  await page.route("**/api/programming-languages", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      languages: [
        { key: "bash", label: "Bash" },
        { key: "cpp", label: "C++" },
        { key: "python", label: "Python 3" }
      ]
    })
  }));
}
