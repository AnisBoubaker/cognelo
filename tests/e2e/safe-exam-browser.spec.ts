import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings, SafeExamBrowserLaunch } from "../../apps/web/src/lib/api";

test("SEB launch returns the ordinary browser to content and reopening creates a fresh launch", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const groupPath = `/courses/${data.courseId}/groups/${data.groupId}`;
  const assignedPath = `${groupPath}/activities/assigned/${data.activityId}`;
  const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
  const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
  await responseJson(await teacherApi.post(settingsPath, { data: {
    ...settings.general, assessmentMode: "summative", requireSafeExamBrowser: true,
    groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] }))
  } }));

  const configurations: string[] = [];
  let handoffs = 0;
  const handoffPath = `/__e2e-seb-handoff/${data.token}`;
  // Exercise real launch issuance. Only the external application handoff is
  // intercepted so the test does not launch the OS's SEB app or another document.
  await page.route(`**/api${assignedPath}/seb`, async (route) => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const body = await response.json() as { launch: SafeExamBrowserLaunch };
    expect(body.launch.launchUrl).toMatch(/^sebs?:\/\//);
    configurations.push(body.launch.downloadUrl);
    body.launch.launchUrl = new URL(`${handoffPath}?launch=${configurations.length}`, page.url()).href;
    await route.fulfill({ response, json: body });
  });
  await page.route(`**${handoffPath}?*`, async (route) => {
    handoffs++;
    await route.abort("aborted");
  });

  await page.goto(groupPath);
  const dialog = page.getByRole("dialog", { name: "Open this activity in Safe Exam Browser?" });
  for (let launch = 1; launch <= 2; launch++) {
    await page.getByRole("link", { name: data.title, exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Four", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Open Safe Exam Browser", exact: true }).click({ noWaitAfter: true });
    await expect(page).toHaveURL(groupPath);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Content", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => handoffs).toBe(launch);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("link", { name: data.title, exact: true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
  }
  await page.goBack();
  await expect(page).toHaveURL(groupPath);
  await expect(dialog).toHaveCount(0);
  expect(configurations).toHaveLength(2);
  expect(new Set(configurations).size).toBe(2);
  expect(await prisma.activityAttempt.count({ where: { activityId: data.activityId } })).toBe(0);
});
