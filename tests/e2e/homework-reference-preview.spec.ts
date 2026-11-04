import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("teachers inspect the exact prepared text with pagination and no model calls or student access", async ({ bankCourse: data, browser }) => {
  test.setTimeout(120_000);
  await ensureContentTypePluginEnabled("text-content");
  const model = await homeworkModelFixture(data), api = model.api, page = await model.page(browser), student = await createAuthenticatedApi("student");
  try {
    const course = `/api/courses/${data.courseId}`;
    const body = 'FIRST_PASSAGE: C functions take typed parameters. <img src="https://untrusted-preview.example.test/image.png">\n'
      + "Check argument bounds and explain returned values. ".repeat(385) + "\nLAST_PASSAGE: the end of this lesson.";
    const { resource } = await responseJson<{ resource: { id: string } }>(await api.post(`${course}/content-resources`, { data: { contentTypeKey: "text", payload: { title: "C reference preview", body }, isVisible: true } }));
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Prepared reference preview", config: {} });
    const base = `${course}/activities/${id}/coding-homework-grader`;
    await responseJson(await api.put(`${base}/workflow-settings`, { data: { selected: [resource.id] } }));
    const index = await responseJson<{ id: string }>(await api.post(`${base}/prepare-material`, { data: { resourceId: resource.id } }));
    await responseJson(await api.post(`${base}/prepare-references`, { data: {} }));
    const path = `${base}/reference-preview?resourceId=${resource.id}`;
    const preview = await responseJson<{ indexId: string; total: number; passages: Array<{ text: string }> }>(await api.get(path));
    expect(preview).toMatchObject({ indexId: index.id, prepared: true, offset: 0, nextOffset: 10 });
    expect(preview.passages[0].text).toContain("FIRST_PASSAGE");
    expect(preview.total).toBeGreaterThan(10);
    expect(JSON.stringify(preview)).not.toMatch(/vectorId|embeddingConfig|apiKey/);
    expect((await student.get(path)).status()).toBe(403);
    expect((await api.get(`${path}&indexId=unrelated-index`)).status()).toBe(409);

    // A newer index of the material must not replace this homework's pinned preview.
    await responseJson(await api.patch(`${course}/content-resources/${resource.id}`, { data: { payload: { body: "NEW_MATERIAL_VERSION: different pedagogical content." } } }));
    const other = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Newer reference preparation", config: {} });
    const otherBase = `${course}/activities/${other}/coding-homework-grader`;
    await responseJson(await api.put(`${otherBase}/workflow-settings`, { data: { selected: [resource.id] } }));
    const newer = await responseJson<{ id: string }>(await api.post(`${otherBase}/prepare-material`, { data: { resourceId: resource.id } }));
    expect(newer.id).not.toBe(index.id);
    expect(await responseJson(await api.get(`${base}/workflow-settings`))).toMatchObject({ prepared: false, enabled: false });
    expect(await responseJson(await api.get(`${otherBase}/reference-preview?resourceId=${resource.id}`))).toMatchObject({ indexId: newer.id, prepared: false });
    const requestsBefore = model.requests.length;
    await page.goto(`/courses/${data.courseId}/activities/${id}`);
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await page.getByRole("button", { name: "Preview indexed text", exact: true }).click();
    const panel = page.getByRole("region", { name: "Preview indexed text", exact: true });
    await expect(panel).toContainText("Prepared reference for this homework.");
    await expect(panel).toContainText("FIRST_PASSAGE");
    await expect(panel.locator('div[tabindex="0"]')).toBeFocused();
    await expect(panel).not.toContainText("NEW_MATERIAL_VERSION");
    await expect(panel.locator("img")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Previous passages", exact: true })).toBeDisabled();
    for (let offset = 10; offset < preview.total; offset += 10) {
      await panel.getByRole("button", { name: "Next passages", exact: true }).click();
      await expect(panel.getByRole("status")).toContainText(`Passages ${offset + 1}`);
    }
    await expect(panel).toContainText("LAST_PASSAGE");
    await expect(panel.getByRole("button", { name: "Next passages", exact: true })).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await page.getByRole("button", { name: "Preview indexed text", exact: true }).click();
    await expect(panel).toContainText("FIRST_PASSAGE");
    expect(model.requests).toHaveLength(requestsBefore);
    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("button", { name: "Enable final submissions", exact: true })).toBeDisabled();
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
  } finally { await page.close(); await student.dispose(); await model.close(); }
});
