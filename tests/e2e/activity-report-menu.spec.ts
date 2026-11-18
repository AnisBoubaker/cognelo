import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, WEB_BASE_URL } from "./fixtures/auth";
import { openActivityReportActions } from "./fixtures/gradebook-ui";

test.describe.configure({ timeout: 120_000 });
test("all available activity reports share one actions menu and keep contextual Back navigation visible", async ({ bankCourse: data, teacherApi: api, teacherPage: page }, info) => {
  const types = ["mcq", "coding-exercise", "coding-homework-grader", "parsons-problem", "web-design-coding-exercise", "test"] as const;
  for (const type of types) {
    const title = `Menu ${type}`;
    let id: string;
    if (type === "test") {
      id = (await responseJson<{ test: { activity: { id: string } } }>(await api.post(`/api/courses/${data.courseId}/tests`, { data: { title, lifecycle: "published", settings: { allowResume: true } } }))).test.activity.id;
      await responseJson(await api.post(`/api/courses/${data.courseId}/activities/${id}/test/items`, { data: { source: "local", activityTypeKey: "mcq", title: "Question", pointsPossible: 10, config: { source: "## Pick a number\n- [x] One\n- [ ] Two" } } }));
    } else id = await createCourseActivity(data, { activityTypeKey: type, title, config: type === "coding-exercise" ? { language: "python", prompt: "", starterCode: "", sampleTests: [] } : {} });
    await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    const report = `/courses/${data.courseId}/gradebook/activities/${id}?origin=content&report=overview&groupId=${data.groupId}`;
    await page.goto(report);
    await expect(page.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
    const header = page.locator(".activity-report-actions"), trigger = header.getByRole("button", { name: "Activity actions", exact: true });
    await expect(header.getByRole("button")).toHaveCount(1);
    const back = header.getByRole("link", { name: "Back to course content", exact: true });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", `/courses/${data.courseId}?tab=content&view=group&groupId=${data.groupId}`);
    await trigger.focus(); await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu", { name: "Activity actions", exact: true });
    await expect(menu.getByRole("menuitem", { name: "Edit activity", exact: true })).toBeFocused();
    await expect(menu.getByRole("menuitem", { name: "Settings", exact: true })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Export grades", exact: true })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Back to/ })).toHaveCount(0);
    await page.keyboard.press("End"); await expect(menu.locator('[role="menuitem"]:not(:disabled)').last()).toBeFocused();
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); await expect(menu).toBeHidden();
    await openActivityReportActions(page);
    await menu.getByRole("menuitem", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog", { name: title, exact: true });
    await expect(settings.getByRole("tab", { name: "General", exact: true })).toBeVisible();
    await expect(menu).toBeHidden();
    await settings.getByRole("button", { name: "Cancel", exact: true }).last().click();
    await page.setViewportSize({ width: 390, height: 600 });
    await openActivityReportActions(page);
    const box = await menu.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(7); expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    expect(box!.y).toBeGreaterThanOrEqual(7); expect(box!.y + box!.height).toBeLessThanOrEqual(601);
    if (type === "test") {
      await page.screenshot({ path: info.outputPath("report-menu-mobile.png") });
      await page.setViewportSize({ width: 390, height: 280 });
      await expect(menu).toBeHidden();
      await openActivityReportActions(page);
      await expect(menu.getByRole("menuitem", { name: "Edit activity", exact: true })).toBeFocused();
      await menu.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await expect.poll(() => menu.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await expect(menu).toBeVisible();
      await page.setViewportSize({ width: 390, height: 600 });
      await expect(menu).toBeHidden();
    }
    await page.keyboard.press("Escape");
    await expect(back).toBeVisible();
    if (type === "coding-homework-grader") await page.screenshot({ path: info.outputPath("compact-homework-header.png") });
    await back.click(); await expect(page).toHaveURL(`/courses/${data.courseId}?tab=content&view=group&groupId=${data.groupId}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}`);
  await expect(page.getByRole("link", { name: "Back to course gradebook", exact: true })).toBeVisible();
});

test("section graders get export/review menu entries without authoring controls", async ({ bankCourse: data, teacherApi, browser }) => {
  const admin = await createAuthenticatedApi("admin");
  let id: string | undefined;
  let account: Awaited<ReturnType<typeof createAuthenticatedApiWithCredentials>> | undefined;
  let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    const credentials = { email: `report-menu-staff-${data.token}@example.test`, password: "MenuStaff123!" };
    id = (await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: { ...credentials, firstName: "Scoped", lastName: "Teacher", roles: ["teacher"] } }))).user.id;
    await prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date(), mustChangePassword: false } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: credentials.email, role: "teacher" } }));
    account = await createAuthenticatedApiWithCredentials(credentials);
    context = await browser.newContext({ baseURL: WEB_BASE_URL, storageState: await account.storageState() });
    const page = await context.newPage();
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}?groupId=${data.groupId}`);
    const menu = await openActivityReportActions(page);
    await expect(menu.getByRole("menuitem", { name: "Edit activity", exact: true })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "Settings", exact: true })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "Export grades", exact: true })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Export student answers", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Back to course gradebook", exact: true })).toBeVisible();
  } finally { await context?.close(); await account?.dispose(); await admin.dispose(); if (id) await prisma.user.deleteMany({ where: { id } }); }
});
