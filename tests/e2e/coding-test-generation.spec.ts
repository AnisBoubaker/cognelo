import { createAuthenticatedApi, expect, test as base } from "./fixtures/auth";
import { provisionActivitySuite, removeActivitySuite, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";

const test = base.extend<{ generationData: ActivitySuiteData }>({
  generationData: async ({}, provide) => {
    const data = await provisionActivitySuite();
    try { await provide(data); }
    finally { await removeActivitySuite(data); }
  }
});

test("keeps and saves partial generated programming tests, and preserves them on a later generation failure", async ({ teacherPage: page, generationData: data }) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const api = await createAuthenticatedApi("teacher");
  try {
    const config = {
      prompt: "Read one number and print it unchanged.", language: "python", executionMode: "template",
      starterCode: "", studentTemplateSource: "{{ STUDENT_CODE }}", sampleTests: [], maxEditorSeconds: 1800
    };
    const { activity } = await responseJson<{ activity: { id: string } }>(await api.post(`/api/activity-banks/${data.activityBankId}/activities`, {
      data: { activityTypeKey: "coding-exercise", title: "Partial test generation", config }
    }));
    const path = `/api/activity-banks/${data.activityBankId}/activities/${activity.id}`;
    await responseJson(await api.put(`${path}/coding-exercises/hidden-tests`, { data: {
      tests: [], sampleTests: [], referenceSolution: "print(input())", privateConfig: { templateSource: "{{ STUDENT_CODE }}" }
    } }));
    // Only model availability/output is simulated. Saving uses real reference validation and persistence.
    await page.route("**/api/ai-agents", (route) => route.fulfill({ json: {
      connections: [{ id: "generation-check", isEnabled: true }],
      preferences: { questionAuthoringAiAgentConnectionId: "generation-check" }
    } }));
    const sampleTest = { id: "sample-kept", title: "Echo one", input: "1", output: "1", testCode: "", outputMatchMode: "contains_lines", containsLinesOrderMatters: false };
    const hiddenTest = { id: "hidden-kept", name: "Echo two", stdin: "2", expectedOutput: "2", testCode: "", outputMatchMode: "contains_lines", containsLinesOrderMatters: false, weight: 1, isEnabled: true };
    let generations = 0;
    await page.route(`**${path}/coding-exercises/generate-tests`, (route) => {
      generations += 1;
      return generations === 1
        ? route.fulfill({ json: { status: "warning", attempts: 3, sampleTests: [sampleTest], hiddenTests: [hiddenTest], validationSummary: { accepted: true } } })
        : route.fulfill({ status: 422, json: { error: { code: "CODING_EXERCISE_TEST_GENERATION_INVALID", message: "No generated test could be validated." } } });
    });
    await page.goto(`/activity-banks/${data.activityBankId}/activities/${activity.id}`);
    await page.getByRole("tab", { name: "Grading", exact: true }).click();
    await page.getByRole("tab", { name: "Test cases", exact: true }).click();
    await page.getByRole("button", { name: "Generate test cases automatically", exact: true }).click();
    const counts = page.getByRole("dialog", { name: "Generate test cases", exact: true });
    await counts.getByLabel("Visible tests", { exact: true }).fill("2");
    await counts.getByLabel("Hidden tests", { exact: true }).fill("2");
    await counts.getByRole("button", { name: "Generate tests", exact: true }).click();
    const warning = page.getByRole("status").filter({ hasText: "Kept 1 of 2 visible tests and 1 of 2 hidden tests" });
    await expect(warning).toBeVisible();
    await expect(page.getByRole("button", { name: /Echo one/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Echo two/ })).toBeVisible();
    await expect(page.getByText("Test cases generated.", { exact: true })).toBeHidden();
    await warning.getByRole("button", { name: "Dismiss notification" }).click();
    await page.getByRole("button", { name: "Save coding exercise", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Coding exercise saved." })).toBeVisible();
    const saved = await responseJson<{ tests: Array<{ name: string }>; referenceSolution: { validationSummary: { accepted: boolean } } }>(await api.get(`${path}/coding-exercises/hidden-tests`));
    expect(saved.tests.map((item) => item.name)).toEqual(["Echo two"]);
    expect(saved.referenceSolution.validationSummary.accepted).toBe(true);
    const savedActivity = await responseJson<{ activity: { config: { sampleTests: Array<{ title: string }> } } }>(await api.get(path));
    expect(savedActivity.activity.config.sampleTests.map((item) => item.title)).toEqual(["Echo one"]);

    await page.getByRole("button", { name: "Generate test cases automatically", exact: true }).click();
    await page.getByRole("dialog", { name: "Replace existing test cases?" }).getByRole("button", { name: "Replace tests", exact: true }).click();
    await counts.getByRole("button", { name: "Generate tests", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No generated test could be validated." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Echo one/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Echo two/ })).toBeVisible();
  } finally {
    await api.dispose();
  }
});
