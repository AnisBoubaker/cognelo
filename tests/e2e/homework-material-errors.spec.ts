import { openHomeworkEditorSection } from "./fixtures/homework-editor";
import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";
import { homeworkModelFixture } from "./fixtures/homework-model";
import { createStoredZip } from "./fixtures/zip";

test("ZIP reference extraction reports named failures in notification history and reuses successful indexes on retry", async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(120_000);
  await ensureContentTypePluginEnabled("file-content");
  const model = await homeworkModelFixture(data);
  try {
    async function material(title: string, entries: Parameters<typeof createStoredZip>[0]) {
      const { resource } = await responseJson<{ resource: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/content-resources`, { data: { contentTypeKey: "file", payload: { title }, isVisible: true } }));
      await upload(resource.id, entries); return resource.id;
    }
    async function upload(id: string, entries: Parameters<typeof createStoredZip>[0]) {
      await responseJson(await teacherApi.put(`/api/courses/${data.courseId}/content-resources/${id}/upload`, { multipart: { file: { name: "reference.zip", mimeType: "application/zip", buffer: createStoredZip(entries) } } }));
    }
    const starter = await material("Starter source archive", [
      { path: "starter/main.c", contents: "int sum(int a, int b) { return a + b; }" },
      { path: "starter/README.txt", contents: "Explain the function parameters and return value." },
      { path: "__MACOSX/._main.c", contents: "metadata should not reach embeddings" },
      { path: "starter/program.exe", contents: "binary should not reach embeddings" }
    ]);
    const binary = await material("Executable archive", [{ path: "demo.exe", contents: "binary" }]);
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "ZIP reference failures", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { selected: [starter, binary] } }));
    await page.goto(`/courses/${data.courseId}/activities/${activityId}`);
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await page.getByRole("button", { name: "Generate embeddings", exact: true }).click();
    const toast = page.locator('section[role="alert"]').filter({ hasText: "Executable archive:" });
    await expect(toast).toContainText("no readable source/text files");
    await expect(page.getByRole("dialog", { name: "Preparing reference materials…", exact: true })).toBeHidden();
    await openHomeworkEditorSection(page, "Submission");
    await expect(page.getByRole("switch", { name: "Accept final submissions", exact: true })).toBeDisabled();
    expect(model.embeddingTexts).toHaveLength(2);
    expect(model.embeddingTexts.join("\n")).not.toContain("should not reach embeddings");
    const firstIndex = await prisma.contentMaterialIndex.findFirstOrThrow({ where: { resourceId: starter } });
    expect(firstIndex.documents).toEqual(expect.arrayContaining([expect.objectContaining({ path: "starter/main.c", languageKey: "c", kind: "code" })]));
    await toast.getByRole("button", { name: "Dismiss notification", exact: true }).click();
    await page.getByRole("button", { name: "Messages", exact: true }).click();
    const history = page.getByRole("region", { name: "Recent messages", exact: true });
    await expect(history).toContainText("Executable archive:");
    await expect(history.locator("article")).toHaveCount(1);
    await history.getByRole("button", { name: "Dismiss notification", exact: true }).click();
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await expect(page.locator(".activity-reference-materials")).toContainText("This ZIP contains no readable source/text files");
    await upload(binary, [{ path: "demo.exe", contents: "binary" }, { path: "inputs/map.txt", contents: "S..\n..E" }]);
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await page.getByRole("button", { name: "Generate embeddings", exact: true }).click();
    await expect(page.locator(".activity-reference-materials").getByText("Reference selection is prepared.", { exact: true })).toBeVisible();
    await openHomeworkEditorSection(page, "Submission");
    await expect(page.getByRole("switch", { name: "Accept final submissions", exact: true })).toBeEnabled();
    expect(model.embeddingTexts).toHaveLength(3);
    expect(await prisma.contentMaterialIndex.count({ where: { resourceId: starter } })).toBe(1);
    await page.getByRole("switch", { name: "Accept final submissions", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Accept final submissions", exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".homework-authoring-panel > form > div > .edit-action-bar")).toContainText("Everything is saved.");
  } finally { await model.close(); }
});
