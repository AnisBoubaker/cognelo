import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createStoredZip } from "./fixtures/zip";
import { textPdf } from "./fixtures/pdf";
import type { CodingHomeworkAuthoringRecord } from "../../packages/plugin-activities/plugin-coding-homework-grader/src/web/client";

type Solution = { revision: string; files: Array<{ path: string }>; functions: Array<{ key: string; sourcePath: string }> };
for (const owner of ["bank", "course"] as const) test(`${owner} homework solution replaces ZIPs safely and removes files/functions with compact controls`, async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(120_000);
  const id = owner === "course" ? await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Solution management", config: {} })
    : (await responseJson<{ activity: { id: string } }>(await teacherApi.post(`/api/activity-banks/${data.activityBankId}/activities`, { data: { activityTypeKey: "coding-homework-grader", title: "Solution management", config: {} } }))).activity.id;
  const pagePath = owner === "course" ? `/courses/${data.courseId}/activities/${id}` : `/activity-banks/${data.activityBankId}/activities/${id}`;
  const base = `/api${pagePath}/coding-homework-grader`;
  await page.goto(pagePath);
  const selector = page.locator(".homework-solution-selector");
  const zipInput = selector.locator('input[type="file"][accept=".zip"]');
  const fileInput = selector.locator('input[type="file"][multiple]');
  await expect(zipInput).toBeEnabled();
  const upload = async (entries: Array<{ path: string; contents: string | Buffer }>, replacement = false) => {
    await expect(zipInput).toBeEnabled();
    await zipInput.setInputFiles({ name: "solution.zip", mimeType: "application/zip", buffer: createStoredZip(entries) });
    if (replacement) await page.getByRole("dialog", { name: "Replace solution", exact: true }).getByRole("button", { name: "Replace solution", exact: true }).click();
  };
  await upload([{ path: "Solution/main.c", contents: "int add(int x) { return x; }" }]);
  const fileChoice = selector.getByRole("checkbox", { name: "Solution/main.c", exact: true });
  await expect(fileChoice).toBeVisible();
  const geometry = await fileChoice.evaluate(input => {
    const checkbox = input.getBoundingClientRect(), text = input.closest("label")!.querySelector("code")!.getBoundingClientRect();
    return { width: checkbox.width, height: checkbox.height, sameLine: text.top < checkbox.bottom && text.left > checkbox.right };
  });
  expect(geometry.width).toBeLessThanOrEqual(20); expect(geometry.height).toBeLessThanOrEqual(20); expect(geometry.sameLine).toBe(true);
  await fileChoice.check(); await selector.getByRole("checkbox", { name: "int add(int) Solution/main.c", exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click(); await expect(page.getByText("Coding homework saved.", { exact: true })).toBeVisible();

  // Finder-created resource forks look like C files but contain binary NUL bytes.
  await upload([
    { path: "main.c", contents: "int add(int x) { return x; }\nint helper(void) { return 1; }" },
    { path: "main.h", contents: "int add(int x);" },
    { path: "__MACOSX/._main.c", contents: Buffer.from([0, 5, 22, 7, 0, 0]) },
    { path: "._main.h", contents: Buffer.from([0, 5, 22, 7, 0, 0]) }
  ], true);
  await expect(selector.getByRole("checkbox", { name: "main.c", exact: true })).toBeVisible();
  await expect(selector.getByText("Solution/main.c", { exact: true })).toHaveCount(0);
  let saved = await responseJson<CodingHomeworkAuthoringRecord>(await teacherApi.get(`${base}/authoring`));
  expect(saved.requirements.requirements.requiredFiles).toEqual([]); expect(saved.requirements.requirements.requiredFunctions).toEqual([]);
  let solution = await responseJson<Solution>(await teacherApi.get(`${base}/teacher-solution`));
  expect(solution.files.map(file => file.path)).toEqual(["main.c", "main.h"]);
  const replacedRevision = solution.revision;
  await selector.getByRole("checkbox", { name: "int helper(void) main.c", exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click(); await expect(page.getByText("Coding homework saved.", { exact: true })).toBeVisible();
  await page.getByLabel("Description", { exact: true }).fill("An unrelated unsaved description.");
  await selector.getByRole("button", { name: "Remove function: main.c:helper", exact: true }).click();
  await expect(selector.getByRole("checkbox", { name: "int helper(void) main.c", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("An unrelated unsaved description.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Required functions", { exact: true })).toHaveValue("");
  // Adding an unrelated header must not resurrect an excluded function.
  await fileInput.setInputFiles({ name: "other.h", mimeType: "text/plain", buffer: Buffer.from("int other(void);\n") });
  await expect(selector.getByRole("checkbox", { name: "other.h", exact: true })).toBeVisible();
  await page.reload();
  await expect(selector.getByRole("checkbox", { name: "other.h", exact: true })).toBeVisible();
  await expect(selector.getByRole("button", { name: "Remove function: main.c:helper", exact: true })).toHaveCount(0);
  await selector.getByRole("button", { name: "Remove file: main.h", exact: true }).click();
  await expect(selector.getByRole("checkbox", { name: "main.h", exact: true })).toHaveCount(0);
  solution = await responseJson<Solution>(await teacherApi.get(`${base}/teacher-solution`));
  // A malformed replacement cannot destroy the previous valid solution.
  const rejected = await teacherApi.put(`${base}/teacher-solution`, { data: { fileName: "broken.zip", base64: createStoredZip([{ path: "broken.c", contents: Buffer.from("int broken(void) { return 0; }\u0000") }]).toString("base64"), expectedRevision: solution.revision } });
  expect(rejected.status()).toBe(400); expect((await rejected.json()).error.code).toBe("HOMEWORK_SOLUTION_BINARY_FILE");
  expect(await responseJson(await teacherApi.get(`${base}/teacher-solution`))).toMatchObject(solution);
  expect((await teacherApi.delete(`${base}/teacher-solution`, { data: { kind: "all", expectedRevision: replacedRevision } })).status()).toBe(409);
  expect(await responseJson(await teacherApi.get(`${base}/teacher-solution`))).toMatchObject(solution);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await selector.screenshot({ path: `tmp/homework-solution-${owner}-mobile.png` });
  await selector.getByRole("button", { name: "Clear solution", exact: true }).click();
  await page.getByRole("dialog", { name: "Clear solution", exact: true }).getByRole("button", { name: "Clear solution", exact: true }).click();
  await expect(selector.getByText("No teacher solution uploaded.", { exact: true })).toBeVisible();
  expect(await responseJson(await teacherApi.get(`${base}/teacher-solution`))).toMatchObject({ files: [], functions: [] });
  // Headers may be uploaded first, before any function definitions exist.
  await fileInput.setInputFiles({ name: "first.h", mimeType: "text/plain", buffer: Buffer.from("int first(void);\n") });
  await expect(selector.getByRole("checkbox", { name: "first.h", exact: true })).toBeVisible();
  saved = await responseJson<CodingHomeworkAuthoringRecord>(await teacherApi.get(`${base}/authoring`));
  expect(saved.requirements.requirements.requiredFunctions).toEqual([]);
});

test("assignment PDFs render as PDF bytes in bank/course previews and student downloads", async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(120_000);
  const bytes = textPdf("Homework statement: upload your C project and explain your solution.");
  const { activity: bankActivity } = await responseJson<{ activity: { id: string } }>(await teacherApi.post(`/api/activity-banks/${data.activityBankId}/activities`, { data: { activityTypeKey: "coding-homework-grader", title: "PDF assignment", config: {} } }));
  const courseId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "PDF assignment", config: {} });
  const student = await createAuthenticatedApi("student");
  try {
    let courseAttachmentId = "";
    for (const [scope, pagePath] of [["bank", `/activity-banks/${data.activityBankId}/activities/${bankActivity.id}`], ["course", `/courses/${data.courseId}/activities/${courseId}`]] as const) {
      const base = `/api${pagePath}/coding-homework-grader`;
      const authoring = await responseJson<CodingHomeworkAuthoringRecord>(await teacherApi.post(`${base}/assignment-pdf`, { data: { fileName: "assignment.pdf", mimeType: "application/pdf", base64: bytes.toString("base64") } }));
      const attachmentId = authoring.assignmentPdf!.id; if (scope === "course") courseAttachmentId = attachmentId;
      const path = `${base}/activity-file?attachmentId=${attachmentId}`;
      const file = await teacherApi.get(path);
      expect(file.status()).toBe(200); expect(file.headers()["content-type"]).toBe("application/pdf"); expect(file.headers()["content-disposition"]).toContain("inline"); expect(await file.body()).toEqual(bytes);
      const previewLoaded = page.waitForResponse(response => response.url().includes(`/activity-file?attachmentId=${attachmentId}`));
      await page.goto(pagePath);
      expect((await previewLoaded).headers()["content-type"]).toBe("application/pdf");
      await expect(page.locator(".homework-pdf-preview figcaption")).toHaveText("Preview");
      await expect(page.locator(".homework-pdf-preview iframe")).toBeVisible();
      const previewFrame = await (await page.locator(".homework-pdf-preview iframe").elementHandle())!.contentFrame();
      await previewFrame!.waitForLoadState("load");
      const popupPromise = page.waitForEvent("popup");
      await page.getByRole("link", { name: "View PDF", exact: true }).click();
      const popup = await popupPromise;
      await expect.poll(() => popup.url()).toContain(`/activity-file?attachmentId=${attachmentId}`);
      await popup.waitForLoadState("load");
      await popup.close();
      await page.locator(".homework-pdf-preview").screenshot({ path: `tmp/homework-pdf-${scope}-preview.png` });
    }
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: courseId, metadata: { assessmentMode: "summative", requireSafeExamBrowser: true } } }));
    const studentPath = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${courseId}/coding-homework-grader/activity-file?attachmentId=${courseAttachmentId}`;
    expect((await student.delete(studentPath.split("/activity-file?")[0] + "/teacher-solution", { data: { kind: "all", expectedRevision: "0".repeat(64) } })).status()).toBe(403);
    const file = await student.get(studentPath);
    expect(file.headers()["content-type"]).toBe("application/pdf"); expect(await file.body()).toEqual(bytes);
    expect((await student.get(`/api/courses/${data.courseId}/activities/${courseId}/coding-homework-grader/activity-file?attachmentId=${courseAttachmentId}`)).status()).toBe(403);
    expect((await student.get(studentPath.replace(courseAttachmentId, "unrelated-attachment"))).status()).toBe(404);
  } finally { await student.dispose(); }
});
