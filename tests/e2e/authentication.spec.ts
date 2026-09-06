import { expect, loginThroughUi, test } from "./fixtures/auth";

test.describe("authentication", () => {
  test("redirects anonymous users from protected pages", async ({ page }) => {
    await page.goto("/courses");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("exposes the first-time account activation flow", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "First-time access" }).click();
    await expect(page.getByRole("heading", { name: "Activate your account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Activate account" })).toBeVisible();
  });

  test("signs in and signs out through the user interface", async ({ page }) => {
    await loginThroughUi(page, "teacher");
    await expect(page).toHaveURL(/\/subjects$/);
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
