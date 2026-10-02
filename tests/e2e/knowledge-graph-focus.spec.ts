import { randomUUID } from "node:crypto";
import { prisma } from "@cognelo/db";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";

test.describe.serial("knowledge graph dialog focus", () => {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const conceptTitle = `Focus concept ${token}`;
  const skillTitle = "Original skill";
  const misconceptionTitle = "Original misconception";
  let subjectId = "";

  test.beforeAll(async () => {
    const api = await createAuthenticatedApi("teacher");
    try {
      const result = await responseJson<{ subject: { id: string } }>(
        await api.post("/api/subjects", {
          data: {
            description: "Disposable subject for graph dialog focus coverage.",
            title: `E2E knowledge graph focus ${token}`
          }
        })
      );
      subjectId = result.subject.id;
      await responseJson(
        await api.patch(`/api/subjects/${subjectId}`, {
          data: {
            knowledgeGraph: {
              concepts: [{
                id: randomUUID(),
                title: conceptTitle,
                skills: skillTitle,
                misconceptions: [misconceptionTitle],
                positionX: 0,
                positionY: 0,
                skillRecords: [{ id: randomUUID(), title: skillTitle, position: 0, active: true }],
                misconceptionRecords: [{ id: randomUUID(), title: misconceptionTitle, position: 0, active: true }]
              }],
              prerequisites: []
            }
          }
        })
      );
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    if (subjectId) await prisma.subject.deleteMany({ where: { id: subjectId } });
  });

  test("uses the shared text prompt for rich-text links", async ({ teacherPage: page }) => {
    await page.goto(`/subjects/${subjectId}/edit`);
    await page.getByRole("button", { name: "Link", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Link" });
    const input = dialog.getByLabel("Enter the link URL");
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("https://");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test("keeps skill and misconception inputs focused while typing", async ({ teacherPage: page }) => {
    await page.goto(`/subjects/${subjectId}/edit`);
    await page.getByRole("tab", { name: "Knowledge graph" }).click();
    await page.locator(".react-flow__node").filter({ hasText: conceptTitle }).click();

    await page.getByRole("button", { name: "Edit skill" }).click();
    let dialog = page.getByRole("dialog", { name: "Edit skill" });
    let input = dialog.getByLabel("Skill description");
    await expect(input).toBeFocused();
    await input.press("ControlOrMeta+A");
    await input.pressSequentially("Updated skill");
    await expect(input).toHaveValue("Updated skill");
    await expect(input).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Edit misconception" }).click();
    dialog = page.getByRole("dialog", { name: "Edit misconception" });
    input = dialog.getByLabel("Wrong belief");
    await expect(input).toBeFocused();
    await input.press("ControlOrMeta+A");
    await input.pressSequentially("Updated misconception");
    await expect(input).toHaveValue("Updated misconception");
    await expect(input).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});
