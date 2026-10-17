import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/bank-course";

for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`keeps workspace identity and actions accessible without redundant banners on ${viewport.name}`, async ({ teacherPage: page, studentPage, adminPage, bankCourse: data }, testInfo) => {
    test.setTimeout(180_000);
    for (const target of [page, studentPage, adminPage]) await target.setViewportSize(viewport);

    const pages = [
      { path: "/subjects", title: "Available subjects", button: "Add" },
      { path: "/activity-banks", title: "Activity banks", button: "Add activity bank" },
      { path: `/subjects/${data.subjectId}`, title: data.subjectTitle, link: "Edit" },
      { path: `/subjects/${data.subjectId}/edit`, title: data.subjectTitle },
      { path: `/activity-banks/${data.activityBankId}`, title: data.activityBankTitle, button: "Add activity" },
      { path: `/courses/${data.courseId}?tab=content`, title: data.courseTitle, button: "Content tree actions", screenshot: "course" },
      { path: data.editorPath, title: data.title, link: "Back to course", screenshot: "editor" },
      { path: `/activity-banks/${data.activityBankId}/activities/${data.bankActivityId}`, title: data.title, link: "Back to bank" },
      { path: `/courses/${data.courseId}/gradebook/activities/${data.activityId}`, title: data.title, button: "Export grades", screenshot: "results" },
      { path: `/courses/${data.courseId}/gradebook/activities/${data.activityId}/manual`, title: data.title, link: "Detailed results" },
      { path: `/courses/${data.courseId}/groups/${data.groupId}/student-view`, title: `${data.courseTitle}: ${data.groupTitle}` },
      { path: `/courses/${data.courseId}/groups/${data.groupId}/student-view/activities/${data.activityId}`, title: data.title, link: "Back to course" }
    ];
    for (const target of pages) {
      await test.step(target.path, async () => {
        await page.goto(target.path);
        await expect(page.getByRole("heading", { name: target.title, level: 1, exact: true })).toBeVisible();
        if (target.button) await expect(page.getByRole("button", { name: target.button, exact: true })).toBeVisible();
        if (target.link) await expect(page.getByRole("link", { name: target.link, exact: true })).toBeVisible();
        if (target.path.includes("/student-view")) await expect(page.getByText("Published", { exact: true })).toHaveCount(0);
        await expectFitsViewport(page);
        if (target.screenshot) await page.screenshot({ path: testInfo.outputPath(`${target.screenshot}.png`) });
      });
    }

    await page.goto("/courses");
    await expect(page.getByRole("link", { name: "Create course", exact: true })).toBeVisible();
    await expect(page.getByRole("link").filter({ has: page.getByRole("heading", { name: data.courseTitle, exact: true }) }).getByText("Published", { exact: true })).toBeVisible();
    await expectFitsViewport(page);

    await studentPage.goto("/courses");
    const studentCourse = studentPage.getByRole("link").filter({ has: studentPage.getByRole("heading", { name: data.courseTitle, exact: true }) });
    await expect(studentCourse).toBeVisible();
    await expect(studentCourse.getByText("Published", { exact: true })).toHaveCount(0);
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await expect(studentPage.getByRole("heading", { name: `${data.courseTitle}: ${data.groupTitle}`, level: 1, exact: true })).toBeVisible();
    await expect(studentPage.getByText("Published", { exact: true })).toHaveCount(0);
    await expect(studentPage.getByRole("link", { name: data.title, exact: true })).toBeVisible();
    await expectFitsViewport(studentPage);
    await studentPage.getByRole("link", { name: data.title, exact: true }).click();
    await expect(studentPage.getByRole("heading", { name: data.title, level: 1, exact: true })).toBeVisible();
    await expect(studentPage.getByRole("link", { name: "Back to course", exact: true })).toBeVisible();
    await expectFitsViewport(studentPage);
    await studentPage.screenshot({ path: testInfo.outputPath("student-activity.png") });

    for (const path of ["profile", "users", "ai-agents", "email", "runners", "plugins", "maintenance/media"]) {
      await adminPage.goto(`/settings/${path}`);
      await expect(adminPage.locator("main h1")).toBeVisible();
      await expectFitsViewport(adminPage);
    }
  });
}

async function expectFitsViewport(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  // Main content now begins immediately below the application's navigation.
  await expect(page.locator("main > .hero-panel")).toHaveCount(0);
}
