import type { APIRequestContext, Page } from "@playwright/test";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { createBankActivityThroughUi, provisionActivitySuite, removeActivitySuite, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";

type Activity = { id: string; title: string; description: string; config: Record<string, unknown> };
let data: ActivitySuiteData;
let api: APIRequestContext;

test.beforeAll(async () => {
  data = await provisionActivitySuite();
  api = await createAuthenticatedApi("teacher");
});

test.afterAll(async () => {
  await api?.dispose();
  await removeActivitySuite(data);
});

const types = [
  { key: "coding-exercise", category: "Programming", name: "Coding exercise" },
  { key: "parsons-problem", category: "Programming", name: "Parsons problem" },
  { key: "web-design-coding-exercise", category: "Programming", name: "Web design coding exercise" },
  { key: "coding-homework-grader", category: "Programming", name: "Programming Homework" },
  { key: "mcq", category: "Generic Activity", name: /Mult.*choice questions/ },
  { key: "test", category: "Generic Activity", name: "Test" }
] as const;

function expectEmptyContent(activity: Activity, key: string) {
  expect(activity.description).toBe("");
  if (key === "mcq") {
    expect(activity.config.source).toEqual(expect.stringContaining("##"));
    expect(activity.config.source).toEqual(expect.stringContaining("- [x]"));
    expect(activity.config.source).toEqual(expect.stringContaining("- [ ]"));
  } else if (key === "coding-exercise") {
    expect(activity.config).toMatchObject({ prompt: "", starterCode: "", sampleTests: [] });
  } else if (key === "parsons-problem") {
    expect(activity.config).toMatchObject({ prompt: "", solution: "", groups: [], precedenceRules: [] });
  } else if (key === "web-design-coding-exercise") {
    expect(activity.config.prompt).toBe("");
    const files = activity.config.files as Array<{ path: string; starterCode: string }>;
    expect(files.map(file => file.path)).toEqual(["index.html", "styles.css", "script.js"]);
    expect(files.every(file => file.starterCode === "")).toBe(true);
  }
}

for (const type of types) {
  test(`new bank ${type.key} has empty content except the MCQ syntax example`, async ({ teacherPage: page }) => {
    const id = await createBankActivityThroughUi(page, data, { category: type.category, typeName: type.name });
    const endpoint = `/api/activity-banks/${data.activityBankId}/activities/${id}`;
    const { activity } = await responseJson<{ activity: Activity }>(await api.get(endpoint));
    expectEmptyContent(activity, type.key);
    await page.reload();
    await expect(page.getByRole("heading", { name: activity.title, level: 1, exact: true })).toBeVisible();
    const reloaded = await responseJson<{ activity: Activity }>(await api.get(endpoint));
    expect(reloaded.activity.config).toEqual(activity.config);
    if (type.key === "coding-exercise") {
      const privateData = await responseJson<{ tests: unknown[]; referenceSolution: unknown }>(await api.get(`${endpoint}/coding-exercises/hidden-tests`));
      expect(privateData.tests).toEqual([]);
      expect(privateData.referenceSolution).toBeNull();
      await page.getByRole("tab", { name: "Grading", exact: true }).click();
      await page.getByRole("tab", { name: "Test cases", exact: true }).click();
      await expect(page.getByRole("button", { name: /^sample-\d+$/ })).toHaveCount(0);
    }
  });
}

async function chooseCourseActivity(page: Page, category: string, name: RegExp) {
  await page.goto(`/courses/${data.courseId}?tab=content`);
  await page.getByRole("button", { name: "Content tree actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "New activity", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Choose course element" });
  await picker.getByRole("tab", { name: category, exact: true }).click();
  await picker.getByRole("button", { name }).click();
  await expect(page).toHaveURL(new RegExp(`/courses/${data.courseId}/activities/[^/?#]+$`));
  return page.url().split("/").at(-1)!;
}

test("new course activities also start without sample descriptions or Parsons content", async ({ teacherPage: page }) => {
  const id = await chooseCourseActivity(page, "Programming", /^Parsons problem/);
  const { activity } = await responseJson<{ activity: Activity }>(await api.get(`/api/courses/${data.courseId}/activities/${id}`));
  expectEmptyContent(activity, "parsons-problem");
});

for (const scope of ["course", "bank"] as const) {
  test(`new ${scope} Test children start without the programming sample test`, async ({ teacherPage: page }) => {
    const id = scope === "course"
      ? await chooseCourseActivity(page, "Generic Activity", /^Test/)
      : await createBankActivityThroughUi(page, data, { category: "Generic Activity", typeName: "Test" });
    const endpoint = scope === "course"
      ? `/api/courses/${data.courseId}/activities/${id}`
      : `/api/activity-banks/${data.activityBankId}/activities/${id}`;
    const parent = await responseJson<{ activity: Activity }>(await api.get(endpoint));
    expect(parent.activity.description).toBe("");
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Add activity to Test" });
    await picker.getByRole("tab", { name: "Programming", exact: true }).click();
    const response = page.waitForResponse(result => result.request().method() === "POST" && result.url().endsWith(`${endpoint}/test/items`));
    await picker.getByRole("button", { name: /^Coding exercise/ }).click();
    const { item } = await responseJson<{ item: { activity: Activity } }>(await response);
    expectEmptyContent(item.activity, "coding-exercise");
    await expect(picker).toBeHidden();
  });
}
