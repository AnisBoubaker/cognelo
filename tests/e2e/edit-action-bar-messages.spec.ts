import { test, expect } from "./fixtures/bank-course";

test("compact save bars remain clickable beside the fixed Messages launcher", async ({ bankCourse: data, teacherPage: page }) => {
  test.setTimeout(90_000); page.setDefaultTimeout(10_000);
  await page.goto(data.editorPath);
  const title = page.getByLabel("Title", { exact: true });
  const bar = page.locator(".edit-action-bar");
  const save = bar.getByRole("button", { name: "Save multiple choice questions", exact: true });
  const cancel = bar.getByRole("button", { name: "Cancel", exact: true });
  await title.fill(`${data.title} saved`); await save.click();
  const toast = page.getByRole("status").filter({ hasText: "Multiple choice questions activity saved." });
  await expect(toast).toBeVisible(); await toast.getByRole("button").click(); await expect(save).toBeDisabled();
  const messages = page.getByRole("button", { name: "Messages", exact: true });
  await expect(messages).toBeVisible();
  for (const viewport of [{ width: 1280, height: 900, rtl: false }, { width: 1024, height: 768, rtl: false }, { width: 820, height: 900, rtl: false }, { width: 390, height: 844, rtl: false }, { width: 1280, height: 900, rtl: true }, { width: 390, height: 844, rtl: true }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(rtl => { document.documentElement.dir = rtl ? "rtl" : "ltr"; }, viewport.rtl);
    await title.fill(`${data.title} pending ${viewport.width}`);
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeEnabled(); await expect(cancel).toBeEnabled();
    const launcher = (await messages.boundingBox())!;
    expect(Math.abs(launcher.x + launcher.width - (viewport.width - 24))).toBeLessThan(2);
    expect(Math.abs(launcher.y + launcher.height - (viewport.height - 24))).toBeLessThan(2);
    for (const button of [save, cancel]) {
      const box = (await button.boundingBox())!;
      const overlap = Math.min(box.x + box.width, launcher.x + launcher.width) > Math.max(box.x, launcher.x)
        && Math.min(box.y + box.height, launcher.y + launcher.height) > Math.max(box.y, launcher.y);
      expect(overlap).toBe(false);
      await button.click({ trial: true });
    }
    if (viewport.width > 800) {
      const measurements = await bar.evaluate(element => ({ width: element.getBoundingClientRect().width, parent: element.parentElement!.getBoundingClientRect().width }));
      expect(measurements.width).toBeLessThan(measurements.parent - 80);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `tmp/edit-action-bar-messages-${viewport.width}${viewport.rtl ? "-rtl" : ""}.png` });
    await cancel.click(); await expect(title).toHaveValue(`${data.title} saved`);
  }
  await title.fill(`${data.title} final`); await save.click();
  await expect(page.getByText("Multiple choice questions activity saved.", { exact: true })).toBeVisible();
  await expect(save).toBeDisabled();
});
