import { test, expect } from "./fixtures/bank-course";
import { responseJson } from "./fixtures/activity-suite";

test("assignment sections sort naturally and gradebook groups stay selectable after filtering", async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(90_000); page.setDefaultTimeout(10_000);
  const course = `/api/courses/${data.courseId}`;
  await responseJson(await teacherApi.patch(`${course}/groups/${data.groupId}`, { data: { title: "Gr01" } }));
  const groups: Array<{ id: string; title: string }> = [{ id: data.groupId, title: "Gr01" }];
  for (const title of ["Gr10", "Gr2", "GrTest"]) {
    const { group } = await responseJson<{ group: { id: string; title: string } }>(await teacherApi.post(`${course}/groups`, { data: { title } }));
    groups.push(group);
    if (title !== "GrTest") await responseJson(await teacherApi.post(`${course}/groups/${group.id}/activities`, { data: { activityId: data.activityId, metadata: { assessmentMode: "summative" } } }));
  }
  const titles = ["Gr01", "Gr2", "Gr10", "GrTest"];
  await page.goto(`/courses/${data.courseId}?tab=content`);
  await page.getByRole("button", { name: `Actions for ${data.title}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: data.title, exact: true });
  await dialog.getByRole("tab", { name: "Group assignment", exact: true }).click();
  const tabs = dialog.getByRole("tablist", { name: "Course groups", exact: true });
  await expect(tabs.getByRole("tab")).toHaveText(titles);
  await expect(tabs.getByRole("tab", { name: "Gr01", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("checkbox", { name: "Assigned", exact: true })).toBeChecked();
  await tabs.getByRole("tab", { name: "GrTest", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "Assigned", exact: true })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

  // Open directly with a selected group: choices must not depend on first loading All groups.
  await page.goto(`/courses/${data.courseId}?tab=gradebook&groupId=${data.groupId}`);
  const selector = page.locator("#gradebook-group-filter");
  await expect(selector).toHaveValue(data.groupId);
  await expect(selector.locator("option")).toHaveText(["All groups", ...titles]);
  for (const title of ["Gr10", "Gr2", "GrTest", "Gr01"]) {
    const groupId = groups.find(group => group.title === title)!.id;
    const response = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === `${course}/gradebook` && url.searchParams.get("view") === "summary" && url.searchParams.get("groupId") === groupId && response.ok();
    });
    await selector.selectOption(groupId);
    const { gradebook } = await (await response).json() as { gradebook: { groups: Array<{ id: string }>; activitySummaries: Array<{ groups: Array<{ groupId: string }> }> } };
    expect(gradebook.groups.map(group => group.id).sort()).toEqual(groups.map(group => group.id).sort());
    expect(gradebook.activitySummaries.every(activity => activity.groups.every(group => group.groupId === groupId))).toBe(true);
    if (title === "GrTest") expect(gradebook.activitySummaries).toEqual([]);
    await expect(selector).toHaveValue(groupId);
    await expect(selector.locator("option")).toHaveText(["All groups", ...titles]);
  }
  const statusResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === `${course}/gradebook` && url.searchParams.get("view") === "summary" && url.searchParams.get("status") === "graded" && response.ok();
  });
  await page.locator("#gradebook-status-filter").selectOption("graded"); await statusResponse;
  await expect(selector.locator("option")).toHaveText(["All groups", ...titles]);
});
