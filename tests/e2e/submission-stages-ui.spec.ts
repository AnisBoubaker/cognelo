import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import type { Locator } from "@playwright/test";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

async function dateTime(root: Locator, selector: string, value: string | null) {
  const date = root.locator(selector); await date.fill(value?.slice(0, 10) ?? "");
  if (value) await date.locator("..").getByRole("textbox", { name: "Time", exact: true }).fill(value.slice(11, 16));
}

test("shared scheduling saves all stage/overall combinations, duration/late controls, cancellation and responsive layout", async ({ bankCourse: data, teacherApi: api, teacherPage: page }) => {
  test.setTimeout(120_000);
  const title = "Stage scheduling UI", id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title, config: {} });
  const settingsUrl = `/api/courses/${data.courseId}/activities/${id}/assign-all-groups`;
  const read = async () => (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsUrl))).settings;
  const values = await read(); await responseJson(await api.post(settingsUrl, { data: { ...values.general, groupAssignments: values.groups.map(group => ({ ...group, assigned: true })) } }));
  const open = async () => {
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${id}?settings=1`);
    const dialog = page.getByRole("dialog", { name: title, exact: true }); await expect(dialog.getByRole("heading", { name: "Submission stages", exact: true })).toBeVisible(); return dialog;
  };
  const early = "2030-01-15T09:00", late = "2030-01-15T11:00";
  for (const [own, overall] of [[null, null], [early, null], [null, late], [early, late], [late, early], [early, early]] as const) {
    const dialog = await open(), stage = dialog.locator("fieldset").filter({ has: page.locator("legend").getByText("Questions answering", { exact: true }) });
    await dateTime(dialog, `[id="activity-settings-until-${id}"]`, overall);
    await dateTime(stage, '[id="stage-questions-general-deadline"]', own);
    await expect(stage.getByRole("status")).toContainText(!own && !overall ? "No deadline" : own ? "Effective deadline" : "Uses activity cutoff");
    const saved = page.waitForResponse(response => response.url().endsWith(settingsUrl) && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click(); expect((await saved).ok()).toBe(true); await expect(dialog).toBeHidden();
    const result = await read(); expect(Boolean(result.general.availableUntil)).toBe(Boolean(overall)); expect(Boolean(result.general.submissionStages?.questions?.deadline)).toBe(Boolean(own));
    const reopened = await open(); await expect(reopened.locator('[id="stage-questions-general-deadline"]')).toHaveValue(own?.slice(0, 10) ?? ""); await expect(reopened.locator(`[id="activity-settings-until-${id}"]`)).toHaveValue(overall?.slice(0, 10) ?? "");
    await reopened.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  let dialog = await open();
  await dateTime(dialog, `[id="activity-settings-until-${id}"]`, late);
  await dateTime(dialog, '[id="stage-files-general-deadline"]', early);
  await dialog.getByRole("switch", { name: "File submission — Allow late submissions", exact: true }).check();
  await dialog.getByRole("switch", { name: "File submission — Limit the late-submission period", exact: true }).check();
  await dialog.getByLabel("File submission — Days", { exact: true }).fill("0"); await dialog.getByLabel("File submission — Hours", { exact: true }).fill("1");
  await dialog.getByRole("switch", { name: "Questions answering — Set a time limit", exact: true }).check();
  await dialog.getByLabel("Questions answering — time limit (Minutes)", { exact: true }).fill("20");
  await dialog.getByRole("button", { name: "Save settings", exact: true }).click(); await expect(dialog).toBeHidden();
  expect((await read()).general.submissionStages).toMatchObject({ files: { allowLate: true, lateLimitMinutes: 60 }, questions: { timeLimitMinutes: 20 } });
  dialog = await open(); await dialog.getByLabel("Questions answering — time limit (Minutes)", { exact: true }).fill("25");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); dialog = await open(); await expect(dialog.getByLabel("Questions answering — time limit (Minutes)", { exact: true })).toHaveValue("20");
  await dialog.getByRole("tab", { name: "Group assignment", exact: true }).click();
  const deadlineOverride = dialog.getByRole("checkbox", { name: "Override File submission — deadline", exact: true });
  await expect(deadlineOverride).not.toBeChecked();
  await deadlineOverride.check(); await dateTime(dialog, '[id="stage-files-override-deadline"]', null);
  await dialog.getByRole("button", { name: "Save settings", exact: true }).click(); await expect(dialog).toBeHidden();
  expect((await read()).groups[0].submissionStages?.files?.deadline).toBeNull();
  dialog = await open(); await dialog.getByRole("tab", { name: "Group assignment", exact: true }).click();
  await expect(deadlineOverride).toBeChecked(); await deadlineOverride.uncheck();
  await dialog.getByRole("button", { name: "Save settings", exact: true }).click(); await expect(dialog).toBeHidden();
  expect((await read()).groups[0].submissionStages?.files?.deadline).toBeUndefined();
  dialog = await open();
  await dialog.locator("fieldset").first().scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: "tmp/submission-stages-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await dialog.locator("fieldset").first().scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: "tmp/submission-stages-mobile.png" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto(`/courses/${data.courseId}/activities/${id}`);
  await page.getByRole("tablist", { name: "Programming Homework settings", exact: true }).getByRole("tab", { name: "Submission settings", exact: true }).click();
  await expect(page.locator(".homework-deadline-settings")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Activity scheduling", exact: true })).toHaveAttribute("href", `/courses/${data.courseId}/gradebook/activities/${id}?settings=1`);
  const left = page.getByRole("tablist", { name: "Programming Homework settings", exact: true });
  await left.getByRole("tab", { name: "Question Generation", exact: true }).click();
  await page.getByRole("switch", { name: "Generate challenge questions", exact: true }).uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click(); await expect(page.locator(".homework-authoring-panel > form > div > .edit-action-bar")).toContainText("Everything is saved.");
  await left.getByRole("tab", { name: "Submission settings", exact: true }).click(); await page.getByRole("link", { name: "Activity scheduling", exact: true }).click();
  dialog = page.getByRole("dialog", { name: title, exact: true });
  await expect(dialog.getByRole("switch", { name: "Questions answering — Set a time limit", exact: true })).toBeDisabled();
  expect((await read()).general.submissionStages?.questions?.timeLimitMinutes).toBe(20);
});
