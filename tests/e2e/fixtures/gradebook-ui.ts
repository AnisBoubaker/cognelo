import type { Page } from "@playwright/test";

export async function openGradebookActions(page: Page, title: string) {
  await page.getByRole("button", { name: `${title}: Actions`, exact: true }).click();
  return page.getByRole("menu");
}
