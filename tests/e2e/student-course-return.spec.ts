import { expect, test } from "./fixtures/bank-course";
import { responseJson } from "./fixtures/activity-suite";
import type { CourseContentItem } from "../../apps/web/src/lib/api";

test.use({ actionTimeout: 15_000 });

for (const layout of ["accordion", "folder_tabs"] as const) {
  for (const preview of [false, true]) {
    test(`Back to course restores ${layout} folders and position in ${preview ? "teacher Student view" : "learner view"}`, { tag: "@regression" }, async ({ bankCourse: data, teacherApi, studentPage, teacherPage }) => {
      test.setTimeout(90_000);
      const page = preview ? teacherPage : studentPage;
      const path = `/api/courses/${data.courseId}/content`;
      await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}`, { data: { studentContentLayout: layout } }));
      await responseJson(await teacherApi.post(`${path}/folders`, { data: { title: "Week 1", isVisible: true, position: 0 } }));
      const { contentItem: root } = await responseJson<{ contentItem: CourseContentItem }>(await teacherApi.post(`${path}/folders`, {
        data: { title: "Week 2", isVisible: true, position: 1 }
      }));
      const { contentItem: nested } = await responseJson<{ contentItem: CourseContentItem }>(await teacherApi.post(`${path}/folders`, {
        data: { title: "Practice", parentId: root.id, isVisible: true }
      }));
      for (let i = 0; i < 18; i++) await responseJson(await teacherApi.post(`${path}/folders`, {
        data: { title: `Topic ${i + 1}`, parentId: nested.id, isVisible: true, position: i }
      }));
      const { contentItems } = await responseJson<{ contentItems: CourseContentItem[] }>(await teacherApi.get(path));
      const activity = contentItems.find(item => item.activityId === data.activityId && !item.groupId)!;
      await responseJson(await teacherApi.patch(`${path}/${activity.id}`, { data: { parentId: nested.id, position: 1000 } }));
      const groupPath = `/courses/${data.courseId}/groups/${data.groupId}`;
      const base = preview ? `${groupPath}/student-view?previewSession=course-return` : groupPath;
      await page.goto(base);
      if (layout === "folder_tabs") await page.getByRole("link", { name: /^Week 2/ }).click();
      else await page.getByRole("button", { name: /^Week 2(?:\s|$)/ }).click();
      await page.getByRole("button", { name: "Expand Practice", exact: true }).click();
      const activityLink = page.getByRole("link", { name: data.title, exact: true });
      await activityLink.scrollIntoViewIfNeeded();
      const originalScroll = await page.evaluate(() => window.scrollY);
      expect(originalScroll).toBeGreaterThan(200);
      await activityLink.click();
      await expect(page.getByRole("link", { name: "Back to course", exact: true })).toBeVisible();
      // Reopening the activity must not depend on a live React component or browser history entry.
      await page.reload();
      await page.getByRole("link", { name: "Back to course", exact: true }).click();
      if (layout === "folder_tabs") await expect(page.getByRole("heading", { name: /^Week 2(?:\s|$)/ })).toBeVisible();
      else await expect(page.getByRole("button", { name: /^Week 2(?:\s|$)/ })).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("button", { name: "Collapse Practice", exact: true })).toBeVisible();
      await expect(activityLink).toBeVisible();
      await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - originalScroll)).toBeLessThan(8);
      // The icon action uses the same navigation capture as the title link.
      await page.getByRole("link", { name: `Open ${data.title}`, exact: true }).click();
      await page.getByRole("link", { name: "Back to course", exact: true }).click();
      await expect(activityLink).toBeVisible();
      if (!preview) {
        await page.getByRole("tab", { name: "Grades", exact: true }).click();
        // Let the client-side tab transition complete before forcing a new document navigation.
        await expect(page.getByRole("tab", { name: "Grades", exact: true })).toHaveAttribute("aria-selected", "true");
        await page.goto(`${groupPath}/activities/assigned/${data.activityId}`);
        await page.getByRole("link", { name: "Back to course", exact: true }).click();
        await expect(page.getByRole("tab", { name: "Grades", exact: true })).toHaveAttribute("aria-selected", "true");
        await page.getByRole("tab", { name: "Content", exact: true }).click();
        await expect(activityLink).toBeVisible();
      }
      // A malformed preference safely falls back to the normal first content view.
      await activityLink.click();
      await expect(page.getByRole("link", { name: "Back to course", exact: true })).toBeVisible();
      await page.evaluate(({ courseId, scope }) => {
        const key = Object.keys(localStorage).find(key => key.startsWith("cognelo:course-location:") && key.includes(courseId) && key.includes(scope));
        if (!key) throw new Error("Expected a browser-local course preference");
        localStorage.setItem(key, "malformed");
      }, { courseId: data.courseId, scope: preview ? "preview" : "learner" });
      await page.getByRole("link", { name: "Back to course", exact: true }).click();
      if (layout === "folder_tabs") await expect(page.getByRole("heading", { name: "Week 1", exact: true })).toBeVisible();
      else await expect(page.getByRole("button", { name: /^Week 2(?:\s|$)/ })).toBeVisible();
    });
  }
}

test("course navigation remains usable with blocked localStorage", async ({ bankCourse: data, studentPage: page }) => {
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem, write = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith("cognelo:course-location:")) throw new DOMException("Blocked", "SecurityError");
      return read.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("cognelo:course-location:")) throw new DOMException("Blocked", "SecurityError");
      return write.call(this, key, value);
    };
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
  await page.getByRole("tab", { name: "Grades", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Grades", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await page.getByRole("link", { name: data.title, exact: true }).click();
  await page.getByRole("link", { name: "Back to course", exact: true }).click();
  await expect(page.getByRole("link", { name: data.title, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
