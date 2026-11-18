import type { Page } from "@playwright/test";

export async function openGradebookActions(page: Page, title: string) {
  await page.getByRole("button", { name: `${title}: Actions`, exact: true }).click();
  return page.getByRole("menu");
}

export async function openActivityReportActions(page: Page) {
  const trigger = page.getByRole("button", { name: "Activity actions", exact: true });
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  return page.getByRole("menu", { name: "Activity actions", exact: true });
}
