import { prisma } from "@cognelo/db";
import { expect, test } from "./fixtures/auth";

test.describe("teacher authoring and course setup", () => {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const subjectTitle = `E2E subject ${token}`;
  const bankTitle = `E2E activity bank ${token}`;
  const courseTitle = `E2E course ${token}`;
  const groupTitle = `E2E cohort ${token}`;

  test.afterEach(async () => {
    await prisma.subject.deleteMany({ where: { title: subjectTitle } });
  });

  test("creates a subject, activity bank, course, group, and linked participant", async ({ teacherPage: page }) => {
    await page.goto("/subjects");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Title").fill(subjectTitle);
    await page.getByLabel("Description").fill("Created by the Playwright teacher flow.");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(subjectTitle) })).toBeVisible();

    const primary = page.getByRole("navigation", { name: "Primary" });
    await primary.getByRole("link", { name: "Activity banks", exact: true }).click();
    await page.getByRole("button", { name: "Add activity bank" }).click();
    const bankDialog = page.getByRole("dialog", { name: "Add activity bank" });
    await bankDialog.getByLabel("Subject").selectOption({ label: subjectTitle });
    await bankDialog.getByLabel("Title").fill(bankTitle);
    await bankDialog.getByLabel("Description").fill("Disposable E2E activity bank.");
    await bankDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("link", { name: new RegExp(bankTitle) })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "New course", exact: true }).click();
    await page.getByLabel("Subject").selectOption({ label: subjectTitle });
    await page.getByLabel("Title").fill(courseTitle);
    await page.getByLabel("Description").fill("Disposable E2E course.");
    await page.getByLabel("Status").selectOption("published");
    await page.getByRole("button", { name: "Create course" }).click();
    await expect(page.getByRole("heading", { name: courseTitle })).toBeVisible();

    await page.getByRole("tab", { name: "Participants" }).click();
    await page.getByRole("button", { name: "Create group" }).click();
    const groupDialog = page.getByRole("dialog", { name: "Create a group" });
    await groupDialog.getByLabel("Group title").fill(groupTitle);
    await groupDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: groupTitle })).toBeVisible();

    await page.getByRole("button", { name: "Add participant" }).click();
    const participantDialog = page.getByRole("dialog", { name: "Add a participant" });
    await participantDialog.getByLabel("Email").fill("student@cognelo.local");
    await participantDialog.getByLabel("Email").blur();
    await expect(participantDialog.getByLabel("First name")).toHaveValue(/.+/);
    await expect(participantDialog.getByLabel("Last name")).toHaveValue(/.+/);
    await participantDialog.getByRole("button", { name: "Add participant" }).click();
    await expect(page.getByText("student@cognelo.local", { exact: true })).toBeVisible();
  });
});
