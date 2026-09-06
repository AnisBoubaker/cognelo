import { prisma } from "@cognelo/db";
import { expect, test } from "./fixtures/auth";

test.describe("administrator workflows", () => {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-admin-created-${token}@example.invalid`;

  test.afterEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  test("creates and filters a user, then reaches platform settings", async ({ adminPage: page }) => {
    await page.goto("/settings/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    await page.getByRole("button", { name: "Add user" }).click();
    const dialog = page.getByRole("dialog", { name: "Add user" });
    await dialog.getByLabel("First name").fill("E2E");
    await dialog.getByLabel("Last name").fill("Learner");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Initial password").fill("Temporary123!");
    await dialog.getByLabel("Student").check();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    const settings = page.getByRole("complementary", { name: "Settings" });
    await settings.getByRole("link", { name: /Plugins/ }).click();
    await expect(page.getByRole("heading", { name: "Plugin availability" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Activity plugins" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Content type plugins" })).toBeVisible();

    await page.getByRole("complementary", { name: "Settings" }).getByRole("link", { name: /Email delivery/ }).click();
    await expect(page.getByRole("heading", { name: "Email delivery" })).toBeVisible();
    await expect(page.getByLabel("Delivery method")).toBeVisible();
  });
});
