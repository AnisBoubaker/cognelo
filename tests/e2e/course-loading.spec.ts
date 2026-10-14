import { expect, ORIGINAL_SOURCE, test } from "./fixtures/bank-course";
import { responseJson } from "./fixtures/activity-suite";
import type { CourseContentItem } from "../../apps/web/src/lib/api";

test.describe("independent course workspace loading", { tag: "@regression" }, () => {
  test("restores scrolling after importing a bank activity and saving its settings", async ({ teacherPage: page, teacherApi, bankCourse: data }) => {
    const title = `Scroll regression ${data.token}`;
    await responseJson(await teacherApi.post(`/api/activity-banks/${data.activityBankId}/activities`, {
      data: { activityTypeKey: "mcq", title, lifecycle: "published", config: { source: ORIGINAL_SOURCE }, metadata: {} }
    }));
    await Promise.all(Array.from({ length: 20 }, (_, position) => teacherApi.post(`/api/courses/${data.courseId}/content/folders`, {
      data: { title: `Scroll week ${position + 1}`, position, isVisible: true }
    }).then(responseJson)));
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: "Content tree actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "New activity", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Choose course element", exact: true });
    await picker.getByLabel("Activity bank", { exact: true }).selectOption(data.activityBankId);
    await picker.getByRole("button", { name: new RegExp(title) }).click();
    await expect(picker).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Add activity", exact: true })).toBeHidden();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

    const actions = page.getByRole("button", { name: `Actions for ${title}`, exact: true });
    await actions.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await actions.click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog", { name: title, exact: true });
    await settings.getByLabel("Enable activity messaging").check();
    await settings.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(settings).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const originalScroll = await page.evaluate(() => window.scrollY);
    expect(originalScroll).toBeGreaterThan(400);
    await page.mouse.move(500, 400);
    await page.mouse.wheel(0, -400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(originalScroll - 200);
    await page.mouse.wheel(0, 400);
    await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - originalScroll)).toBeLessThan(5);
  });

  for (const viewport of [{ name: "desktop", width: 1280, height: 800 }, { name: "mobile", width: 390, height: 844 }]) {
    test(`keeps the content position after settings and visibility changes on ${viewport.name}`, async ({ teacherPage: page, teacherApi, bankCourse: data }) => {
      await page.setViewportSize(viewport);
      const contentPath = `/api/courses/${data.courseId}/content`;
      const folders = await Promise.all(Array.from({ length: 20 }, async (_, index) =>
        responseJson<{ contentItem: CourseContentItem }>(await teacherApi.post(`${contentPath}/folders`, {
          data: { title: `Week ${index + 1}`, position: index, isVisible: true }
        }))
      ));
      await responseJson(await teacherApi.post(`${contentPath}/folders`, {
        data: { title: "Collapsed child", parentId: folders[0]!.contentItem.id, isVisible: true }
      }));
      const { contentItems } = await responseJson<{ contentItems: CourseContentItem[] }>(await teacherApi.get(contentPath));
      const activityItem = contentItems.find((item) => item.activityId === data.activityId && !item.groupId)!;
      await responseJson(await teacherApi.patch(`${contentPath}/${activityItem.id}`, { data: { position: 21 } }));

      await page.goto(`/courses/${data.courseId}?tab=content`);
      await page.getByRole("button", { name: "Collapse Week 1", exact: true }).click();
      await expect(page.getByText("Collapsed child", { exact: true })).toBeHidden();
      const actions = page.getByRole("button", { name: `Actions for ${data.title}`, exact: true });
      await actions.scrollIntoViewIfNeeded();
      const originalScroll = await page.evaluate(() => window.scrollY);
      expect(originalScroll).toBeGreaterThan(800);
      await actions.click();
      await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
      const settings = page.getByRole("dialog", { name: data.title, exact: true });
      await settings.getByLabel("Assessment mode").selectOption("summative");
      await settings.getByLabel("Limit the time for each attempt").check();
      await settings.getByLabel("Time limit (minutes)", { exact: true }).fill("45");

      let releaseContent!: () => void;
      const contentGate = new Promise<void>((resolve) => { releaseContent = resolve; });
      let refreshPending = false;
      await page.route(`**${contentPath}`, async (route) => {
        refreshPending = true;
        await contentGate;
        await route.continue();
      });
      try {
        await settings.getByRole("button", { name: "Save settings", exact: true }).click();
        await expect.poll(() => refreshPending).toBe(true);
        // The existing tree must retain its height even while a slow refresh is pending.
        await expect(actions).toBeAttached();
        await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - originalScroll)).toBeLessThan(5);
        releaseContent();
        await expect(settings).toBeHidden();
        await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - originalScroll)).toBeLessThan(5);
        await expect(page.getByRole("button", { name: "Expand Week 1", exact: true })).toBeAttached();
        await expect(page.getByText("Collapsed child", { exact: true })).toBeHidden();
        // A stable scroll position must not come from a leftover modal scroll lock.
        await page.mouse.move(viewport.width / 2, viewport.height / 2);
        await page.mouse.wheel(0, -400);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(originalScroll - 200);
        await page.mouse.wheel(0, 400);
        await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - originalScroll)).toBeLessThan(5);
      } finally {
        releaseContent();
        await page.unrouteAll({ behavior: "wait" });
      }

      await actions.click();
      await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
      await expect(settings.getByLabel("Time limit (minutes)", { exact: true })).toHaveValue("45");
      await settings.getByRole("button", { name: "Cancel", exact: true }).last().click();
      const lastFolder = folders.at(-1)!.contentItem;
      await page.getByRole("button", { name: `Actions for ${lastFolder.titleSnapshot}`, exact: true }).click();
      await page.getByRole("menuitem", { name: "Hidden", exact: true }).click();
      await expect(page.locator(`[data-content-item-id="${lastFolder.id}"]`)).toHaveClass(/is-hidden-content/);
      await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - originalScroll)).toBeLessThan(5);
      await expect(page.getByRole("button", { name: "Expand Week 1", exact: true })).toBeAttached();
    });
  }

  test("loads only a gradebook summary on demand and keeps content usable while it is pending", async ({ teacherPage: page, bankCourse: data }) => {
    let releaseGradebook!: () => void;
    const gradebookGate = new Promise<void>((resolve) => { releaseGradebook = resolve; });
    const gradebookRequests: URL[] = [];
    await page.route(`**/api/courses/${data.courseId}/gradebook?*`, async (route) => {
      gradebookRequests.push(new URL(route.request().url()));
      await gradebookGate;
      await route.continue();
    });
    // Also detect an accidental eager request to the full gradebook without query parameters.
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === `/api/courses/${data.courseId}/gradebook` && !url.search) gradebookRequests.push(url);
    });
    try {
      await page.goto(`/courses/${data.courseId}?tab=content`);
      const content = page.getByRole("tabpanel", { name: "Content", exact: true });
      await expect(content.getByRole("link", { name: data.title, exact: true })).toBeVisible();
      expect(gradebookRequests).toHaveLength(0);
      await page.getByRole("tab", { name: "Gradebook", exact: true }).click();
      await expect.poll(() => gradebookRequests.length).toBe(1);
      expect(gradebookRequests[0]!.searchParams.get("view")).toBe("summary");
      const gradebook = page.getByRole("tabpanel", { name: "Gradebook", exact: true });
      await expect(gradebook.getByText("Loading...", { exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Content", exact: true }).click();
      await expect(content.getByRole("link", { name: data.title, exact: true })).toBeVisible();
      await page.getByRole("button", { name: `Actions for ${data.title}` }).click();
      await expect(page.getByRole("menuitem", { name: "Sync with bank" })).toBeVisible();
      await page.keyboard.press("Escape");
      releaseGradebook();
      await page.getByRole("tab", { name: "Gradebook", exact: true }).click();
      await expect(gradebook.getByLabel("Group", { exact: true })).toBeVisible();
      await expect(gradebook.getByText("Loading...", { exact: true })).toBeHidden();
      expect(gradebookRequests.every((url) => url.searchParams.get("view") === "summary")).toBe(true);
    } finally {
      releaseGradebook();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
});
