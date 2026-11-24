import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";

test.beforeAll(() => ensureContentTypePluginEnabled("text-content"));

for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`Text fullscreen fills the viewport and retains its draft in both modes on ${viewport.name}`, async ({ teacherPage: page }, info) => {
    test.setTimeout(90_000);
    const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher");
    try {
      await page.setViewportSize(viewport);
      const body = "# Text material\n\n" + Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1}: fullscreen editing keeps the draft.`).join("\n\n");
      const { resource } = await responseJson<{ resource: { id: string } }>(await teacher.post(`/api/courses/${data.courseId}/content-resources`, {
        data: { contentTypeKey: "text", payload: { title: `Fullscreen material ${data.token}`, body }, isVisible: true }
      }));
      await page.goto(`/courses/${data.courseId}/materials/${resource.id}/edit`);
      const editor = page.locator(".rich-text-editor");
      await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
      const source = editor.getByRole("textbox", { name: "Content", exact: true });
      await source.fill(body + "\n\nMarkdown draft preserved.");
      const mounted = await editor.elementHandle();
      const overflowBefore = await page.evaluate(() => document.body.style.overflow);
      await editor.getByRole("button", { name: "Full screen", exact: true }).click();
      await expect(editor).toHaveAttribute("role", "dialog");
      await expect.poll(async () => {
        const box = await editor.boundingBox();
        return !!box && Math.abs(box.x) <= 1 && Math.abs(box.y) <= 1 && Math.abs(box.width - viewport.width) <= 1 && Math.abs(box.height - viewport.height) <= 1;
      }).toBe(true);
      await expect(editor.getByRole("button", { name: "Exit full screen", exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      await expect(source).toHaveValue(body + "\n\nMarkdown draft preserved.");
      await editor.getByRole("tab", { name: "Visual", exact: true }).click();
      const visual = editor.getByRole("textbox", { name: "Content", exact: true });
      await expect(visual).toContainText("Markdown draft preserved.");
      await expect.poll(() => visual.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
      await visual.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await expect(editor.getByRole("button", { name: "Exit full screen", exact: true })).toBeInViewport();
      await visual.fill("Visual draft preserved.");
      await page.screenshot({ path: info.outputPath(`text-fullscreen-${viewport.name}.png`) });
      await editor.getByRole("button", { name: "Exit full screen", exact: true }).click();
      await expect(editor).not.toHaveClass(/is-full-screen/);
      expect(await mounted!.evaluate(el => el.isConnected)).toBe(true);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe(overflowBefore);
      await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
      await expect(source).toHaveValue(/Visual draft preserved\./);
      await editor.getByRole("button", { name: "Full screen", exact: true }).click();
      await page.keyboard.press("Escape");
      await expect(editor).not.toHaveClass(/is-full-screen/);
      await page.getByRole("button", { name: "Save material", exact: true }).click();
      await expect(page.getByText("Text material saved.", { exact: true })).toBeVisible();
      const saved = await responseJson<{ resource: { metadata: { body: string } } }>(await teacher.get(`/api/courses/${data.courseId}/content-resources/${resource.id}`));
      expect(saved.resource.metadata.body).toContain("Visual draft preserved.");
    } finally { await teacher.dispose(); await removeActivitySuite(data); }
  });
}
