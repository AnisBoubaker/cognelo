import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures/bank-course";
import { createCourseActivity } from "./fixtures/activity-suite";

async function appearance(button: Locator) {
  const read = () => button.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundImage,
      radius: style.borderRadius,
      font: style.fontSize,
      height: style.minHeight,
      padding: style.padding,
      shadow: style.boxShadow
    };
  });
  // Hydration can replace the action bar after visibility has been checked.
  // Detached nodes return empty computed styles; wait for an attached reading.
  let result = await read();
  await expect.poll(async () => {
    result = await read();
    return Object.values(result).every((value) => value.length > 0);
  }).toBe(true);
  return result;
}

async function expectAction(button: Locator, icon: string) {
  await expect(button).toBeVisible();
  await expect(button).toHaveAccessibleName(/\S/);
  await expect(button.locator(`svg[data-action-icon="${icon}"][aria-hidden="true"]`)).toHaveCount(1);
}

test("page, dialog, admin, and plugin actions share icons and the compact outline style", async ({
  teacherPage: page, adminPage, teacherApi, bankCourse: data
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/subjects");
  const add = page.getByRole("button", { name: "Add", exact: true });
  await expectAction(add, "add");
  const reference = await appearance(add);
  expect(reference).toMatchObject({ background: "none", shadow: "none", radius: "10px", font: "14px" });
  await add.click();
  await expectAction(page.getByRole("button", { name: "Create", exact: true }), "add");
  await expectAction(page.getByRole("button", { name: "Cancel", exact: true }).first(), "close");
  await page.screenshot({ path: testInfo.outputPath("subjects-actions.png") });
  await page.getByRole("button", { name: "Cancel", exact: true }).first().click();

  for (const target of [
    { page, path: "/activity-banks", name: "Add activity bank", icon: "add" },
    { page: adminPage, path: "/settings/users", name: "Add user", icon: "add" },
    { page: adminPage, path: "/settings/ai-agents", name: "Save model", icon: "save" }
  ]) {
    await target.page.goto(target.path);
    const button = target.page.getByRole("button", { name: target.name, exact: true });
    await expectAction(button, target.icon);
    expect(await appearance(button)).toEqual(reference);
  }

  for (const type of ["coding-exercise", "parsons-problem", "web-design-coding-exercise", "coding-homework-grader"] as const) {
    const activityId = await createCourseActivity(data, { activityTypeKey: type, title: `Button audit ${type}`, config: {} });
    await page.goto(`/courses/${data.courseId}/activities/${activityId}`);
    const back = page.getByRole("link", { name: "Back to course", exact: true });
    await expectAction(back, "back");
    expect(await appearance(back)).toEqual(reference);
    const save = page.locator(".edit-action-bar").getByRole("button").filter({ has: page.locator('svg[data-action-icon="save"]') });
    await expectAction(save, "save");
    expect(await appearance(save)).toEqual(reference);
    await page.screenshot({ path: testInfo.outputPath(`${type}-actions.png`) });
  }

  await page.goto(data.editorPath);
  const save = page.getByRole("button", { name: "Save multiple choice questions", exact: true });
  await expectAction(save, "save");
  await expect(save).toBeDisabled();
  const before = await appearance(save);
  await save.hover({ force: true });
  expect(await appearance(save)).toEqual(before);
  await page.getByLabel("Title", { exact: true }).fill(`${data.title} edited`);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText("Multiple choice questions activity saved.", { exact: true })).toBeVisible();
  await expect(save).toBeDisabled();

  await page.goto(`/courses/${data.courseId}?tab=content`);
  await page.getByRole("button", { name: /^Actions for E2E regression MCQ/ }).click();
  await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
  const remove = dialog.getByRole("button", { name: "Remove", exact: true });
  await expectAction(remove, "alert");
  expect(await remove.evaluate((button) => getComputedStyle(button).color)).toBe("rgb(180, 35, 24)");
  expect((await appearance(remove)).background).toBe("none");
  await expectAction(dialog.getByRole("button", { name: "Cancel", exact: true }), "close");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await teacherApi.get(data.courseActivityPath)).ok()).toBe(true);
});

test("login actions stay legible through hover and keyboard focus", async ({ page }, testInfo) => {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Sign in", exact: true }).last();
  await expectAction(submit, "login");
  const baseline = await appearance(submit);
  expect(baseline.background).toBe("none");
  await submit.hover();
  expect((await appearance(submit)).shadow).toBe("none");
  expect(await submit.evaluate((button) => getComputedStyle(button).color)).toBe("rgb(22, 33, 72)");
  await page.getByLabel("Password", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  expect(await submit.evaluate((button) => getComputedStyle(button).outlineStyle)).toBe("solid");
  await page.screenshot({ path: testInfo.outputPath("login-actions.png") });
  await page.getByRole("button", { name: "First-time access", exact: true }).click();
  await expectAction(page.getByRole("button", { name: "Activate account", exact: true }), "activate");
});
