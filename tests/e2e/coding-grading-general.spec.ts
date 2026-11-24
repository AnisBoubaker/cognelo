import { prisma } from "@cognelo/db";
import type { Page } from "@playwright/test";
import { expect, test, createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";

const source = "print(int(input()) * 2)";
const baseConfig = { language: "python", prompt: "Read an integer and print twice its value.", starterCode: "",
  sampleTests: [{ id: "visible", title: "Double two", input: "2", output: "4" }] };
const hidden = [{ id: "hidden", name: "Double three", stdin: "3", expectedOutput: "6", isEnabled: true, weight: 1 }];

async function setSource(page: Page, title: string, value: string) {
  await expect(page.getByRole("textbox", { name: title, exact: true })).toBeVisible();
  await page.evaluate(code => {
    const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco;
    const model = monaco?.editor.getModels().find(model => model.uri.toString().includes("coding-exercise-student"));
    if (!model) throw new Error("Student editor was not ready.");
    model.setValue(code);
  }, value);
}

test("General grading settings, confirmed runs, concurrent limits, new attempts and reopening", async ({ teacherPage, studentPage: page }, testInfo) => {
  test.setTimeout(150_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const title = `Grading general ${data.token}`;
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title, config: baseConfig });
    const author = `/api/courses/${data.courseId}/activities/${activityId}`;
    await responseJson(await teacher.put(`${author}/coding-exercises/hidden-tests`, { data: { tests: hidden, sampleTests: baseConfig.sampleTests,
      referenceSolution: source, privateConfig: { templateSource: "{{ STUDENT_CODE }}" } } }));
    await teacherPage.goto(author.replace("/api", ""));
    await teacherPage.getByRole("tab", { name: "Grading", exact: true }).click();
    const general = teacherPage.getByRole("tab", { name: "General", exact: true });
    await expect(general).toHaveAttribute("aria-selected", "true");
    await general.focus(); await teacherPage.keyboard.press("End");
    await expect(teacherPage.getByRole("tab", { name: "Test cases", exact: true })).toHaveAttribute("aria-selected", "true");
    await teacherPage.keyboard.press("Home");
    await expect(general).toHaveAttribute("aria-selected", "true");
    await expect(teacherPage.getByRole("switch", { name: "Enable tests", exact: true })).toBeChecked();
    await expect(teacherPage.getByLabel("Test-run allowance", { exact: true })).toHaveValue("unlimited");
    await teacherPage.getByRole("switch", { name: "Enable rubric", exact: true }).check();
    await teacherPage.getByLabel("Rubric (%)", { exact: true }).fill("30");
    await expect(teacherPage.getByLabel("Deterministic tests (%)", { exact: true })).toHaveValue("70");
    await teacherPage.getByRole("switch", { name: "Enable tests", exact: true }).uncheck();
    await expect(teacherPage.getByLabel("Rubric (%)", { exact: true })).toHaveValue("100");
    await expect(teacherPage.getByRole("tab", { name: "Test cases", exact: true })).toBeHidden();
    await teacherPage.getByRole("switch", { name: "Enable tests", exact: true }).check();
    await teacherPage.getByRole("switch", { name: "Enable rubric", exact: true }).uncheck();
    await expect(teacherPage.getByLabel("Deterministic tests (%)", { exact: true })).toHaveValue("100");
    await teacherPage.getByLabel("Test-run allowance", { exact: true }).selectOption("limited");
    await teacherPage.getByLabel("Maximum test runs per attempt", { exact: true }).fill("2");
    await teacherPage.getByRole("button", { name: "Save coding exercise", exact: true }).click();
    await expect(teacherPage.getByText("Coding exercise saved.", { exact: true })).toBeVisible();
    await teacherPage.reload();
    await teacherPage.getByRole("tab", { name: "Grading", exact: true }).click();
    await expect(teacherPage.getByLabel("Maximum test runs per attempt", { exact: true })).toHaveValue("2");
    await teacherPage.screenshot({ path: testInfo.outputPath("grading-general.png"), fullPage: true });
    await teacherPage.setViewportSize({ width: 390, height: 844 });
    expect(await teacherPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const feedbackSwitch = teacherPage.getByRole("switch", { name: "Enable AI feedback", exact: true });
    await feedbackSwitch.check();
    await expect(teacherPage.getByLabel("Feedback instructions", { exact: true })).toBeVisible();
    await feedbackSwitch.uncheck();
    await teacherPage.locator("#coding-exercise-grading-panel").evaluate(element => element.scrollIntoView({ block: "start" }));
    await teacherPage.screenshot({ path: testInfo.outputPath("grading-general-mobile.png") });
    await assignCourseTest(data, activityId, title, 2);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    await page.goto(assigned.replace("/api", ""));
    await setSource(page, title, source);
    await expect(page.getByText("2 of 2 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Run this test?", exact: true });
    await expect(confirm).toContainText("leaving 1");
    await page.screenshot({ path: testInfo.outputPath("finite-run-confirmation.png") });
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("2 of 2 test runs remaining", { exact: true })).toBeVisible();
    const noRun = await responseJson<{ practiceRuns: { used: number } }>(await student.get(`${assigned}/coding-exercises/run`));
    expect(noRun.practiceRuns.used).toBe(0);
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    await confirm.getByRole("button", { name: "Run test", exact: true }).click();
    await expect(page.getByLabel("Test output", { exact: true })).toContainText("4", { timeout: 60_000 });
    await expect(page.getByText("1 of 2 test runs remaining", { exact: true })).toBeVisible();
    const requests = await Promise.all([1, 2].map(() => student.post(`${assigned}/coding-exercises/run`, { data: {
      sourceCode: source, stdin: "2", expectedOutput: "4", practiceScope: "forged-reset" } })));
    expect(requests.map(response => response.status()).sort()).toEqual([200, 409]);
    const rejected = await requests.find(response => response.status() === 409)!.json();
    expect(rejected.error.code).toBe("CODING_EXERCISE_RUN_LIMIT_REACHED");
    await page.reload();
    await expect(page.getByText("0 of 2 test runs remaining", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run test", exact: true })).toBeDisabled();
    // Final grading is not a practice run and still evaluates the hidden suite.
    await responseJson(await student.post(`${assigned}/coding-exercises/submit`, { data: { sourceCode: source } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } });
    const grade = await prisma.grade.findFirstOrThrow({ where: { selectedAttemptId: attempt.id } });
    expect(grade.rawScore).toBe(1);
    const fresh = await responseJson<{ practiceRuns: { used: number; remaining: number } }>(await student.get(`${assigned}/coding-exercises/run`));
    expect(fresh.practiceRuns).toMatchObject({ used: 0, remaining: 2 });
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/reopen`, { data: {} }));
    await page.goto(assigned.replace("/api", ""));
    await expect(page.getByText("0 of 2 test runs remaining", { exact: true })).toBeVisible();
    const blocked = await student.post(`${assigned}/coding-exercises/run`, { data: { sourceCode: source, compareOutput: false } });
    expect(blocked.status()).toBe(409);
    expect((await blocked.json()).error.code).toBe("CODING_EXERCISE_RUN_LIMIT_REACHED");
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("blanks default to no visible runner and no direct execution, but submission still grades", async ({ teacherPage, studentPage: page }) => {
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const title = `No practice ${data.token}`, blankTemplate = "print({{ BLANK:value }})";
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title, config: {
      language: "python", prompt: "Complete the code to print one.", responseMode: "blanks", blankTemplate
    } });
    const author = `/api/courses/${data.courseId}/activities/${activityId}`;
    await responseJson(await teacher.put(`${author}/coding-exercises/hidden-tests`, { data: {
      tests: [{ id: "one", name: "One", stdin: "", expectedOutput: "1", isEnabled: true, weight: 1 }],
      referenceSolution: "print(1)", privateConfig: { templateSource: "{{ STUDENT_CODE }}", blankReferenceAnswers: { value: "1" } }
    } }));
    await teacherPage.goto(author.replace("/api", ""));
    await teacherPage.getByRole("tab", { name: "Grading", exact: true }).click();
    await expect(teacherPage.getByLabel("Maximum test runs per attempt", { exact: true })).toHaveValue("0");
    await assignCourseTest(data, activityId, title);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    await page.goto(assigned.replace("/api", ""));
    await expect(page.getByRole("textbox", { name: "Blank 1", exact: true })).toBeVisible();
    await expect(page.locator(".coding-exercise-test-runner")).toHaveCount(0);
    await expect(page.locator(".coding-exercise-workspace-divider")).toHaveCount(0);
    const input = { sourceCode: "forged", blankTemplate, blankAnswers: { value: "1" } };
    const forbidden = await student.post(`${assigned}/coding-exercises/run`, { data: input });
    expect(forbidden.status()).toBe(403);
    expect((await forbidden.json()).error.code).toBe("CODING_EXERCISE_RUN_DISABLED");
    await page.getByRole("textbox", { name: "Blank 1", exact: true }).fill("1");
    await page.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect.poll(() => prisma.grade.count({ where: { gradebookItem: { activityId } } })).toBe(1);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("tests disabled retain cases, skip execution and permit a rubric-only manual grade", async ({ studentPage: page }) => {
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const title = `Rubric only ${data.token}`;
    const config = { language: "python", prompt: "Print one clearly.", testsEnabled: false };
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title, config });
    const privatePath = `/api/courses/${data.courseId}/activities/${activityId}/coding-exercises/hidden-tests`;
    const tests = [{ id: "retained", name: "Retained", stdin: "", expectedOutput: "2", weight: 1, isEnabled: true }];
    const feedback = { enabled: false, gradingEnabled: true, testsEnabled: false, testWeightPercent: 0, aiWeightPercent: 100,
      criteria: [{ id: "clarity", title: "Clarity", description: "Assess the clarity of the code.", weightPercent: 100 }] };
    await responseJson(await teacher.put(privatePath, { data: { tests, referenceSolution: "print(1)", privateConfig: { templateSource: "{{ STUDENT_CODE }}", aiFeedback: feedback } } }));
    await assignCourseTest(data, activityId, title);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    await page.goto(assigned.replace("/api", ""));
    await expect(page.locator(".coding-exercise-test-runner")).toHaveCount(0);
    await responseJson(await student.post(`${assigned}/coding-exercises/submit`, { data: { sourceCode: "print(1)" } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } });
    const [execution] = await prisma.$queryRaw<Array<{ judge0Token: string | null; resultSummary: { totalWeight: number } }>>`
      SELECT "judge0Token","resultSummary" FROM "PluginCodingExerciseExecution" WHERE id=${attempt.pluginAttemptRef}`;
    expect(execution.judge0Token).toBeNull();
    expect(execution.resultSummary.totalWeight).toBe(0);
    const reviewPath = `/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/ai-feedback`;
    const { review } = await responseJson<{ review: { feedbackHash: string | null; feedback: { summary: string; strengths: string[]; improvements: string[]; criteria: Array<{ id: string; scorePercent: number; feedback: string }> } } }>(await teacher.get(reviewPath));
    await responseJson(await teacher.patch(reviewPath, { data: { expectedFeedbackHash: review.feedbackHash ?? null, feedback: {
      summary: "Clear code.", strengths: [], improvements: [], criteria: review.feedback.criteria.map(criterion => ({ id: criterion.id, scorePercent: 90, feedback: "Clear solution." }))
    } } }));
    expect((await prisma.grade.findFirstOrThrow({ where: { selectedAttemptId: attempt.id } })).rawScore).toBe(90);
    const retained = await responseJson<{ tests: unknown[] }>(await teacher.get(privatePath));
    expect(retained.tests).toHaveLength(1);
    // Re-enabling requires reference validation again; the retained nonpassing case is rejected.
    const invalid = await teacher.put(privatePath, { data: { tests, referenceSolution: "print(1)", validateOnly: true,
      activityConfig: { ...config, testsEnabled: true }, privateConfig: { templateSource: "{{ STUDENT_CODE }}", aiFeedback: { ...feedback, testsEnabled: true, testWeightPercent: 60, aiWeightPercent: 40 } } } });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).error.code).toBe("REFERENCE_SOLUTION_VALIDATION_FAILED");
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("Test questions keep independent run allowances across reload and reset for a new sitting", async ({ studentPage: page }) => {
  test.setTimeout(150_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const title = `Test run budget ${data.token}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacher.post(`/api/courses/${data.courseId}/tests`, {
      data: { title, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true } }
    }));
    const activityId = created.activity.id;
    const children: Array<{ id: string; activityId: string }> = [];
    for (const number of [1, 2]) {
      const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacher.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
        source: "local", activityTypeKey: "coding-exercise", title: `Complete ${number}`, pointsPossible: 10,
        config: { language: "python", prompt: `Print the number ${number}.`, responseMode: "blanks", blankTemplate: "print({{ BLANK:value }})", maxTestRuns: 1,
          sampleTests: [{ id: "visible", input: "", output: String(number), title: "Print the number" }] }
      } }));
      children.push(item);
      await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`, { data: {
        tests: [{ id: "hidden", name: "Number", stdin: "", expectedOutput: String(number), isEnabled: true, weight: 1 }],
        referenceSolution: `print(${number})`, privateConfig: { templateSource: "{{ STUDENT_CODE }}", blankReferenceAnswers: { value: String(number) } }
      } }));
    }
    await assignCourseTest(data, activityId, title, 2);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    let firstRunBody: Record<string, unknown> = {}, latestAllowanceBody: Record<string, unknown> = {};
    page.on("request", request => {
      if (request.method() !== "POST") return;
      if (request.url().endsWith(`/test/items/${children[0].id}/actions/run`)) firstRunBody = request.postDataJSON();
      if (request.url().endsWith(`/test/items/${children[0].id}/actions/practiceRunAllowance`)) latestAllowanceBody = request.postDataJSON();
    });
    await page.goto(assigned.replace("/api", ""));
    await page.getByRole("button", { name: "Start Test", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Start Test", exact: true }).click();
    await page.getByRole("textbox", { name: "Blank 1", exact: true }).fill("1");
    await expect(page.getByText("1 of 1 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    await page.getByRole("dialog", { name: "Run this test?", exact: true }).getByRole("button", { name: "Run test", exact: true }).click();
    await expect(page.getByText("0 of 1 test runs remaining", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("0 of 1 test runs remaining", { exact: true })).toBeVisible();
    expect(Object.keys(firstRunBody).length).toBeGreaterThan(0);
    const blocked = await student.post(`${assigned}/test/items/${children[0].id}/actions/run`, { data: {
      ...firstRunBody, ...latestAllowanceBody, payload: firstRunBody.payload
    } });
    expect(blocked.status()).toBe(409);
    expect((await blocked.json()).error.code).toBe("CODING_EXERCISE_RUN_LIMIT_REACHED");
    await page.getByRole("button", { name: "Next activity", exact: true }).click();
    await page.getByRole("textbox", { name: "Blank 1", exact: true }).fill("2");
    await expect(page.getByText("1 of 1 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    await page.getByRole("dialog", { name: "Run this test?", exact: true }).getByRole("button", { name: "Run test", exact: true }).click();
    await expect(page.getByText("0 of 1 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Submit the test", exact: true }).click();
    await page.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${data.groupId}$`));
    await page.goto(assigned.replace("/api", ""));
    const newAttempt = page.getByRole("tab", { name: "New attempt", exact: true });
    if (await newAttempt.isVisible()) await newAttempt.click();
    await page.getByRole("button", { name: "Start Test", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Start Test", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Blank 1", exact: true })).toHaveValue("");
    await expect(page.getByText("1 of 1 test runs remaining", { exact: true })).toBeVisible();
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});
