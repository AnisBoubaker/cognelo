import { prisma } from "@cognelo/db";
import { expect, test } from "./fixtures/auth";
import {
  createCourseTestThroughUi,
  provisionActivitySuite,
  publishCurrentBankActivity,
  removeActivitySuite,
  responseJson,
  type ActivitySuiteData
} from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";

test.describe.serial("reusable bank Tests", () => {
  let data: ActivitySuiteData | undefined;

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("authors, imports, and publishes independent Test graphs", async ({ teacherPage: page }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The reusable Test fixture was not provisioned.");
    const sourceTitle = `E2E reusable source ${data.token}`;
    const bankTestTitle = `E2E reusable Test ${data.token}`;
    const courseTestTitle = `E2E course Test to bank ${data.token}`;
    const api = await createAuthenticatedApi("teacher");
    try {
      const { activity: source } = await responseJson<{ activity: { id: string } }>(
        await api.post(`/api/activity-banks/${data.activityBankId}/activities`, {
          data: {
            activityTypeKey: "mcq",
            title: sourceTitle,
            description: "Reusable source that may be deleted.",
            lifecycle: "published",
            config: {
              source: "## Independence\nWhich value is correct?\n\n- [x] 42\n- [ ] 41",
              aiGenerationInstructions: "",
              aiQuestionCount: 5,
              defaultCodeLanguage: "none",
              randomizeChoices: false,
              aiFeedbackEnabled: false,
              aiFeedbackInstructions: ""
            },
            metadata: {},
            position: 0
          }
        })
      );

      await page.goto(`/activity-banks/${data.activityBankId}`);
      await page.getByRole("button", { name: "Add activity", exact: true }).click();
      const createPicker = page.getByRole("dialog", { name: "Choose an activity" });
      await createPicker.getByRole("tab", { name: "Generic Activity", exact: true }).click();
      await createPicker.getByRole("button", { name: /^Test/ }).click();
      await expect(page.getByRole("heading", { name: "Assessment details" })).toBeVisible();
      await page.getByLabel("Title", { exact: true }).fill(bankTestTitle);
      await page.getByRole("button", { name: "Save Test settings" }).click();
      await expect(page.getByText("Reusable Test settings saved.", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Add activity", exact: true }).click();
      const compositionPicker = page.getByRole("dialog", { name: "Add activity to Test" });
      await compositionPicker.getByLabel("Activity bank").selectOption(data.activityBankId);
      await compositionPicker.getByRole("button", { name: new RegExp(`^${escapeRegex(sourceTitle)}`) }).click();
      await expect(page.getByText(`1. ${sourceTitle}`, { exact: true })).toBeVisible();
      await publishCurrentBankActivity(page);
      const bankTestActivityId = page.url().match(/\/activities\/([^/?#]+)/)?.[1];
      if (!bankTestActivityId) throw new Error("The bank Test activity ID was not present in the URL.");

      await responseJson(await api.delete(`/api/activity-banks/${data.activityBankId}/activities/${source.id}`, { data: { force: true } }));
      await page.reload();
      await expect(page.getByText(`1. ${sourceTitle}`, { exact: true })).toBeVisible();

      await page.goto(`/courses/${data.courseId}?tab=content`);
      await page.getByRole("button", { name: "Content tree actions" }).click();
      await page.getByRole("menuitem", { name: "New activity" }).click();
      const coursePicker = page.getByRole("dialog", { name: "Choose course element" });
      await coursePicker.getByLabel("Activity bank").selectOption(data.activityBankId);
      await coursePicker.getByRole("button", { name: new RegExp(`^${escapeRegex(bankTestTitle)}`) }).click();
      await expect(page.getByRole("heading", { name: "Assessment details" })).toBeVisible();
      await expect(page.getByText(`1. ${sourceTitle}`, { exact: true })).toBeVisible();

      const importedShellId = page.url().match(/\/activities\/([^/?#]+)/)?.[1];
      if (!importedShellId) throw new Error("The imported course Test ID was not present in the URL.");
      const imported = await prisma.test.findUniqueOrThrow({
        where: { activityId: importedShellId },
        include: { activity: true, items: { include: { activity: true } } }
      });
      expect(imported.activity.bankActivityId).toBe(bankTestActivityId);
      expect(imported.items).toHaveLength(1);
      expect(imported.items[0].activity.bankActivityId).not.toBe(source.id);
      expect(await prisma.bankActivity.findUnique({ where: { id: source.id } })).toBeNull();

      const localCourseTestId = await createCourseTestThroughUi(page, data, courseTestTitle);
      await page.getByRole("button", { name: "Add activity", exact: true }).click();
      const localChildPicker = page.getByRole("dialog", { name: "Add activity to Test" });
      await localChildPicker.getByRole("tab", { name: "Generic Activity", exact: true }).click();
      await localChildPicker.getByRole("button", { name: /Mult.*choice questions/ }).click();
      await expect(page.getByText(/^1\. Multpiple choice questions$/)).toBeVisible();
      await page.getByRole("button", { name: "Add to activity bank" }).click();
      const publishDialog = page.getByRole("dialog", { name: "Add this Test to an activity bank" });
      await publishDialog.getByLabel("Activity bank").selectOption(data.secondaryActivityBankId);
      await publishDialog.getByRole("button", { name: "Add and publish" }).click();
      await expect(page).toHaveURL(new RegExp(`/activity-banks/${escapeRegex(data.secondaryActivityBankId)}/activities/[^/?#]+$`));
      await expect(page.getByText(/^Test · Published · v\d+$/)).toBeVisible();

      const linkedCourseTest = await prisma.test.findUniqueOrThrow({
        where: { activityId: localCourseTestId },
        include: { activity: true, items: { include: { activity: true } } }
      });
      expect(linkedCourseTest.activity.bankActivityId).toBeTruthy();
      expect(linkedCourseTest.activity.activityVersionId).toBeTruthy();
      expect(linkedCourseTest.items[0].activity.bankActivityId).toBeTruthy();
      expect(linkedCourseTest.items[0].activity.activityVersionId).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
