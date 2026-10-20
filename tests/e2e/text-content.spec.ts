import { prisma } from "@cognelo/db";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";

test.beforeAll(() => ensureContentTypePluginEnabled("text-content"));

test("authors rich text with retained images and presents inline, page, and modal views with section visibility", async ({ teacherPage: page, studentPage }, testInfo) => {
  test.setTimeout(150_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher");
  const student = await createAuthenticatedApi("student");
  const title = "Reading about loops";
  const courseUrl = `/courses/${data.courseId}?tab=content`;
  const groupUrl = `/courses/${data.courseId}/groups/${data.groupId}`;
  try {
    await page.goto(courseUrl);
    await page.getByRole("button", { name: "Content tree actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "New activity", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Choose course element" });
    await picker.getByRole("tab", { name: "Material", exact: true }).click();
    await picker.getByRole("button", { name: /^Text(?:\s|$)/ }).click();
    await expect(page).toHaveURL(/\/materials\/[^/]+\/edit$/);
    await page.getByLabel("Title", { exact: true }).fill(title);
    const editor = page.locator(".rich-text-editor");
    await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
    await editor.getByRole("textbox", { name: "Content", exact: true }).fill("## Loop reference\n\n| Step | Value |\n| --- | --- |\n| First | 1 |\n\nThe formula is $x^2 + y^2$.\n");
    await editor.getByRole("tab", { name: "Visual", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Add equation", exact: true })).toBeVisible();
    await expect(editor.getByRole("button", { name: "Add table", exact: true })).toBeVisible();
    await editor.getByRole("button", { name: "Add image", exact: true }).click();
    const imageDialog = page.getByRole("dialog", { name: "Add image", exact: true });
    await imageDialog.getByLabel("Image file").setInputFiles({ name: "diagram.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
    await imageDialog.getByLabel("Alternative text").fill("Loop diagram");
    await imageDialog.getByRole("button", { name: "Insert image", exact: true }).click();
    await expect(imageDialog).toBeHidden();
    await page.getByRole("button", { name: "Save material", exact: true }).click();
    await expect(page.getByText("Text material saved.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Back to course", exact: true }).click();
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
    const { resources } = await responseJson<{ resources: Array<{ id: string; title: string; metadata: { body: string } }> }>(await teacher.get(`/api/courses/${data.courseId}/content-resources`));
    const resource = resources.find((entry) => entry.title === title)!;
    const imageUrl = resource.metadata.body.match(/\/api\/media-assets\/[a-z0-9]+\/content/)![0];
    const assetId = imageUrl.split("/")[3];
    expect(await prisma.mediaAsset.findUnique({ where: { id: assetId }, select: { status: true, expiresAt: true } })).toEqual({ status: "active", expiresAt: null });
    expect(await prisma.mediaAssetReference.count({ where: { contentResourceId: resource.id, assetId } })).toBe(1);
    await studentPage.goto(groupUrl);
    await expect(studentPage.getByRole("heading", { name: "Loop reference", exact: true })).toBeVisible();
    await expect(studentPage.locator(".content-resource-body table")).toBeVisible();
    await expect(studentPage.locator(".content-resource-body .katex")).toBeVisible();
    await expect(studentPage.getByRole("img", { name: "Loop diagram", exact: true })).toBeVisible();
    expect((await student.get(imageUrl)).status()).toBe(200);
    await studentPage.locator(".content-resource-body").screenshot({ path: testInfo.outputPath("text-inline.png") });

    async function settings() {
      await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
      await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
      return page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Save material", exact: true }) });
    }
    let dialog = await settings();
    await expect(dialog.getByLabel("Visible to students", { exact: true })).toBeChecked();
    await expect(dialog.getByLabel("Student display", { exact: true })).toHaveValue("inline");
    await dialog.getByLabel("Student display", { exact: true }).selectOption("page");
    await expect(dialog.getByLabel("Open in a new tab", { exact: true })).not.toBeChecked();
    await dialog.getByRole("button", { name: "Save material", exact: true }).click();
    await expect(dialog).toBeHidden();
    await studentPage.reload();
    await expect(studentPage.getByRole("heading", { name: "Loop reference", exact: true })).toHaveCount(0);
    const link = studentPage.getByRole("link", { name: title, exact: true });
    await expect(link).toHaveAttribute("target", "_self");
    await link.click();
    await expect(studentPage).toHaveURL(new RegExp(`/materials/${resource.id}\\?groupId=`));
    await expect(studentPage.getByRole("heading", { name: "Loop reference", exact: true })).toBeVisible();
    await studentPage.getByRole("link", { name: "Back to course", exact: true }).click();
    await expect(studentPage).toHaveURL(`${groupUrl}?tab=content`);

    dialog = await settings();
    await dialog.getByLabel("Open in a new tab", { exact: true }).check();
    await dialog.getByRole("button", { name: "Save material", exact: true }).click();
    await expect(dialog).toBeHidden();
    await studentPage.reload();
    const popupPromise = studentPage.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await expect(popup.getByRole("heading", { name: "Loop reference", exact: true })).toBeVisible();
    await popup.close();

    dialog = await settings();
    await dialog.getByLabel("Student display", { exact: true }).selectOption("modal");
    await expect(dialog.getByLabel("Open in a new tab", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Save material", exact: true }).click();
    await expect(dialog).toBeHidden();
    await studentPage.reload();
    const modalTitle = studentPage.getByRole("button", { name: title, exact: true });
    await modalTitle.click();
    const modal = studentPage.getByRole("dialog", { name: title, exact: true });
    await expect(modal.getByRole("heading", { name: "Loop reference", exact: true })).toBeVisible();
    expect((await modal.boundingBox())!.width).toBeCloseTo(studentPage.viewportSize()!.width * .8, 0);
    await studentPage.screenshot({ path: testInfo.outputPath("text-modal.png") });
    await studentPage.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect(modalTitle).toBeFocused();
    await expect.poll(() => studentPage.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await studentPage.setViewportSize({ width: 390, height: 844 });
    await modalTitle.click();
    await expect(modal).toBeVisible();
    expect((await modal.boundingBox())!.width).toBeCloseTo(312, 0);
    await studentPage.screenshot({ path: testInfo.outputPath("text-modal-mobile.png") });
    await modal.getByRole("button", { name: "Close", exact: true }).click();

    const resourcePath = `/api/courses/${data.courseId}/content-resources/${resource.id}`;
    const readerPath = `/api/courses/${data.courseId}/groups/${data.groupId}/content-resources/${resource.id}`;
    expect((await student.get(resourcePath)).status()).toBe(403);
    expect((await student.patch(resourcePath, { data: { payload: { body: "Unauthorized" } } })).status()).toBe(403);
    const { contentItem } = await responseJson<{ contentItem: { id: string } }>(await teacher.get(resourcePath));
    await responseJson(await teacher.patch(`/api/courses/${data.courseId}/groups/${data.groupId}/content/${contentItem.id}`, { data: { isVisible: false } }));
    expect((await student.get(readerPath)).status()).toBe(404);
    expect((await student.get(imageUrl)).status()).toBe(403);
    await responseJson(await teacher.patch(`/api/courses/${data.courseId}/groups/${data.groupId}/content/${contentItem.id}`, { data: { isVisible: true } }));
    expect((await student.get(readerPath)).status()).toBe(200);

    const { contentItem: copyItem } = await responseJson<{ contentItem: { contentResourceId: string } }>(await teacher.post(`/api/courses/${data.courseId}/content/${contentItem.id}/duplicate`, { data: { title: "Reading copy" } }));
    expect(await prisma.mediaAssetReference.count({ where: { contentResourceId: copyItem.contentResourceId, assetId } })).toBe(1);
    // Independent duplicate keeps the asset alive after the original is removed.
    await responseJson(await teacher.delete(resourcePath));
    expect((await student.get(imageUrl)).status()).toBe(200);
  } finally {
    await teacher.dispose(); await student.dispose(); await removeActivitySuite(data);
  }
});
