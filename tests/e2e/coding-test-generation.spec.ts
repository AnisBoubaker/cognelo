import { createAuthenticatedApi, expect, test as base } from "./fixtures/auth";
import { provisionActivitySuite, removeActivitySuite, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";

const test = base.extend<{ generationData: ActivitySuiteData }>({
  generationData: async ({}, provide) => {
    const data = await provisionActivitySuite();
    try { await provide(data); }
    finally { await removeActivitySuite(data); }
  }
});

for (const mode of ["add", "replace"] as const) {
  test(`${mode} generated tests with zero visible or zero hidden tests`, async ({ teacherPage: page, generationData: data }) => {
    test.setTimeout(120_000);
    page.setDefaultTimeout(15_000);
    const api = await createAuthenticatedApi("teacher");
    try {
      const originalSample = {
        id: "sample-original", title: "Original visible", input: "1", output: "1", testCode: "",
        outputMatchMode: "exact", containsLinesOrderMatters: true
      };
      const originalHidden = {
        id: "hidden-original", name: "Original hidden", stdin: "2", expectedOutput: "2", testCode: "",
        outputMatchMode: "exact", containsLinesOrderMatters: true, weight: 7, isEnabled: true
      };
      const config = {
        prompt: "Read one number and print it unchanged.", language: "python", executionMode: "template",
        starterCode: "", studentTemplateSource: "{{ STUDENT_CODE }}", sampleTests: [originalSample], maxEditorSeconds: 1800
      };
      const { activity } = await responseJson<{ activity: { id: string } }>(await api.post(`/api/activity-banks/${data.activityBankId}/activities`, {
        data: { activityTypeKey: "coding-exercise", title: `${mode} generated tests`, config }
      }));
      const path = `/api/activity-banks/${data.activityBankId}/activities/${activity.id}`;
      await responseJson(await api.put(`${path}/coding-exercises/hidden-tests`, { data: {
        tests: [originalHidden], sampleTests: [originalSample], referenceSolution: "print(input())", privateConfig: { templateSource: "{{ STUDENT_CODE }}" }
      } }));
      const noTests = await api.post(`${path}/coding-exercises/generate-tests`, { data: {
        prompt: config.prompt, language: "python", referenceSolution: "print(input())", templateSource: "{{ STUDENT_CODE }}",
        visibleTestCount: 0, hiddenTestCount: 0
      } });
      expect(noTests.status()).toBe(400);
      await page.route("**/api/ai-agents", (route) => route.fulfill({ json: {
        connections: [{ id: "generation-check", isEnabled: true }],
        preferences: { questionAuthoringAiAgentConnectionId: "generation-check" }
      } }));
      const requests: Array<{ visibleTestCount: number; hiddenTestCount: number }> = [];
      const suppliedSuites: Array<{ sampleTests: typeof originalSample[]; hiddenTests: typeof originalHidden[] } | undefined> = [];
      await page.route(`**${path}/coding-exercises/generate-tests`, (route) => {
        const request = route.request().postDataJSON();
        requests.push({ visibleTestCount: request.visibleTestCount, hiddenTestCount: request.hiddenTestCount });
        suppliedSuites.push(request.existingTests);
        return route.fulfill({ json: {
          status: "ok", attempts: 1,
          // Reuse existing IDs deliberately to check that Add cannot overwrite them.
          sampleTests: request.visibleTestCount ? [{ ...originalSample, title: "Generated visible", input: "3", output: "3", outputMatchMode: "contains_lines" }] : [],
          hiddenTests: request.hiddenTestCount ? [{ ...originalHidden, name: "Generated hidden", stdin: "4", expectedOutput: "4", weight: 1, outputMatchMode: "contains_lines" }] : [],
          validationSummary: { accepted: true }
        } });
      });
      await page.goto(`/activity-banks/${data.activityBankId}/activities/${activity.id}`);
      await page.getByRole("tab", { name: "Grading", exact: true }).click();
      await page.getByRole("tab", { name: "Test cases", exact: true }).click();
      const counts = page.getByRole("dialog", { name: "Generate test cases", exact: true });
      const readSuite = async () => {
        const publicData = await responseJson<{ activity: { config: { sampleTests: typeof originalSample[] } } }>(await api.get(path));
        const privateData = await responseJson<{ tests: typeof originalHidden[] }>(await api.get(`${path}/coding-exercises/hidden-tests`));
        return { sampleTests: publicData.activity.config.sampleTests, hiddenTests: privateData.tests };
      };
      for (const kind of ["hidden", "visible"] as const) {
        const before = await readSuite();
        await page.getByRole("button", { name: "Generate test cases automatically", exact: true }).click();
        await expect(counts.getByLabel("Existing tests", { exact: true })).toHaveValue("add");
        await counts.getByLabel("Existing tests", { exact: true }).selectOption(mode);
        await counts.getByLabel("Visible tests", { exact: true }).fill("0");
        await counts.getByLabel("Hidden tests", { exact: true }).fill("0");
        const generate = counts.getByRole("button", { name: "Generate tests", exact: true });
        await expect(generate).toBeDisabled();
        await counts.getByLabel("Visible tests", { exact: true }).fill("15");
        if (mode === "add") await expect(generate).toBeDisabled();
        else await expect(generate).toBeEnabled();
        await counts.getByLabel("Visible tests", { exact: true }).fill(kind === "visible" ? "1" : "0");
        await counts.getByLabel("Hidden tests", { exact: true }).fill(kind === "hidden" ? "1" : "0");
        await expect(generate).toBeEnabled();
        await generate.click();
        await expect(page.getByRole("button", { name: kind === "hidden" ? /Generated hidden/ : /Generated visible/ })).toBeVisible();
        if (mode === "add") {
          expect(suppliedSuites.at(-1)?.sampleTests).toEqual(before.sampleTests);
          expect(suppliedSuites.at(-1)?.hiddenTests).toMatchObject(before.hiddenTests.map(({ id, name, stdin, expectedOutput, testCode, outputMatchMode, containsLinesOrderMatters, weight, isEnabled }) => ({
            id, name, stdin, expectedOutput, testCode, outputMatchMode, containsLinesOrderMatters, weight, isEnabled
          })));
        } else {
          expect(suppliedSuites.at(-1)).toBeUndefined();
        }
        expect(await readSuite()).toEqual(before); // Generation remains an unsaved draft.
        await page.getByRole("button", { name: "Save coding exercise", exact: true }).click();
        await expect(async () => {
          const saved = await readSuite();
          expect(saved.sampleTests.map((item) => item.title)).toEqual(mode === "add"
            ? ["Original visible", ...(kind === "visible" ? ["Generated visible"] : [])]
            : kind === "visible" ? ["Generated visible"] : []);
          expect(saved.hiddenTests.map((item) => item.name)).toEqual(mode === "add"
            ? ["Original hidden", "Generated hidden"]
            : kind === "hidden" ? ["Generated hidden"] : []);
        }).toPass({ timeout: 15_000 });
        const saved = await readSuite();
        if (mode === "add") {
          expect(saved.sampleTests[0]).toMatchObject(originalSample);
          expect(saved.hiddenTests[0]).toMatchObject(originalHidden);
        }
        const ids = [...saved.sampleTests, ...saved.hiddenTests].map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
      expect(requests).toEqual([{ visibleTestCount: 0, hiddenTestCount: 1 }, { visibleTestCount: 1, hiddenTestCount: 0 }]);
      await page.reload();
      await page.getByRole("tab", { name: "Grading", exact: true }).click();
      await page.getByRole("tab", { name: "Test cases", exact: true }).click();
      await expect(page.getByRole("button", { name: /Generated visible/ })).toBeVisible();
      if (mode === "add") await expect(page.getByRole("button", { name: /Generated hidden/ })).toBeVisible();
      else await expect(page.getByRole("button", { name: /Generated hidden/ })).toBeHidden();
    } finally {
      await api.dispose();
    }
  });
}

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
    await counts.getByLabel("Existing tests", { exact: true }).selectOption("replace");
    await counts.getByRole("button", { name: "Generate tests", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No generated test could be validated." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Echo one/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Echo two/ })).toBeVisible();
  } finally {
    await api.dispose();
  }
});
