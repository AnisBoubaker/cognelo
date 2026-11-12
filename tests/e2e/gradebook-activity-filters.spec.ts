import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";

test("course Gradebook shows summative work and combines activity text, concept and section filters", async ({ bankCourse: data, teacherApi, teacherPage: page }, testInfo) => {
  test.setTimeout(90_000);
  const base = `/api/courses/${data.courseId}`;
  const concepts: Record<string, string> = {};
  for (const title of ["Loops", "Conditions", "Practice only"]) {
    const { concept } = await responseJson<{ concept: { id: string } }>(await teacherApi.post(`/api/subjects/${data.subjectId}/concepts`, {
      data: { title, skills: `Understand ${title}` }
    }));
    concepts[title] = concept.id;
  }
  const target = (conceptId: string) => [{ conceptId, selectsAllSkills: true, selectedSkills: [], selectedSkillIds: [] }];
  await responseJson(await teacherApi.patch(data.courseActivityPath, {
    data: { description: "Loops repetition marker", knowledgeConceptSelections: target(concepts.Loops) }
  }));
  const created: Array<{ id: string; title: string; mode: string }> = [];
  for (const [title, description, mode, conceptId] of [
    ["Decision checkpoint", "Loops branching marker", "summative", concepts.Conditions],
    ["Loops practice", "Loops practice marker", "formative", concepts["Practice only"]],
    ["Guided loops practice", "Loops guided marker", "formative_ai", concepts["Practice only"]]
  ] as const) {
    const id = await createCourseActivity(data, { activityTypeKey: "mcq", title, config: { source: ORIGINAL_SOURCE, randomizeChoices: false } });
    await responseJson(await teacherApi.patch(`${base}/activities/${id}`, { data: { description, knowledgeConceptSelections: target(conceptId) } }));
    await responseJson(await teacherApi.post(`${base}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: mode } } }));
    created.push({ id, title, mode });
  }
  const { group } = await responseJson<{ group: { id: string } }>(await teacherApi.post(`${base}/groups`, { data: { title: "Practice section" } }));
  await responseJson(await teacherApi.post(`${base}/groups/${group.id}/activities`, { data: { activityId: data.activityId, metadata: { assessmentMode: "formative" } } }));
  const { gradebook: summary } = await responseJson<{ gradebook: {
    activitySummaries: Array<{ activityId: string; groups: Array<{ groupId: string }> }>
  } }>(await teacherApi.get(`${base}/gradebook?view=summary`));
  expect(summary.activitySummaries).toHaveLength(2);
  expect(summary.activitySummaries.every(activity => activity.groups.every(item => item.groupId === data.groupId))).toBe(true);

  await page.goto(`/courses/${data.courseId}?tab=gradebook`);
  const panel = page.getByRole("tabpanel", { name: "Gradebook", exact: true });
  const search = panel.getByRole("searchbox", { name: "Search activities", exact: true });
  const concept = panel.getByLabel("Targeted concept", { exact: true });
  const groupFilter = panel.getByLabel("Group", { exact: true });
  const activityOptions = panel.getByLabel("Activity", { exact: true }).locator("option");
  const loops = panel.getByRole("link", { name: data.title, exact: true });
  const decisions = panel.getByRole("link", { name: "Decision checkpoint", exact: true });
  await expect(loops).toBeVisible(); await expect(decisions).toBeVisible();
  await expect(activityOptions).toHaveCount(3);
  await expect(concept.locator("option")).toHaveText(["All concepts", "Conditions", "Loops"]);
  for (const activity of created.filter(activity => activity.mode !== "summative")) {
    await expect(panel.getByRole("link", { name: activity.title, exact: true })).toHaveCount(0);
  }
  await search.fill("  BRANCHING marker  ");
  await expect(loops).toHaveCount(0); await expect(decisions).toBeVisible();
  const csvHref = await panel.getByRole("link", { name: "Export CSV", exact: true }).getAttribute("href");
  const csv = await (await teacherApi.get(csvHref!)).text();
  expect(csv).toContain("Decision checkpoint"); expect(csv).not.toContain(data.title); expect(csv).not.toContain("Loops practice");
  await search.fill(data.title.toUpperCase());
  await expect(loops).toBeVisible(); await expect(decisions).toHaveCount(0);
  await search.fill("LOOPS");
  await expect(decisions).toBeVisible();
  await concept.selectOption(concepts.Loops);
  await expect(loops).toBeVisible(); await expect(decisions).toHaveCount(0);
  await groupFilter.selectOption(group.id);
  await expect(loops).toHaveCount(0);
  await expect(concept).toHaveValue(concepts.Loops);
  await expect(concept.locator("option:checked")).toHaveText("Loops");
  await groupFilter.selectOption("");
  await expect(loops).toBeVisible();
  await concept.selectOption("");
  await search.fill("nothing-matches-this-title");
  await expect(loops).toHaveCount(0); await expect(decisions).toHaveCount(0);
  await expect(concept.locator("option")).toHaveCount(3);
  await expect(panel.locator(".gradebook-compact-stat strong").first()).toHaveText("0");
  await search.fill("");
  await expect(loops).toBeVisible(); await expect(decisions).toBeVisible();
  await panel.screenshot({ path: testInfo.outputPath("course-gradebook-filters.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(search).toBeVisible(); await expect(concept).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await panel.screenshot({ path: testInfo.outputPath("course-gradebook-filters-mobile.png") });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  const practice = created.find(activity => activity.mode === "formative")!;
  await page.getByRole("tabpanel", { name: "Content", exact: true }).getByRole("link", { name: practice.title, exact: true }).click();
  await expect(page.getByRole("tab", { name: "Class overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Student results", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Student results", exact: true })).toHaveAttribute("aria-selected", "true");
});
