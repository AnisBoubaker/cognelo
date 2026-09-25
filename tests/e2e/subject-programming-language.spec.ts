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
    await page.goto(`/subjects/${data.subjectId}/edit`);
    await expect(page.getByLabel("Default programming language")).toHaveValue("cpp");
  });

  test("presets a new course programming exercise", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
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
    await createBankActivityThroughUi(page, data, { category: "Programming", typeName: /^Coding exercise/ });
    await expect(page.getByLabel("Language", { exact: true })).toHaveValue("cpp");
  });
});
