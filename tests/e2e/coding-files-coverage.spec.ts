import { prisma } from "@cognelo/db";
import { expect, test, createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";

const sampleTests = [2, 4].map((value, index) => ({ id: `sample-${index}`, title: `Triple ${value}`, input: String(value), output: String(value * 3), testCode: "" }));
const hiddenTests = [{ id: "hidden", name: "Triple five", stdin: "5", expectedOutput: "15", testCode: "", isEnabled: true, weight: 1 }];
const blankFiles = [
  { id: "main", name: "main.py", starterCode: "", blankTemplate: "from helper import triple\nprint(triple({{ BLANK:argument }}))", studentTemplateSource: "{{ STUDENT_CODE }}" },
  { id: "helper", name: "helper.py", starterCode: "", blankTemplate: "def triple(n):\n    return n * {{ BLANK:factor }}", studentTemplateSource: "{{ STUDENT_CODE }}" }
];
const answers = { argument: "int(input())", factor: "3" };
const referenceFiles = [
  { id: "main", name: "main.py", sourceCode: "from helper import triple\nprint(triple(int(input())))" },
  { id: "helper", name: "helper.py", sourceCode: "def triple(n):\n    return n * 3" }
];
const bundle = referenceFiles.map(file => `===== ${file.name} =====\n${file.sourceCode}`).join("\n\n");
const privateConfig = { templateSource: "{{ STUDENT_CODE }}", blankReferenceAnswers: answers,
  fileSources: Object.fromEntries(referenceFiles.map(file => [file.id, { referenceSolution: file.sourceCode, templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] }])) };

test("multi-file blanks share a single run allowance across public and personalized tests, file tabs, and reopening", async ({ studentPage: page }) => {
  test.setTimeout(150_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const title = `Shared file run allowance ${data.token}`;
    const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title,
      config: { language: "python", prompt: "Complete both files to triple each input.", responseMode: "blanks", files: blankFiles, sampleTests, maxTestRuns: 3 } });
    await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${id}/coding-exercises/hidden-tests`, { data: {
      tests: hiddenTests, sampleTests, referenceSolution: bundle, privateConfig
    } }));
    await assignCourseTest(data, id, title, 2);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    const submittedFiles = blankFiles.map(file => ({ ...file, sourceCode: "forged" }));
    const stale = await student.post(`${assigned}/coding-exercises/run`, { data: {
      sourceCode: "forged", files: submittedFiles.map(file => file.id === "helper" ? { ...file, blankTemplate: "stale" } : file), blankAnswers: answers
    } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.code).toBe("CODING_EXERCISE_BLANK_RESPONSE_INVALID");
    const unknown = await student.post(`${assigned}/coding-exercises/run`, { data: {
      sourceCode: "forged", files: [...submittedFiles, { id: "extra", name: "extra.py", sourceCode: "print(0)", blankTemplate: "" }], blankAnswers: answers
    } });
    expect(unknown.status()).toBe(409);
    expect((await unknown.json()).error.code).toBe("CODING_EXERCISE_FILES_CHANGED");
    expect((await responseJson<{ practiceRuns: { remaining: number } }>(await student.get(`${assigned}/coding-exercises/run`))).practiceRuns.remaining).toBe(3);
    await page.goto(assigned.replace("/api", ""));
    await page.getByRole("textbox", { name: "Blank 1", exact: true }).fill(answers.argument);
    await page.getByRole("tab", { name: "helper.py", exact: true }).click();
    await page.getByRole("textbox", { name: "Blank 2", exact: true }).fill(answers.factor);
    await expect(page.getByText("3 of 3 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Run this test?", exact: true });
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("3 of 3 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    await confirmation.getByRole("button", { name: "Run test", exact: true }).click();
    await expect(page.getByLabel("Test output", { exact: true })).toContainText("6", { timeout: 60_000 });
    await expect(page.getByText("2 of 3 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "main.py", exact: true }).click();
    await page.getByRole("button", { name: "Test", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Triple 4", exact: true }).click();
    await expect(page.getByText("2 of 3 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    await confirmation.getByRole("button", { name: "Run test", exact: true }).click();
    await expect(page.getByLabel("Test output", { exact: true })).toContainText("12", { timeout: 60_000 });
    await expect(page.getByText("1 of 3 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Test", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Personalized test", exact: true }).click();
    await page.getByLabel("Input (one value per line)", { exact: true }).fill("5");
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    await confirmation.getByRole("button", { name: "Run test", exact: true }).click();
    await expect(page.getByLabel("Test output", { exact: true })).toContainText("15", { timeout: 60_000 });
    await expect(page.getByText("0 of 3 test runs remaining", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("0 of 3 test runs remaining", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run test", exact: true })).toBeDisabled();
    const forged = await student.post(`${assigned}/coding-exercises/run`, { data: { sourceCode: "forged", files: blankFiles.map(file => ({ ...file, sourceCode: "forged" })),
      blankAnswers: answers, stdin: "5", expectedOutput: "15", practiceScope: "new-test" } });
    expect(forged.status()).toBe(409);
    expect((await forged.json()).error.code).toBe("CODING_EXERCISE_RUN_LIMIT_REACHED");
    await page.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect.poll(() => prisma.activityAttempt.count({ where: { activityId: id, lifecycle: "graded" } })).toBe(1);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: id } });
    const grade = await prisma.grade.findFirstOrThrow({ where: { selectedAttemptId: attempt.id } });
    expect(grade.normalizedMaxScore).toBeGreaterThan(0);
    expect(grade.normalizedScore).toBe(grade.normalizedMaxScore);
    const fresh = await responseJson<{ practiceRuns: { remaining: number } }>(await student.get(`${assigned}/coding-exercises/run`));
    expect(fresh.practiceRuns.remaining).toBe(3);
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/reopen`, { data: {} }));
    await page.goto(assigned.replace("/api", ""));
    await expect(page.getByText("0 of 3 test runs remaining", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Blank 1", exact: true })).toHaveValue(answers.argument);
    await page.getByRole("tab", { name: "helper.py", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Blank 2", exact: true })).toHaveValue(answers.factor);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("teacher Student view runs a multi-file project without creating academic records", async ({ teacherPage: page }) => {
  test.setTimeout(120_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher");
  try {
    const title = `Multi-file preview ${data.token}`;
    const files = referenceFiles.map(file => ({ id: file.id, name: file.name, starterCode: file.sourceCode, studentTemplateSource: "{{ STUDENT_CODE }}" }));
    const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title,
      config: { language: "python", prompt: "Run the provided project in the preview.", files, sampleTests, maxTestRuns: 2 } });
    await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${id}/coding-exercises/hidden-tests`, { data: {
      tests: hiddenTests, sampleTests, referenceSolution: bundle, privateConfig
    } }));
    await assignCourseTest(data, id, title, 2);
    async function counts() {
      const [attempts, drafts, grades, executions] = await Promise.all([
        prisma.activityAttempt.count({ where: { activityId: id } }),
        prisma.activityResponseDraft.count({ where: { groupActivity: { groupId: data.groupId, activityId: id } } }),
        prisma.grade.count({ where: { gradebookItem: { activityId: id } } }),
        prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "PluginCodingExerciseExecution" WHERE "activityId"=${id}`
      ]);
      return { attempts, drafts, grades, executions: Number(executions[0].count) };
    }
    const before = await counts();
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/student-view`);
    await page.getByRole("link", { name: title, exact: true }).click();
    const tabs = page.getByRole("tablist", { name: "Source files", exact: true });
    await expect(tabs.getByRole("tab")).toHaveCount(2);
    await tabs.getByRole("tab", { name: "helper.py", exact: true }).click();
    await expect(page.getByText("2 of 2 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    await page.getByRole("dialog", { name: "Run this test?", exact: true }).getByRole("button", { name: "Run test", exact: true }).click();
    await expect(page.getByLabel("Test output", { exact: true })).toContainText("6", { timeout: 60_000 });
    await expect(page.getByText("1 of 2 test runs remaining", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Full screen", exact: true }).click();
    await expect(tabs.getByRole("tab", { name: "main.py", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByText("1 of 2 test runs remaining", { exact: true })).toBeVisible();
    expect(await counts()).toEqual(before);
  } finally { await teacher.dispose(); await removeActivitySuite(data); }
});
