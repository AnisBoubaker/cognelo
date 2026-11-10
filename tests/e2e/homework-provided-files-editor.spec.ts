import { unzipSync } from "fflate";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { openHomeworkEditorSection } from "./fixtures/homework-editor";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createStoredZip } from "./fixtures/zip";
type Workspace = { revision: string; files: Array<{ path: string; sizeBytes: number }> };

for (const owner of ["course", "bank"] as const) test(`${owner} provided files use shared tabs, multiple uploads and confirmed ZIP replacement`, async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(120_000);
  const id = owner === "course" ? await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Provided file editor", config: {} })
    : (await responseJson<{ activity: { id: string } }>(await teacherApi.post(`/api/activity-banks/${data.activityBankId}/activities`, { data: { activityTypeKey: "coding-homework-grader", title: "Provided file editor", config: {} } }))).activity.id;
  const pagePath = owner === "course" ? `/courses/${data.courseId}/activities/${id}` : `/activity-banks/${data.activityBankId}/activities/${id}`;
  const base = `/api${pagePath}/coding-homework-grader`;
  const legacy = createStoredZip([{ path: "starter/provided.c", contents: "int provided(void) { return 7; }" }]);
  await responseJson(await teacherApi.post(`${base}/provided-files`, { data: { fileName: "legacy.zip", mimeType: "application/zip", base64: legacy.toString("base64") } }));
  const beforeViewing = await responseJson<{ providedFiles: Array<{ id: string }> }>(await teacherApi.get(`${base}/authoring`));
  await page.goto(pagePath);
  await openHomeworkEditorSection(page, "Activity");
  const editor = page.locator(".homework-provided-files");
  const viewer = editor.locator(".homework-submitted-files");
  const fileInput = editor.locator('input[type="file"][multiple]');
  const zipInput = editor.locator('input[type="file"][accept=".zip,application/zip"]');
  const content = editor.getByRole("tabpanel");
  await expect(editor.getByRole("tab", { name: "starter/provided.c", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(content).toContainText("int provided(void) { return 7; }");
  expect((await responseJson<{ providedFiles: Array<{ id: string }> }>(await teacherApi.get(`${base}/authoring`))).providedFiles.map(file => file.id)).toEqual(beforeViewing.providedFiles.map(file => file.id));
  await page.getByLabel("Description", { exact: true }).fill("Keep this unsaved activity draft.");
  await fileInput.setInputFiles([
    { name: "main.c", mimeType: "text/plain", buffer: Buffer.from("int main(void) { return 0; }") },
    { name: "main.h", mimeType: "text/plain", buffer: Buffer.from("int main(void);") }
  ]);
  await expect(editor.getByRole("tab")).toHaveCount(3);
  await editor.getByRole("tab", { name: "main.h", exact: true }).click();
  await expect(content).toContainText("int main(void);");
  const geometry = await viewer.evaluate(element => {
    const tab = element.querySelector('[role="tab"]')!.getBoundingClientRect(), panel = element.querySelector('[role="tabpanel"]')!.getBoundingClientRect();
    return { tabsLeftOfContent: tab.right < panel.left, aligned: Math.abs(element.querySelector(".settings-nav")!.getBoundingClientRect().top - panel.top) < 3 };
  });
  expect(geometry).toEqual({ tabsLeftOfContent: true, aligned: true });
  await expect(content.locator("h1,h2,h3,h4")).toHaveCount(0);
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Keep this unsaved activity draft.");

  const replacement = { name: "main.h", mimeType: "text/plain", buffer: Buffer.from("int changed(void);") };
  await fileInput.setInputFiles(replacement);
  await page.getByRole("dialog", { name: "Replace provided files?", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(content).toContainText("int main(void);");
  await expect(fileInput).toBeEnabled();
  await fileInput.setInputFiles(replacement);
  await page.getByRole("dialog", { name: "Replace provided files?", exact: true }).getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(content).toContainText("int changed(void);");
  const binary = Buffer.from([0, 5, 22, 7]);
  const zip = createStoredZip([
    { path: "src/new.c", contents: "int provided(void) { return 42; }" }, { path: "include/new.h", contents: "int provided(void);" },
    { path: "data.bin", contents: binary }, { path: "empty/", contents: "" }, { path: "__MACOSX/._new.c", contents: binary }
  ]);
  await zipInput.setInputFiles({ name: "starter.zip", mimeType: "application/zip", buffer: zip });
  await page.getByRole("dialog", { name: "Replace provided files?", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor.getByRole("tab")).toHaveCount(3);
  await expect(zipInput).toBeEnabled();
  await zipInput.setInputFiles({ name: "starter.zip", mimeType: "application/zip", buffer: zip });
  await page.getByRole("dialog", { name: "Replace provided files?", exact: true }).getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(editor.getByRole("tab", { name: "src/new.c", exact: true })).toBeVisible();
  await expect(editor.getByRole("tab", { name: "main.h", exact: true })).toHaveCount(0);
  await editor.getByRole("tab", { name: "data.bin", exact: true }).click();
  await expect(content).toContainText("A text preview is unavailable for this file.");
  await editor.getByRole("tab", { name: "src/new.c", exact: true }).click();
  await expect(content).toContainText("int provided(void) { return 42; }");
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Keep this unsaved activity draft.");
  const workspace = await responseJson<Workspace>(await teacherApi.get(`${base}/provided-files-workspace`));
  const stale = await teacherApi.delete(`${base}/provided-files-workspace`, { data: { expectedRevision: "0".repeat(64), all: true } });
  expect(stale.status()).toBe(409);
  const unsafe = createStoredZip([{ path: "../unsafe.c", contents: "bad" }]);
  expect((await teacherApi.post(`${base}/provided-files-workspace`, { data: { expectedRevision: workspace.revision, replaceAll: true, files: [{ fileName: "unsafe.zip", base64: unsafe.toString("base64") }] } })).status()).toBe(400);
  expect(await responseJson(await teacherApi.get(`${base}/provided-files-workspace`))).toEqual(workspace);
  const downloaded = await teacherApi.get(`${base}/provided-files-download`);
  expect(downloaded.ok()).toBe(true);
  const members = unzipSync(await downloaded.body());
  expect(Object.keys(members).sort()).toEqual(["data.bin", "empty/", "include/new.h", "src/new.c"]);
  expect(Buffer.from(members["data.bin"])).toEqual(binary);
  expect(Buffer.from(members["src/new.c"]).toString()).toBe("int provided(void) { return 42; }");
  if (owner === "course") {
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative", requireSafeExamBrowser: true } } }));
    const student = await createAuthenticatedApi("student");
    try {
      const response = await student.get(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader/provided-files-download`);
      expect(response.status()).toBe(200);
      const downloaded = unzipSync(await response.body());
      expect(Object.keys(downloaded).sort()).toEqual(Object.keys(members).sort());
      expect(Buffer.from(downloaded["data.bin"])).toEqual(binary);
      expect(Buffer.from(downloaded["src/new.c"])).toEqual(Buffer.from(members["src/new.c"]));
    } finally { await student.dispose(); }
  }

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await openHomeworkEditorSection(page, "Activity");
  await expect(editor.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  await editor.getByRole("tab", { name: "src/new.c", exact: true }).click();
  await expect(content).toContainText("int provided(void) { return 42; }");

  await editor.getByRole("button", { name: "Remove file: src/new.c", exact: true }).click();
  await page.getByRole("dialog", { name: "Remove provided file?", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor.getByRole("tab", { name: "src/new.c", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Remove file: src/new.c", exact: true })).toBeEnabled();
  await editor.getByRole("button", { name: "Remove file: src/new.c", exact: true }).click();
  await page.getByRole("dialog", { name: "Remove provided file?", exact: true }).getByRole("button", { name: "Remove file", exact: true }).click();
  await expect(editor.getByRole("tab", { name: "src/new.c", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  await editor.screenshot({ path: `tmp/homework-provided-files-${owner}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await editor.getByRole("tab", { name: "include/new.h", exact: true }).click();
  await expect(content).toContainText("int provided(void);");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await editor.screenshot({ path: `tmp/homework-provided-files-${owner}-mobile.png` });
  await editor.getByRole("button", { name: "Remove all files", exact: true }).click();
  await page.getByRole("dialog", { name: "Remove all files", exact: true }).getByRole("button", { name: "Remove all files", exact: true }).click();
  await expect(editor.getByText("No files provided with the assignment.", { exact: true })).toBeVisible();
  if (owner === "course") {
    const student = await createAuthenticatedApi("student");
    try {
      expect((await student.get(`${base}/provided-files-workspace`)).status()).toBe(403);
      expect((await student.post(`${base}/provided-files-workspace`, { data: { files: [] } })).status()).toBe(403);
      expect((await student.delete(`${base}/provided-files-workspace`, { data: { all: true, expectedRevision: workspace.revision } })).status()).toBe(403);
    } finally { await student.dispose(); }
  }
});

test("cancelling a provided-file upload preserves the saved collection", async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Cancelled provided upload", config: {} });
  const pagePath = `/courses/${data.courseId}/activities/${id}`;
  const base = `/api${pagePath}/coding-homework-grader/provided-files-workspace`;
  const before = await responseJson<Workspace>(await teacherApi.get(base));
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/coding-homework-grader/provided-files-workspace`, async route => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    await held; await route.abort().catch(() => undefined);
  });
  try {
    await page.goto(pagePath);
    await openHomeworkEditorSection(page, "Activity");
    const editor = page.locator(".homework-provided-files");
    await expect(editor.locator('input[type="file"][multiple]')).toBeEnabled();
    await editor.locator('input[type="file"][multiple]').setInputFiles({ name: "cancelled.c", mimeType: "text/plain", buffer: Buffer.from("int never_saved;") });
    const progress = page.getByRole("dialog", { name: "Files provided with the assignment", exact: true });
    await expect(progress).toBeVisible();
    await progress.getByRole("button", { name: "Cancel", exact: true }).click();
    release();
    await expect(progress).toBeHidden();
    await expect(editor.getByText("No files provided with the assignment.", { exact: true })).toBeVisible();
    expect(await responseJson(await teacherApi.get(base))).toEqual(before);
  } finally { release(); }
});
