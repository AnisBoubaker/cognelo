import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/bank-course";
import { responseJson } from "./fixtures/activity-suite";

for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`keeps workspace identity and actions accessible without redundant banners on ${viewport.name}`, async ({ teacherPage: page, studentPage, adminPage, teacherApi, bankCourse: data }, testInfo) => {
    test.setTimeout(180_000);
    for (const target of [page, studentPage, adminPage]) await target.setViewportSize(viewport);
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/groups/${data.groupId}`, {
      data: {
        availableFrom: new Date(Date.now() - 86_400_000).toISOString(),
        availableUntil: new Date(Date.now() + 86_400_000).toISOString()
      }
    }));

    const pages = [
      { path: "/subjects", title: "Available subjects", button: "Add" },
      { path: "/activity-banks", title: "Activity banks", button: "Add activity bank" },
      { path: `/subjects/${data.subjectId}`, title: data.subjectTitle, link: "Edit" },
      { path: `/subjects/${data.subjectId}/edit`, title: data.subjectTitle },
      { path: `/activity-banks/${data.activityBankId}`, title: data.activityBankTitle, button: "Add activity" },
      { path: `/courses/${data.courseId}?tab=content`, title: `${data.subjectTitle} - ${data.courseTitle}`, button: "Content tree actions", screenshot: "course" },
      { path: `/courses/${data.courseId}?tab=participants`, title: `${data.subjectTitle} - ${data.courseTitle}`, button: "Add course staff", screenshot: "course-staff" },
      { path: data.editorPath, title: data.title, link: "Back to course", screenshot: "editor" },
      { path: `/activity-banks/${data.activityBankId}/activities/${data.bankActivityId}`, title: data.title, link: "Back to bank" },
      { path: `/courses/${data.courseId}/gradebook/activities/${data.activityId}`, title: data.title, button: "Export grades", screenshot: "results" },
      { path: `/courses/${data.courseId}/gradebook/activities/${data.activityId}/manual`, title: data.title, link: "Detailed results" },
      { path: `/courses/${data.courseId}/groups/${data.groupId}/student-view`, title: data.subjectTitle },
      { path: `/courses/${data.courseId}/groups/${data.groupId}/student-view/activities/${data.activityId}`, title: data.title, link: "Back to course" }
    ];
    for (const target of pages) {
      await test.step(target.path, async () => {
        await page.goto(target.path);
        await expect(page.getByRole("heading", { name: target.title, level: 1, exact: true })).toBeVisible();
        if (target.button) await expect(page.getByRole("button", { name: target.button, exact: true })).toBeVisible();
        if (target.link) await expect(page.getByRole("link", { name: target.link, exact: true })).toBeVisible();
        if (target.path.includes("/student-view")) await expect(page.getByText("Published", { exact: true })).toHaveCount(0);
        if (target.path.endsWith("/student-view")) await expectStudentSectionHeading(page, data);
        if (target.path.startsWith(`/courses/${data.courseId}?tab=`)) {
          await expect(page.locator(".course-workspace-header .course-workspace-subject")).toHaveText(data.subjectTitle);
          await expect(page.locator("main h1")).toHaveCount(1);
          await expect(page.getByRole("tabpanel").getByText(data.courseTitle, { exact: true })).toHaveCount(0);
          await expect(page.getByText("Disposable course for end-to-end activity coverage.", { exact: true })).toHaveCount(0);
        }
        await expectFitsViewport(page);
        if (target.screenshot) await page.screenshot({ path: testInfo.outputPath(`${target.screenshot}.png`) });
      });
    }

    await page.goto(`/courses/${data.courseId}?tab=content&view=group&groupId=${data.groupId}`);
    const contentPerspective = page.getByRole("group", { name: "Course content perspective", exact: true });
    await expect(contentPerspective).toBeVisible();
    await expect(contentPerspective.getByRole("link", { name: "Student view", exact: true })).toBeVisible();
    for (const tab of ["Participants", "Gradebook", "Challenges", "Settings", "Groupings"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(contentPerspective).toHaveCount(0);
      await expect(page.locator(".workspace-tab-trailing")).toHaveCount(0);
      await expect(page.locator(".course-workspace-header h1")).toHaveText(`${data.subjectTitle} - ${data.courseTitle}`);
      if (tab === "Gradebook") {
        const gradebook = page.getByRole("region", { name: "Course gradebook", exact: true });
        await expect(gradebook.getByRole("heading", { name: "Course gradebook", exact: true })).toHaveCount(0);
        await expect(gradebook.getByRole("link", { name: data.title, exact: true })).toHaveAttribute("href", `/courses/${data.courseId}/gradebook/activities/${data.activityId}`);
        await expect(gradebook.getByText("No submissions", { exact: true })).toBeVisible();
        await expect(gradebook.getByRole("button", { name: "Export grades", exact: true })).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath("gradebook.png"), fullPage: true });
        await gradebook.getByRole("button", { name: `Expand ${data.title}`, exact: true }).click();
        await expect(gradebook.getByRole("link", { name: data.groupTitle, exact: true })).toHaveAttribute("href", `/courses/${data.courseId}/gradebook/activities/${data.activityId}?groupId=${data.groupId}`);
        await gradebook.getByRole("button", { name: `${data.groupTitle}: Actions`, exact: true }).click();
        await expect(page.getByRole("menuitem", { name: "Export grades", exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
      }
      await expectFitsViewport(page);
    }
    await page.getByRole("tab", { name: "Content", exact: true }).click();
    await expect(contentPerspective).toBeVisible();

    await page.goto("/courses");
    await expect(page.getByRole("link", { name: "Create course", exact: true })).toBeVisible();
    await expect(page.getByRole("link").filter({ has: page.getByRole("heading", { name: data.courseTitle, exact: true }) }).getByText("Published", { exact: true })).toBeVisible();
    await expectFitsViewport(page);

    await studentPage.goto("/courses");
    const studentCourse = studentPage.getByRole("link").filter({ has: studentPage.getByRole("heading", { name: data.courseTitle, exact: true }) });
    await expect(studentCourse).toBeVisible();
    await expect(studentCourse.getByText("Published", { exact: true })).toHaveCount(0);
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await expectStudentSectionHeading(studentPage, data);
    await expect(studentPage.getByText("Published", { exact: true })).toHaveCount(0);
    await expect(studentPage.getByRole("link", { name: data.title, exact: true })).toBeVisible();
    await expectFitsViewport(studentPage);
    for (const tab of ["My teams", "Grades", "Content"]) {
      await studentPage.getByRole("tab", { name: tab, exact: true }).click();
      await expectStudentSectionHeading(studentPage, data);
    }
    await studentPage.screenshot({ path: testInfo.outputPath("student-section.png") });
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

async function expectStudentSectionHeading(page: Page, data: { courseTitle: string; groupTitle: string; subjectTitle: string }) {
  const heading = page.getByRole("heading", { name: data.subjectTitle, level: 1, exact: true });
  await expect(heading).toBeVisible();
  // A section with availability dates still displays only identity in its heading.
  await expect(heading.locator("..").locator("h1 + p")).toHaveText([`${data.courseTitle}: ${data.groupTitle}`]);
  await expectFitsViewport(page);
}

async function expectFitsViewport(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  // Large decorative heroes stay absent; teacher course identity uses its compact header.
  await expect(page.locator("main > .hero-panel")).toHaveCount(0);
}
