import { expect, test } from "./fixtures/bank-course";
import { responseJson } from "./fixtures/activity-suite";
import type { CourseContentItem } from "../../apps/web/src/lib/api";

test.describe("course folder preferences", { tag: "@regression" }, () => {
  test.beforeEach(async ({ teacherApi, bankCourse: data }) => {
    const path = `/api/courses/${data.courseId}/content`;
    const { contentItem: root } = await responseJson<{ contentItem: CourseContentItem }>(await teacherApi.post(`${path}/folders`, {
      data: { title: "Week 1", isVisible: true }
    }));
    const { contentItem: nested } = await responseJson<{ contentItem: CourseContentItem }>(await teacherApi.post(`${path}/folders`, {
      data: { title: "Practice", parentId: root.id, isVisible: true }
    }));
    await responseJson(await teacherApi.post(`${path}/folders`, { data: { title: "Week 2", isVisible: true } }));
    const { contentItems } = await responseJson<{ contentItems: CourseContentItem[] }>(await teacherApi.get(path));
    const activity = contentItems.find((item) => item.activityId === data.activityId && !item.groupId)!;
    await responseJson(await teacherApi.patch(`${path}/${activity.id}`, { data: { parentId: nested.id } }));
  });

  test("starts collapsed, remembers nested choices, renews on return and expires after four idle hours", async ({ teacherPage: page, bankCourse: data }) => {
    await page.clock.install();
    await page.goto(`/courses/${data.courseId}?tab=content`);
    const activity = page.getByRole("link", { name: data.title, exact: true });
    await expect(page.getByRole("button", { name: "Expand Week 1", exact: true })).toBeVisible();
    await expect(page.getByText("Practice", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Expand Week 1", exact: true }).click();
    await expect(page.getByRole("button", { name: "Expand Practice", exact: true })).toBeVisible();
    await expect(activity).toBeHidden();
    await page.getByRole("button", { name: "Expand Practice", exact: true }).click();
    await expect(activity).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand Week 2", exact: true })).toBeVisible();

    await page.clock.fastForward(3 * 60 * 60 * 1000);
    await page.reload();
    await expect(activity).toBeVisible();
    // The original four-hour deadline is now past; returning renewed it.
    await page.clock.fastForward(2 * 60 * 60 * 1000);
    await expect(activity).toBeVisible();
    await page.clock.fastForward(2 * 60 * 60 * 1000);
    await expect(page.getByRole("button", { name: "Expand Week 1", exact: true })).toBeVisible();
    await expect(activity).toBeHidden();
    await page.reload();
    await page.getByRole("button", { name: "Expand Week 1", exact: true }).click();
    await expect(page.getByRole("button", { name: "Expand Practice", exact: true })).toBeVisible();
    await expect(activity).toBeHidden();

    await page.getByRole("button", { name: "Content tree actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "Expand all", exact: true }).click();
    await page.reload();
    await expect(activity).toBeVisible();
    await expect(page.getByRole("button", { name: "Collapse Week 2", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Content tree actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "Collapse all", exact: true }).click();
    await page.reload();
    await expect(page.getByText("Practice", { exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Expand Week 2", exact: true })).toBeVisible();
  });

  test("keeps course, section and learner choices separate, including nested learner folders", async ({ teacherPage, studentPage, bankCourse: data }) => {
    const courseUrl = `/courses/${data.courseId}?tab=content`;
    await teacherPage.goto(courseUrl);
    await teacherPage.getByRole("button", { name: "Expand Week 1", exact: true }).click();
    await teacherPage.getByRole("button", { name: "Expand Practice", exact: true }).click();
    await teacherPage.goto(`${courseUrl}&view=group&groupId=${data.groupId}`);
    await expect(teacherPage.getByRole("button", { name: "Expand Week 1", exact: true })).toBeVisible();
    await teacherPage.getByRole("button", { name: "Expand Week 2", exact: true }).click();
    await teacherPage.goto(courseUrl);
    await expect(teacherPage.getByRole("link", { name: data.title, exact: true })).toBeVisible();
    await expect(teacherPage.getByRole("button", { name: "Expand Week 2", exact: true })).toBeVisible();

    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    const root = studentPage.getByRole("button", { name: /^Week 1(?:\s|$)/ });
    const activity = studentPage.getByRole("link", { name: data.title, exact: true });
    await expect(root).toHaveAttribute("aria-expanded", "false");
    await root.click();
    await expect(studentPage.getByRole("button", { name: "Expand Practice", exact: true })).toBeVisible();
    await expect(activity).toBeHidden();
    await studentPage.getByRole("button", { name: "Expand Practice", exact: true }).click();
    await expect(activity).toBeVisible();
    await studentPage.reload();
    await expect(root).toHaveAttribute("aria-expanded", "true");
    await expect(activity).toBeVisible();
    await root.click();
    await studentPage.reload();
    await expect(root).toHaveAttribute("aria-expanded", "false");
    await expect(activity).toBeHidden();
    await root.click();
    await expect(activity).toBeVisible();
  });

  test("keeps folder controls usable when local storage is blocked", async ({ teacherPage: page, bankCourse: data }) => {
    await page.addInitScript(() => {
      const read = Storage.prototype.getItem;
      const write = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) {
        if (key.startsWith("cognelo:content-folders:")) throw new DOMException("Storage blocked", "SecurityError");
        return read.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("cognelo:content-folders:")) throw new DOMException("Storage blocked", "SecurityError");
        return write.call(this, key, value);
      };
    });
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: "Expand Week 1", exact: true }).click();
    await page.getByRole("button", { name: "Expand Practice", exact: true }).click();
    await expect(page.getByRole("link", { name: data.title, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand Week 1", exact: true })).toBeVisible();
    await expect(page.getByText("Practice", { exact: true })).toBeHidden();
  });
});
