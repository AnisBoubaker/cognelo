import { createAuthenticatedApi, expect, test, confirmSharedDialog } from "./fixtures/auth";
import { provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";

test.beforeAll(async () => {
  const admin = await createAuthenticatedApi("admin");
  try {
    const { plugins } = await responseJson<{ plugins: Array<{ key: string; isActivated: boolean; isEnabled: boolean }> }>(await admin.get("/api/content-type-plugins"));
    const plugin = plugins.find((entry) => entry.key === "link-content");
    expect(plugin).toBeTruthy();
    if (!plugin!.isActivated) await responseJson(await admin.patch("/api/content-type-plugins/link-content", { data: { action: "activate" } }));
    if (!plugin!.isEnabled) await responseJson(await admin.patch("/api/content-type-plugins/link-content", { data: { isEnabled: true } }));
  } finally { await admin.dispose(); }
});

test("creates, edits, duplicates, and opens a described course link with its saved target", async ({ teacherPage: page, studentPage }, testInfo) => {
  test.setTimeout(120_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher");
  const student = await createAuthenticatedApi("student");
  const title = "Course reference guide";
  const description = "Read chapter one before class.\nBring your questions.";
  const url = "https://links.example.test/guide?course=one#chapter-one";
  try {
    await studentPage.context().route("https://links.example.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>External course guide</h1>" }));
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: "Content tree actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "New activity", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Choose course element" });
    await picker.getByRole("tab", { name: "Material", exact: true }).click();
    await picker.getByRole("button", { name: /^Link(?:\s|$)/ }).click();
    const settings = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Save material", exact: true }) });
    await expect(settings.getByLabel("Open in a new tab", { exact: true })).toBeChecked();
    await settings.getByLabel("Link text", { exact: true }).fill(title);
    await settings.getByLabel("URL", { exact: true }).fill(url);
    await settings.getByLabel("Description (optional)", { exact: true }).fill(description);
    await settings.getByRole("button", { name: "Save material", exact: true }).click();
    await expect(settings).toBeHidden();
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveAttribute("target", "_blank");
    const teacherRow = page.locator(".table-row-content-tree").filter({ has: page.getByRole("link", { name: title, exact: true }) });
    await expect(teacherRow.locator(".content-resource-description")).toHaveText(description);

    const studentUrl = `/courses/${data.courseId}/groups/${data.groupId}`;
    await studentPage.goto(studentUrl);
    const link = studentPage.getByRole("link", { name: title, exact: true });
    const studentRow = studentPage.locator(".table-row-content-tree").filter({ has: link });
    await expect(link).toHaveAttribute("href", url);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    const labelBounds = await link.boundingBox();
    const descriptionBounds = await studentRow.locator(".content-resource-description").boundingBox();
    expect(descriptionBounds!.y).toBeGreaterThanOrEqual(labelBounds!.y + labelBounds!.height);
    const popupPromise = studentPage.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(url);
    await expect(popup.getByRole("heading", { name: "External course guide" })).toBeVisible();
    await popup.close();

    await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    await expect(settings.getByLabel("Description (optional)", { exact: true })).toHaveValue(description);
    await settings.getByLabel("Open in a new tab", { exact: true }).uncheck();
    await settings.getByRole("button", { name: "Save material", exact: true }).click();
    await expect(settings).toBeHidden();
    await page.reload();
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveAttribute("target", "_self");
    await studentPage.reload();
    await expect(link).toHaveAttribute("target", "_self");
    await expect(studentRow.getByRole("link", { name: `Open ${title}`, exact: true })).toHaveAttribute("target", "_self");
    await studentRow.screenshot({ path: testInfo.outputPath("link-desktop.png") });
    await studentPage.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => studentPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await studentRow.screenshot({ path: testInfo.outputPath("link-mobile.png") });
    const pageCount = studentPage.context().pages().length;
    await link.click();
    await expect(studentPage).toHaveURL(url);
    expect(studentPage.context().pages()).toHaveLength(pageCount);

    await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    const duplicate = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Duplicate", exact: true }) });
    const copyTitle = `${title} copy`;
    await duplicate.locator("input").fill(copyTitle);
    await duplicate.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page.getByRole("link", { name: copyTitle, exact: true })).toHaveAttribute("target", "_self");
    const { resources } = await responseJson<{ resources: Array<{ id: string; title: string; metadata: Record<string, unknown> }> }>(await teacher.get(`/api/courses/${data.courseId}/content-resources`));
    const original = resources.find((resource) => resource.title === title)!;
    expect(resources.find((resource) => resource.title === copyTitle)?.metadata).toEqual(original.metadata);
    expect((await teacher.patch(`/api/courses/${data.courseId}/content-resources/${original.id}`, { data: { payload: { url: "javascript:alert(1)" } } })).status()).toBe(400);
    expect((await student.patch(`/api/courses/${data.courseId}/content-resources/${original.id}`, { data: { payload: { title: "Not allowed" } } })).status()).toBe(403);
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/student-view`);
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveAttribute("target", "_self");
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: `Actions for ${copyTitle}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Hidden", exact: true }).click();
    await studentPage.goto(studentUrl);
    await expect(studentPage.getByRole("link", { name: copyTitle, exact: true })).toHaveCount(0);
    await expect(link).toBeVisible();
    await page.getByRole("button", { name: `Actions for ${copyTitle}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
    await confirmSharedDialog(page, "Remove");
    await expect(page.getByRole("link", { name: copyTitle, exact: true })).toHaveCount(0);
  } finally {
    await teacher.dispose();
    await student.dispose();
    await removeActivitySuite(data);
  }
});
