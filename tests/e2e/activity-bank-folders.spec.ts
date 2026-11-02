import { test, expect } from "./fixtures/bank-course";
import { responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";

test.describe("activity bank folder preferences", { tag: "@regression" }, () => {
  test.beforeEach(async ({ teacherApi, bankCourse: data }) => {
    const base = `/api/activity-banks/${data.activityBankId}`;
    const { folder: root } = await responseJson<{ folder: { id: string } }>(await teacherApi.post(`${base}/folders`, { data: { title: "Bank root" } }));
    const { folder: child } = await responseJson<{ folder: { id: string } }>(await teacherApi.post(`${base}/folders`, { data: { title: "Nested practice", parentId: root.id } }));
    await responseJson(await teacherApi.post(`${base}/folders`, { data: { title: "Other folder" } }));
    await responseJson(await teacherApi.patch(`${base}/activities/${data.bankActivityId}/placement`, { data: { folderId: child.id } }));
  });

  test("starts collapsed, restores nested choices and bulk controls, and expires like course content", async ({ teacherPage: page, teacherApi, bankCourse: data }) => {
    await page.clock.install();
    await page.goto(`/activity-banks/${data.activityBankId}`);
    const activity = page.getByRole("link", { name: data.title, exact: true });
    await expect(page.getByRole("button", { name: "Expand Bank root", exact: true })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Nested practice", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Expand Bank root", exact: true }).click();
    await expect(activity).toBeHidden();
    await page.getByRole("button", { name: "Expand Nested practice", exact: true }).click();
    await expect(activity).toBeVisible();
    await page.reload();
    await expect(activity).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand Other folder", exact: true })).toBeVisible();
    await activity.click();
    await expect(page).toHaveURL(new RegExp(`/activities/${data.bankActivityId}$`));
    await page.goBack();
    await expect(activity).toBeVisible();

    await responseJson(await teacherApi.post(`/api/activity-banks/${data.activityBankId}/folders`, { data: { title: "Newly loaded folder" } }));
    await page.reload();
    await expect(activity).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand Newly loaded folder", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Expand all", exact: true }).click();
    await page.reload();
    await expect(activity).toBeVisible();
    await expect(page.getByRole("button", { name: "Collapse Other folder", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collapse Newly loaded folder", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Collapse all", exact: true }).click();
    await page.reload();
    await expect(page.getByText("Nested practice", { exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Expand Other folder", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Expand all", exact: true }).click();
    await page.clock.fastForward(3 * 60 * 60 * 1000);
    await page.reload();
    await expect(activity).toBeVisible();
    await page.clock.fastForward(2 * 60 * 60 * 1000);
    await expect(activity).toBeVisible();
    await page.clock.fastForward(2 * 60 * 60 * 1000);
    await expect(page.getByRole("button", { name: "Expand Bank root", exact: true })).toBeVisible();
    await expect(activity).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Expand all", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collapse all", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test("keeps bank and user preferences independent in the same browser", async ({ teacherPage: page, teacherApi, bankCourse: data }) => {
    await responseJson(await teacherApi.post(`/api/activity-banks/${data.secondaryActivityBankId}/folders`, { data: { title: "Second bank folder" } }));
    const firstUrl = `/activity-banks/${data.activityBankId}`;
    await page.goto(firstUrl);
    await page.getByRole("button", { name: "Expand all", exact: true }).click();
    await expect(page.getByRole("link", { name: data.title, exact: true })).toBeVisible();
    await page.goto(`/activity-banks/${data.secondaryActivityBankId}`);
    await expect(page.getByRole("button", { name: "Expand Second bank folder", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Expand Second bank folder", exact: true }).click();
    await page.goto(firstUrl);
    await expect(page.getByRole("link", { name: data.title, exact: true })).toBeVisible();

    const teacherCookies = await page.context().cookies();
    const admin = await createAuthenticatedApi("admin");
    try {
      await page.context().clearCookies();
      await page.context().addCookies((await admin.storageState()).cookies);
      await page.goto(firstUrl);
      await expect(page.getByRole("button", { name: "Expand Bank root", exact: true })).toBeVisible();
      await expect(page.getByText("Nested practice", { exact: true })).toBeHidden();
      await page.context().clearCookies();
      await page.context().addCookies(teacherCookies);
      await page.goto(firstUrl);
      await expect(page.getByRole("link", { name: data.title, exact: true })).toBeVisible();
    } finally { await admin.dispose(); }
  });

  test("keeps controls usable without local storage", async ({ teacherPage: page, bankCourse: data }) => {
    await page.addInitScript(() => {
      for (const method of ["getItem", "setItem", "removeItem"] as const) {
        const original = Storage.prototype[method];
        Object.defineProperty(Storage.prototype, method, { configurable: true, value: function (key: string, ...rest: string[]) {
          if (key.startsWith("cognelo:bank-folders:")) throw new DOMException("Storage blocked", "SecurityError");
          return Reflect.apply(original, this, [key, ...rest]);
        } });
      }
    });
    await page.goto(`/activity-banks/${data.activityBankId}`);
    await page.getByRole("button", { name: "Expand all", exact: true }).click();
    await expect(page.getByRole("link", { name: data.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Collapse Bank root", exact: true }).click();
    await expect(page.getByText("Nested practice", { exact: true })).toBeHidden();
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand Bank root", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Expand all", exact: true }).click();
    await expect(page.getByRole("link", { name: data.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Collapse all", exact: true }).click();
    await expect(page.getByText("Nested practice", { exact: true })).toBeHidden();
  });
});
