import { expect, test } from "./fixtures/auth";

test.describe("role-aware navigation", () => {
  test("students only receive learner navigation", async ({ studentPage: page }) => {
    await page.goto("/courses");
    const primary = page.getByRole("navigation", { name: "Primary" });
    await expect(primary.getByRole("link", { name: "Courses" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "Subjects" })).toHaveCount(0);
    await expect(primary.getByRole("link", { name: "Activity banks" })).toHaveCount(0);
    await expect(primary.getByRole("link", { name: "New course" })).toHaveCount(0);
  });

  test("teachers can reach authoring, courses, and personal settings", async ({ teacherPage: page }) => {
    await page.goto("/subjects");
    const primary = page.getByRole("navigation", { name: "Primary" });
    await expect(primary.getByRole("link", { name: "Subjects" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "Activity banks" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "Courses" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "New course" })).toBeVisible();

    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible();
    const settings = page.getByRole("complementary", { name: "Settings" });
    await expect(settings.getByRole("link", { name: /Profile/ })).toBeVisible();
    await expect(settings.getByRole("link", { name: /AI agents/ })).toBeVisible();
    await expect(settings.getByRole("link", { name: /Users/ })).toHaveCount(0);
  });
});
