import { prisma } from "@cognelo/db";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";

test.beforeAll(() => ensureContentTypePluginEnabled("link-content"));

test("generates an editable private link summary with a persisted word limit", async ({ teacherPage: page, studentPage }, testInfo) => {
  test.setTimeout(120_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher");
  const student = await createAuthenticatedApi("student");
  const title = "Programming reference";
  const publicDescription = "A useful public description.";
  const sourceUrl = "https://example.org/programming";
  const generated = "Cette ressource présente les variables et les boucles avec des exemples de programmation.";
  const edited = `${generated}\nNote pédagogique privée : à utiliser pendant le cours.`;
  try {
    await responseJson(await teacher.patch(`/api/subjects/${data.subjectId}`, { data: { teachingLanguage: "fr" } }));
    const { resource } = await responseJson<{ resource: { id: string } }>(await teacher.post(`/api/courses/${data.courseId}/content-resources`, {
      data: { contentTypeKey: "link", payload: { title, description: publicDescription }, isVisible: true }
    }));
    const privatePath = `/api/courses/${data.courseId}/content-resources/${resource.id}/summary`;
    let mode: "success" | "http-error" = "success";
    let releaseGeneration = () => {};
    let generationStarted = () => {};
    const started = new Promise<void>((resolve) => { generationStarted = resolve; });
    const gate = new Promise<void>((resolve) => { releaseGeneration = resolve; });
    await page.route(`**${privatePath}`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      expect(route.request().postDataJSON()).toEqual({ url: sourceUrl, maxWords: 75 });
      if (mode === "http-error") return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: { code: "LINK_HTTP_STATUS", message: "HTTP 404", details: { status: 404 } } }) });
      generationStarted();
      await gate;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ summary: generated, wordCount: 16, maxWords: 75 }) });
    });
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Save material", exact: true }) });
    const summary = settings.getByLabel("Internal summary", { exact: true });
    const maxWords = settings.getByLabel("Maximum words", { exact: true });
    const generate = settings.getByRole("button", { name: "Generate with AI", exact: true });
    await expect(summary).toBeEditable();
    await expect(maxWords).toHaveValue("100");
    await expect(generate).toBeDisabled();
    await settings.getByLabel("URL", { exact: true }).fill(sourceUrl);
    await maxWords.fill("75");
    await generate.click();
    await started;
    try {
      await expect(page.getByRole("dialog", { name: "Generating internal summary", exact: true })).toBeVisible();
    } finally { releaseGeneration(); }
    await expect(summary).toHaveValue(generated);
    await expect(page.getByRole("dialog", { name: "Generating internal summary", exact: true })).toHaveCount(0);
    expect(await responseJson(await teacher.get(privatePath))).toEqual({ settings: { internalSummary: "", maxWords: 100 } });
    await summary.fill(edited);
    await settings.getByRole("button", { name: "Save material", exact: true }).click();
    await expect(settings).toBeHidden();
    expect(await responseJson(await teacher.get(privatePath))).toEqual({ settings: { internalSummary: edited, maxWords: 75 } });

    const publicResources = await responseJson<{ resources: Array<{ id: string; metadata: Record<string, unknown> }> }>(await student.get(`/api/courses/${data.courseId}/groups/${data.groupId}/content-resources`));
    expect(publicResources.resources.find((entry) => entry.id === resource.id)?.metadata).toEqual({ url: sourceUrl, description: publicDescription, openInNewTab: true });
    expect(JSON.stringify(publicResources)).not.toContain(edited);
    expect((await student.get(privatePath)).status()).toBe(403);
    expect((await student.post(privatePath, { data: { url: sourceUrl, maxWords: 75 } })).status()).toBe(403);
    const blocked = await teacher.post(privatePath, { data: { url: "http://127.0.0.1/private", maxWords: 75 } });
    expect(blocked.status()).toBe(400);
    expect((await blocked.json()).error.code).toBe("LINK_URL_NOT_PUBLIC");
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await expect(studentPage.getByText(publicDescription, { exact: true })).toBeVisible();
    await expect(studentPage.getByText(edited, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    await expect(summary).toHaveValue(edited);
    await expect(maxWords).toHaveValue("75");
    mode = "http-error";
    await generate.click();
    await expect(settings.getByRole("alert")).toContainText("HTTP 404");
    await expect(summary).toHaveValue(edited);
    await page.setViewportSize({ width: 390, height: 844 });
    await maxWords.scrollIntoViewIfNeeded();
    await settings.screenshot({ path: testInfo.outputPath("internal-summary-mobile.png") });
    await settings.getByRole("button", { name: "Cancel", exact: true }).click();

    await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    const duplicate = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Duplicate", exact: true }) });
    const copyTitle = `${title} copy`;
    await duplicate.locator("input").fill(copyTitle);
    await duplicate.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page.getByRole("link", { name: copyTitle, exact: true })).toBeVisible();
    const { resources } = await responseJson<{ resources: Array<{ id: string; title: string }> }>(await teacher.get(`/api/courses/${data.courseId}/content-resources`));
    const copyId = resources.find((entry) => entry.title === copyTitle)!.id;
    expect(await responseJson(await teacher.get(`/api/courses/${data.courseId}/content-resources/${copyId}/summary`))).toEqual({ settings: { internalSummary: edited, maxWords: 75 } });
    await responseJson(await teacher.delete(`/api/courses/${data.courseId}/content-resources/${copyId}`));
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginLinkContentSettings" WHERE "resourceId" = ${copyId}`;
    expect(rows[0]?.count).toBe(0n);
  } finally {
    await teacher.dispose(); await student.dispose(); await removeActivitySuite(data);
  }
});
