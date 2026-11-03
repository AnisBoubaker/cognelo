import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("submitted files use shared left tabs, open the first file, and isolate loading and late responses", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data, { hold: true });
  const student = await createAuthenticatedApi("student");
  let activityId: string | undefined;
  let releaseSlow = () => {};
  try {
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Submitted file tabs", config: {} });
    const teacherBase = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    await responseJson(await teacherApi.put(`${teacherBase}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${teacherBase}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${teacherBase}/workflow-settings`, { data: { enabled: true } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId, availableFrom: null, availableUntil: null, metadata: { assessmentMode: "summative" }, config: {}, gradebookSettings: { pointsPossible: 100, maxAttempts: 1, attemptLimitMode: "max_attempts", gradeStrategy: "latest" } } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const endpoint = `${assigned}/coding-homework-grader`;
    const files = [
      { path: "src/01-first.c", text: "int first(void) { return 1; }" },
      { path: "src/02-second.c", text: "int second(void) { return 2; }" },
      { path: "src/03-empty.h", text: "" },
      { path: "src/deep_folder_with_a_very_long_name/04-last.c", text: `int last(void) { return 3; } /* ${"long line ".repeat(40)} */` }
    ];
    for (const [revision, file] of files.entries()) await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: file.path, base64: Buffer.from(file.text).toString("base64"), expectedRevision: revision, replace: false } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: files.length, acknowledgeIncomplete: true } }));
    let fileReads = 0;
    page.on("request", request => { if (request.url().includes("/submitted-file?")) fileReads++; });
    await page.goto(assigned.replace(/^\/api/, ""));
    const viewer = page.locator(".homework-submitted-files");
    const tabs = page.getByRole("tablist", { name: "Submitted files", exact: true });
    const first = tabs.getByRole("tab", { name: files[0].path, exact: true });
    const second = tabs.getByRole("tab", { name: files[1].path, exact: true });
    const empty = tabs.getByRole("tab", { name: files[2].path, exact: true });
    const last = tabs.getByRole("tab", { name: files[3].path, exact: true });
    const panel = viewer.getByRole("tabpanel");
    const code = viewer.locator(".homework-submitted-file-content");
    await expect(tabs).toHaveClass(/settings-nav/);
    await expect(tabs).toHaveAttribute("aria-orientation", "vertical");
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(panel).toContainText(files[0].text);
    await expect(panel.getByRole("heading")).toHaveCount(0);
    await expect(panel).not.toContainText(files[0].path);
    await expect(viewer.locator("textarea, input, [contenteditable=true]")).toHaveCount(0);
    await expect(viewer.getByRole("button", { name: /^Remove file: / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove all files", exact: true })).toHaveCount(0);
    const firstBox = await first.boundingBox(), codeBox = await code.boundingBox();
    expect(codeBox!.x).toBeGreaterThan(firstBox!.x + firstBox!.width);
    expect(Math.abs(codeBox!.y - firstBox!.y)).toBeLessThan(2);
    const initialFileReads = fileReads;
    // Routine workspace polling must keep the selected file and avoid refetching immutable content.
    await page.waitForResponse(response => response.url().endsWith("/workspace") && response.ok());
    expect(fileReads).toBe(initialFileReads);
    await viewer.screenshot({ path: "tmp/homework-submitted-tabs-desktop.png" });

    let held = () => {}, lateFinished = () => {};
    const heldRequest = new Promise<void>(resolve => { held = resolve; });
    const lateResponse = new Promise<void>(resolve => { lateFinished = resolve; });
    const gate = new Promise<void>(resolve => { releaseSlow = resolve; });
    await page.route("**/submitted-file?*", async route => {
      if (new URL(route.request().url()).searchParams.get("path") !== files[1].path) return route.continue();
      const response = await route.fetch(); held(); await gate;
      await route.fulfill({ response }).catch(() => {}); lateFinished();
    });
    await second.click(); await heldRequest;
    await expect(panel).toHaveAttribute("aria-busy", "true");
    await expect(panel).not.toContainText(files[0].text);
    await first.click(); await expect(panel).toContainText(files[0].text);
    releaseSlow(); await lateResponse;
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(panel).not.toContainText(files[1].text);
    await page.unroute("**/submitted-file?*");
    await first.focus(); await page.keyboard.press("ArrowDown");
    await expect(second).toBeFocused(); await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(panel).toContainText(files[1].text);

    let failOnce = true;
    await page.route("**/submitted-file?*", async route => {
      if (new URL(route.request().url()).searchParams.get("path") === files[2].path && failOnce) {
        failOnce = false; return route.fulfill({ status: 503, json: { error: { code: "FILE_READ_TEST_FAILURE", message: "Temporary file read failure." } } });
      }
      await route.continue();
    });
    await empty.click(); await expect(panel.getByRole("alert")).toContainText("Temporary file read failure.");
    await expect(panel).not.toContainText(files[1].text);
    await panel.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(panel).toContainText("This file is empty.");
    await page.locator('section[role="alert"]').getByRole("button", { name: "Dismiss notification", exact: true }).click();
    await empty.focus(); await page.keyboard.press("End");
    await expect(last).toBeFocused(); await expect(panel).toContainText("int last(void)");
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileFirst = await first.boundingBox(), mobileCode = await code.boundingBox();
    expect(mobileCode!.x).toBeGreaterThan(mobileFirst!.x + mobileFirst!.width);
    expect(Math.abs(mobileCode!.y - mobileFirst!.y)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await code.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await viewer.screenshot({ path: "tmp/homework-submitted-tabs-mobile.png" });
    await page.reload(); await expect(first).toHaveAttribute("aria-selected", "true"); await expect(panel).toContainText(files[0].text);
    expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(0);
  } finally {
    releaseSlow(); model.release();
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await student.dispose(); await model.close();
  }
});
