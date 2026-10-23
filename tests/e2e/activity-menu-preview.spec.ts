import { prisma } from "@cognelo/db";
import { expect, test, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";

test("activity menu previews open in a new tab with the correct section and no academic records", async ({
  bankCourse: data, teacherApi, teacherPage: page
}) => {
  test.setTimeout(120_000);
  const title = "Preview this exercise";
  const activityId = await createCourseActivity(data, { activityTypeKey: "mcq", title, config: { source: ORIGINAL_SOURCE, randomizeChoices: false } });
  const unassignedId = await createCourseActivity(data, { activityTypeKey: "mcq", title: "Unassigned exercise", config: { source: ORIGINAL_SOURCE } });
  const { group } = await responseJson<{ group: { id: string; title: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/groups`, {
    data: { title: "A section without this assignment" }
  }));
  await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/groups/${group.id}`, { data: { status: "published", availableFrom: null, availableUntil: null } }));
  async function assign(groupId: string) {
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${groupId}/activities`, { data: {
      activityId, metadata: { assessmentMode: "formative" }, contentPlacement: { isVisible: true, parentId: null }
    } }));
  }
  const records = () => Promise.all([
    prisma.activityAttempt.count({ where: { activityId } }),
    prisma.activityResponseDraft.count({ where: { groupActivity: { activityId } } }),
    prisma.grade.count({ where: { gradebookItem: { activityId } } })
  ]);
  await assign(data.groupId);
  const coursePath = `/courses/${data.courseId}?tab=content`;
  await page.goto(coursePath);
  await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
  const previewAction = page.getByRole("menuitem", { name: "Preview", exact: true });
  await expect(previewAction).toHaveAttribute("href", `/courses/${data.courseId}/groups/${data.groupId}/student-view/activities/${activityId}`);
  await expect(previewAction).toHaveAttribute("target", "_blank");
  await expect(previewAction).toHaveAttribute("rel", "noopener noreferrer");
  const before = await records();
  const [preview] = await Promise.all([page.waitForEvent("popup"), previewAction.click()]);
  try {
    await expect(page).toHaveURL(coursePath);
    await expect(preview.getByText("Work completed here is temporary and is not saved to any student record.", { exact: true })).toBeVisible();
    await expect(preview.getByLabel("Four", { exact: true })).toBeVisible();
    expect(await preview.evaluate(() => window.opener === null)).toBe(true);
    await preview.getByLabel("Four", { exact: true }).check();
    await preview.getByRole("button", { name: "Check answers", exact: true }).click();
    await expect(preview.getByText("+1", { exact: true })).toBeVisible();
    expect(await records()).toEqual(before);
  } finally { await preview.close(); }

  await page.getByRole("button", { name: "Actions for Unassigned exercise", exact: true }).click();
  await expect(previewAction).toBeDisabled();
  await expect(previewAction).toHaveAttribute("title", "Assign this activity to a section to preview it as a student.");
  await page.keyboard.press("Escape");
  expect(await prisma.courseGroupActivity.count({ where: { activityId: unassignedId } })).toBe(0);

  const sectionPath = `${coursePath}&view=group&groupId=${group.id}`;
  await page.goto(sectionPath);
  await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
  await expect(previewAction).toBeDisabled();
  await page.keyboard.press("Escape");
  await assign(group.id);
  await page.reload();
  await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
  await expect(previewAction).toHaveAttribute("href", `/courses/${data.courseId}/groups/${group.id}/student-view/activities/${activityId}`);
  const [sectionPreview] = await Promise.all([page.waitForEvent("popup"), previewAction.click()]);
  try {
    await expect(page).toHaveURL(sectionPath);
    await expect(sectionPreview.getByLabel("Four", { exact: true })).not.toBeChecked();
    await expect(sectionPreview.getByText(new RegExp(group.title))).toBeVisible();
    expect(await records()).toEqual(before);
  } finally { await sectionPreview.close(); }

  const studentApi = await createAuthenticatedApi("student");
  try {
    const { course } = await responseJson<{ course: { activities: Array<{ groupAssignments?: unknown }> } }>(await studentApi.get(`/api/courses/${data.courseId}`));
    expect(course.activities.every((activity) => activity.groupAssignments === undefined)).toBe(true);
  } finally { await studentApi.dispose(); }
});
