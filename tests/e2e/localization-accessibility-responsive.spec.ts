import { expect, test } from "./fixtures/auth";

test.describe("localization, keyboard access, and responsive layout", () => {
  test("persists a French locale selection across navigation and reload", async ({ teacherPage: page }) => {
    await page.goto("/subjects");
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByLabel("Language").selectOption("fr");
    await expect(page.getByRole("heading", { name: "Matières", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Matières", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Cours", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Espace des cours", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Ouvrir le menu du compte" }).click();
    await page.getByLabel("Langue").selectOption("en");
    await expect(page.getByRole("heading", { name: "Course workspace", exact: true })).toBeVisible();
  });

  test("opens and dismisses content menus entirely from the keyboard", async ({ teacherPage: page }) => {
    await page.goto("/courses/seed-course-programming-101?tab=content");
    const trigger = page.getByRole("button", { name: "Content tree actions" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("keeps the course workspace and fixed context menu inside a narrow viewport", async ({ teacherPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/courses/seed-course-programming-101?tab=content");
    await page.getByRole("button", { name: "Content tree actions" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    const geometry = await page.evaluate(() => {
      const menu = document.querySelector<HTMLElement>("[role='menu']");
      const main = document.querySelector<HTMLElement>("main");
      if (!menu || !main) return null;
      const menuBounds = menu.getBoundingClientRect();
      return {
        bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOverflow: main.scrollWidth - main.clientWidth,
        menuLeft: menuBounds.left,
        menuRight: menuBounds.right,
        viewportWidth: window.innerWidth
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry?.bodyOverflow).toBeLessThanOrEqual(1);
    expect(geometry?.mainOverflow).toBeLessThanOrEqual(1);
    expect(geometry?.menuLeft).toBeGreaterThanOrEqual(7);
    expect(geometry?.menuRight).toBeLessThanOrEqual((geometry?.viewportWidth ?? 0) - 7);
  });
});
