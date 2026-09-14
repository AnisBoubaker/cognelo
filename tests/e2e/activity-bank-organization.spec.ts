import { prisma } from "@cognelo/db";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import {
  type ActivitySuiteData,
  provisionActivitySuite,
  removeActivitySuite,
  responseJson
} from "./fixtures/activity-suite";

test.describe("activity bank organization", () => {
  let data: ActivitySuiteData | undefined;
  let conceptOneTitle = "";
  let conceptTwoTitle = "";
  let activityOneTitle = "";
  let activityTwoTitle = "";

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
    conceptOneTitle = `Variables ${data.token}`;
    conceptTwoTitle = `Conditions ${data.token}`;
    activityOneTitle = `Variables activity ${data.token}`;
    activityTwoTitle = `Conditions activity ${data.token}`;
    const [conceptOne, conceptTwo] = await Promise.all([
      prisma.subjectKnowledgeConcept.create({ data: { subjectId: data.subjectId, title: conceptOneTitle } }),
      prisma.subjectKnowledgeConcept.create({ data: { subjectId: data.subjectId, title: conceptTwoTitle } })
    ]);
    const api = await createAuthenticatedApi("teacher");
    try {
      for (const [title, conceptId] of [[activityOneTitle, conceptOne.id], [activityTwoTitle, conceptTwo.id]] as const) {
        await responseJson(await api.post(`/api/activity-banks/${data.activityBankId}/activities`, {
          data: {
            activityTypeKey: "mcq",
            title,
            knowledgeConceptSelections: [{ conceptId, selectsAllSkills: true, selectedSkillIds: [], selectedSkills: [] }]
          }
        }));
      }
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("creates folders, drags activities into them, and filters by subject concepts", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const folderTitle = `Fundamentals ${data.token}`;
    await page.goto(`/activity-banks/${data.activityBankId}`);
    await expect(page.getByText(activityOneTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(activityTwoTitle, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "New folder", exact: true }).click();
    const folderName = page.getByRole("textbox", { name: "Rename New folder" });
    await folderName.fill(folderTitle);
    await folderName.press("Enter");
    await expect(page.getByText(folderTitle, { exact: true })).toBeVisible();

    const source = page.getByRole("button", { name: `Drag ${activityOneTitle}` });
    const target = page.locator("[data-bank-tree-item-id]").filter({ hasText: folderTitle });
    const [sourceBox, targetBox] = await Promise.all([source.boundingBox(), target.boundingBox()]);
    if (!sourceBox || !targetBox) throw new Error("The drag source or folder target was not visible.");
    const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
    const destination = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
    const placementUpdated = page.waitForResponse(
      (response) => response.ok() && response.request().method() === "PATCH" && response.url().endsWith("/placement"),
      { timeout: 10_000 }
    );
    await source.dispatchEvent("pointerdown", { ...start, button: 0, buttons: 1, isPrimary: true, pointerId: 1, pointerType: "mouse" });
    await page.evaluate(({ start, destination }) => {
      window.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, button: 0, buttons: 1, clientX: start.x + 12, clientY: start.y + 12, isPrimary: true, pointerId: 1, pointerType: "mouse"
      }));
      window.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, button: 0, buttons: 1, clientX: destination.x, clientY: destination.y, isPrimary: true, pointerId: 1, pointerType: "mouse"
      }));
      window.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true, button: 0, buttons: 0, clientX: destination.x, clientY: destination.y, isPrimary: true, pointerId: 1, pointerType: "mouse"
      }));
    }, { start, destination });
    await placementUpdated;
    await expect.poll(async () => {
      const activity = await prisma.bankActivity.findFirst({ where: { bankId: data?.activityBankId, title: activityOneTitle } });
      return activity?.folderId;
    }).not.toBeNull();

    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const filterDialog = page.getByRole("dialog", { name: "Filter by concepts" });
    const conceptOneRow = filterDialog.locator("label").filter({ hasText: conceptOneTitle });
    const conceptTwoRow = filterDialog.locator("label").filter({ hasText: conceptTwoTitle });
    await expect(conceptOneRow.getByText("1", { exact: true })).toBeVisible();
    await expect(conceptTwoRow.getByText("1", { exact: true })).toBeVisible();
    await conceptOneRow.getByRole("checkbox").check();
    await filterDialog.getByRole("button", { name: "Apply filters" }).click();

    await expect(page.getByText(folderTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(activityOneTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(activityTwoTitle, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Filters (1)", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Filters (1)", exact: true }).click();
    await page.getByRole("dialog", { name: "Filter by concepts" }).getByRole("button", { name: "Clear", exact: true }).click();
    await page.getByRole("dialog", { name: "Filter by concepts" }).getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByText(activityTwoTitle, { exact: true })).toBeVisible();
  });
});
