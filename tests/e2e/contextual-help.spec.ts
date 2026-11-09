import { createAuthenticatedApi } from "./fixtures/auth";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";

test("teacher help supports hover, focus, pinning, Escape, disabled stages and touch without changing settings", async ({ bankCourse: data, teacherApi: api, teacherPage: page, browser }) => {
  const title = "Contextual help", id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title, config: {} });
  const base = `/api/courses/${data.courseId}/activities/${id}/coding-homework-grader`;
  const record = await responseJson<{ assignment: object; requirements: { requirements: object } }>(await api.get(`${base}/authoring`));
  await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...record.assignment, settings: { questionGenerationEnabled: false } }, requirements: record.requirements.requirements } }));
  const settingsUrl = `/api/courses/${data.courseId}/activities/${id}/assign-all-groups`;
  const before = await responseJson(await api.get(settingsUrl));
  let writes = 0; page.on("request", request => { if (request.method() === "POST" && request.url().endsWith(settingsUrl)) writes++; });
  const path = `/courses/${data.courseId}/gradebook/activities/${id}?settings=1`;
  await page.goto(path);
  const dialog = page.getByRole("dialog", { name: title, exact: true }), help = dialog.getByRole("button", { name: "Help: Submission stages", exact: true });
  await expect(help).toBeVisible(); await help.scrollIntoViewIfNeeded();
  const titleBounds = await dialog.getByRole("heading", { name: "Submission stages", exact: true }).boundingBox(), helpBounds = await help.boundingBox();
  expect(helpBounds!.x).toBeGreaterThanOrEqual(titleBounds!.x + titleBounds!.width); expect(Math.abs(helpBounds!.y + helpBounds!.height / 2 - titleBounds!.y - titleBounds!.height / 2)).toBeLessThan(3);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(dialog.locator(".date-time-zone-label")).toHaveCount(0);
  expect(await dialog.innerText()).not.toMatch(/(?:America|Asia|Europe)\/[A-Za-z_]+/);
  await help.hover(); await expect(page.getByRole("tooltip")).toContainText("hard cutoff");
  await page.getByRole("tooltip").hover(); await expect(page.getByRole("tooltip")).toBeVisible();
  await help.click(); await page.mouse.move(10, 10); await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.getByRole("tooltip")).toHaveCount(0); await expect(dialog).toBeVisible();
  const date = dialog.getByLabel("File submission — deadline", { exact: true }); await date.focus(); await help.focus();
  await expect(page.getByRole("tooltip")).toBeVisible(); await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  const inactive = dialog.getByRole("button", { name: "Help: Questions answering", exact: true });
  await expect(inactive).toBeEnabled(); await inactive.hover(); await expect(page.getByRole("tooltip")).toContainText("stage is disabled");
  await page.keyboard.press("Escape"); await expect(dialog.getByRole("group", { name: "Questions answering", exact: true }).getByRole("switch").first()).toBeDisabled();
  expect(writes).toBe(0); expect(await responseJson(await api.get(settingsUrl))).toEqual(before);
  await dialog.screenshot({ path: "tmp/contextual-help-desktop.png" });
  const touch = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const mobile = await touch.newPage(); await mobile.goto(path);
    const modal = mobile.getByRole("dialog", { name: title, exact: true });
    await modal.getByRole("button", { name: "Help: Submission stages", exact: true }).tap();
    const tip = mobile.getByRole("tooltip"); await expect(tip).toContainText("hard cutoff");
    const bounds = await tip.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await mobile.screenshot({ path: "tmp/contextual-help-touch.png" });
    await modal.getByRole("heading", { name: title, exact: true }).tap(); await expect(tip).toHaveCount(0); await expect(modal).toBeVisible();
  } finally { await touch.close(); }
});

test("activity authoring help preserves titles, field names and unsaved work across activity types", async ({ bankCourse: data, teacherPage: page }) => {
  test.setTimeout(120_000);
  for (const activityTypeKey of ["mcq", "coding-exercise", "parsons-problem", "web-design-coding-exercise", "coding-homework-grader"]) {
    const title = `Help ${activityTypeKey}`, id = await createCourseActivity(data, { activityTypeKey, title, config: {} });
    await page.goto(`/courses/${data.courseId}/activities/${id}`);
    const input = page.getByLabel(activityTypeKey === "parsons-problem" ? "Activity title" : "Title", { exact: true }); await expect(input).toHaveValue(title); await input.fill(`${title} draft`);
    const tabs = page.getByRole("tablist", { name: "Activity editor", exact: true }); await tabs.getByRole("tab", { name: "Concepts", exact: true }).click();
    await page.getByRole("button", { name: "Help: Knowledge concepts", exact: true }).hover(); await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape"); await tabs.getByRole("tab", { name: "Activity", exact: true }).click();
    await expect(input).toHaveValue(`${title} draft`);
    await page.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(input).toHaveValue(title);
  }
});

test("contextual guidance is available across teacher workspaces and administrative forms", async ({ bankCourse: data, teacherPage: page, browser }) => {
  test.setTimeout(120_000);
  for (const route of [
    `/courses/${data.courseId}?tab=settings&section=general`,
    `/courses/${data.courseId}?tab=settings&section=ai`,
    `/courses/${data.courseId}?tab=participants`,
    `/subjects/${data.subjectId}/edit`,
    `/activity-banks/${data.activityBankId}/activities/${data.bankActivityId}`
  ]) {
    await page.goto(route);
    const help = page.getByRole("button", { name: /^Help:/ }).first(); await expect(help).toBeVisible();
    await help.hover(); await expect(page.getByRole("tooltip")).toBeVisible(); await page.keyboard.press("Escape");
  }
  const admin = await createAuthenticatedApi("admin"), context = await browser.newContext({ storageState: await admin.storageState() });
  try {
    const adminPage = await context.newPage();
    for (const route of ["/settings/ai-agents", "/settings/email", "/settings/plugins", "/settings/time"]) {
      await adminPage.goto(route);
      const help = adminPage.getByRole("button", { name: /^Help:/ }).first(); await expect(help).toBeVisible();
      await help.hover(); await expect(adminPage.getByRole("tooltip")).toBeVisible(); await adminPage.keyboard.press("Escape");
    }
  } finally { await context.close(); await admin.dispose(); }
});

test("activity help preserves MCQ choice settings and the visible Parsons group editor", async ({ bankCourse: data, teacherPage: page }) => {
  page.setDefaultTimeout(10_000);
  const mcqId = await createCourseActivity(data, { activityTypeKey: "mcq", title: "Choice settings", config: { source: "## Which value is even?\n- [x] 2\n- [ ] 3", randomizeChoices: false } });
  await page.goto(`/courses/${data.courseId}/activities/${mcqId}`);
  const choices = page.getByRole("checkbox", { name: "Randomize choices", exact: true });
  await expect(choices).toBeVisible();
  await page.getByRole("button", { name: "Help: Randomize choices", exact: true }).hover();
  await expect(page.getByRole("tooltip")).toContainText("random order");
  await page.keyboard.press("Escape"); await choices.check();
  await page.getByRole("button", { name: "Save multiple choice questions", exact: true }).click();
  await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
  await page.reload(); await expect(choices).toBeChecked();

  const parsonsId = await createCourseActivity(data, { activityTypeKey: "parsons-problem", title: "Group settings", config: {
    prompt: "Reorder these lines.", solution: "value = 2\nprint(value)", language: "python", stripIndentation: false,
    groups: [{ id: "group-1", label: "First pair", startLine: 0, endLine: 1, orderSensitive: true }], precedenceRules: []
  } });
  await page.goto(`/courses/${data.courseId}/activities/${parsonsId}`);
  await page.locator(".parsons-group-box").filter({ hasText: "First pair" }).click();
  const group = page.getByRole("textbox", { name: "Group label", exact: true });
  await expect(group).toHaveValue("First pair"); await group.fill("Edited pair");
  await page.getByRole("button", { name: "Help: Line groups", exact: true }).hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip").getByRole("textbox")).toHaveCount(0);
  await expect(group).toBeVisible(); await page.keyboard.press("Escape");
  const flexible = page.getByRole("checkbox", { name: "Allow the lines inside this group to move freely", exact: true });
  await flexible.check(); await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
  await page.reload(); await page.locator(".parsons-group-box").filter({ hasText: "Edited pair" }).click();
  await expect(group).toHaveValue("Edited pair"); await expect(flexible).toBeChecked();
});
