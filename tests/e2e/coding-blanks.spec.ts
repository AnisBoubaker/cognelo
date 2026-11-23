import { prisma } from "@cognelo/db";
import { expect, test, createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";

const template = "def square(x):\n    return {{ BLANK:expression }} + {{ BLANK:offset }}";
const referenceAnswers = { expression: "x * x", offset: "0" };
const referenceSolution = "def square(x):\n    return x * x + 0";
const harness = "print(square(int(input())))";
const config = { language: "python", prompt: "Complete the code to return the square of a number.", responseMode: "blanks",
  blankTemplate: template, studentTemplateSource: "{{ STUDENT_CODE }}", starterCode: "",
  sampleTests: [{ id: "example", title: "Positive input", input: "2", output: "4", testCode: harness }] };
const privateConfig = { templateSource: "{{ STUDENT_CODE }}\n\n{{ TEST_CODE }}", blankReferenceAnswers: referenceAnswers };
const tests = [2, 0, -3].map((n, i) => ({ id: `square-${i}`, name: `Input ${n}`, stdin: String(n), expectedOutput: String(n * n), testCode: harness, isEnabled: true, weight: 1 }));

test("authors blanks and accepts equivalent completions with protected code, autosave and reopening", async ({ teacherPage, studentPage: page }, testInfo) => {
  test.setTimeout(180_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const title = `Code blanks ${data.token}`;
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title, config: { language: "python", prompt: config.prompt, starterCode: "print('old starter')", maxTestRuns: null } });
    const authorPath = `/api/courses/${data.courseId}/activities/${activityId}`;
    await teacherPage.goto(authorPath.replace("/api", ""));
    await teacherPage.getByLabel("Answer format", { exact: true }).selectOption("blanks");
    const editor = teacherPage.getByRole("textbox", { name: "Code with blanks", exact: true });
    await expect(editor).toBeVisible();
    await teacherPage.evaluate(() => {
      const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco;
      monaco!.editor.getModels().find(model => model.uri.toString().includes("coding-blank-template"))!.setValue("def square(x):\n    return x * x");
    });
    const source = () => teacherPage.evaluate(() => {
      const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco;
      return monaco?.editor.getModels().find(model => model.uri.toString().includes("coding-blank-template"))?.getValue();
    });
    const selectEnd = async (count: number) => {
      await editor.focus(); await teacherPage.keyboard.press("Control+End");
      for (let i = 0; i < count; i++) await teacherPage.keyboard.press("Shift+ArrowLeft");
    };
    await editor.focus();
    await teacherPage.keyboard.press("Control+Home");
    await teacherPage.keyboard.press("Control+Shift+End");
    await expect(teacherPage.getByRole("button", { name: "Mark selection as blank", exact: true })).toBeDisabled();
    await selectEnd(5);
    await expect(teacherPage.getByRole("button", { name: "Mark selection as blank", exact: true })).toBeEnabled();
    await teacherPage.getByRole("button", { name: "Mark selection as blank", exact: true }).click();
    await expect.poll(source).toBe("def square(x):\n    return x * x");
    const author = teacherPage.locator(".coding-blank-authoring");
    await expect(author.locator(".coding-authoring-blank-highlight").first()).toBeVisible();
    await expect(author.getByRole("button", { name: "Remove blank 1", exact: true })).toBeVisible();
    await expect(teacherPage.getByRole("heading", { name: "Reference completion", exact: true })).toHaveCount(0);
    // Replacing the marked fragment edits its private reference value in the same document.
    await selectEnd(5); await teacherPage.keyboard.insertText("x ** 2");
    await expect.poll(source).toBe("def square(x):\n    return x ** 2");
    await editor.focus();
    // Monaco may group the inserted text at word boundaries.
    for (let i = 0; i < 8 && await source() !== "def square(x):\n    return x * x"; i++) await teacherPage.keyboard.press("Control+z");
    await expect.poll(source).toBe("def square(x):\n    return x * x");
    await author.getByRole("button", { name: "Remove blank 1", exact: true }).click();
    await expect(author.locator(".coding-authoring-blank-highlight")).toHaveCount(0);
    await expect.poll(source).toBe("def square(x):\n    return x * x");
    await selectEnd(5); await teacherPage.getByRole("button", { name: "Mark selection as blank", exact: true }).click();
    await editor.focus(); await teacherPage.keyboard.press("Control+End"); await teacherPage.keyboard.insertText(" + 0");
    await selectEnd(1); await teacherPage.getByRole("button", { name: "Mark selection as blank", exact: true }).click();
    await expect.poll(source).toBe(referenceSolution);
    await expect(author.getByRole("button", { name: "Remove blank 2", exact: true })).toBeVisible();
    await teacherPage.getByRole("button", { name: "Save coding exercise", exact: true }).click();
    await expect(teacherPage.getByText("Coding exercise saved.", { exact: true })).toBeVisible();
    await expect(teacherPage.getByText("You have unsaved changes.", { exact: true })).toHaveCount(0);
    await teacherPage.reload();
    await expect(teacherPage.getByLabel("Answer format", { exact: true })).toHaveValue("blanks");
    await expect.poll(source).toBe(referenceSolution);
    await expect(author.getByRole("button", { name: "Remove blank 1", exact: true })).toBeVisible();
    for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
      await teacherPage.setViewportSize(viewport);
      await author.screenshot({ path: testInfo.outputPath(`author-blanks-${name}.png`) });
      await expect(author.getByRole("button", { name: "Remove blank 2", exact: true })).toBeVisible();
    }
    const { activity } = await responseJson<{ activity: { config: Record<string, unknown> } }>(await teacher.get(authorPath));
    const ids = Array.from((activity.config.blankTemplate as string).matchAll(/BLANK:([a-zA-Z0-9_-]+)/g), match => match[1]);
    const [expressionId, offsetId] = ids;
    const blankTemplate = activity.config.blankTemplate as string;
    expect(activity.config.starterCode).toBe("");
    expect(blankTemplate).not.toContain("x * x");
    await responseJson(await teacher.patch(authorPath, { data: { config: { ...activity.config, sampleTests: config.sampleTests } } }));
    await responseJson(await teacher.put(`${authorPath}/coding-exercises/hidden-tests`, { data: {
      tests, sampleTests: config.sampleTests, referenceSolution,
      privateConfig: { ...privateConfig, blankReferenceAnswers: { [expressionId]: "x * x", [offsetId]: "0" } }
    } }));
    await assignCourseTest(data, activityId, title, 2);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const publicActivity = await responseJson<Record<string, unknown>>(await student.get(assigned));
    expect(JSON.stringify(publicActivity)).not.toContain("blankReferenceAnswers");
    await page.goto(assigned.replace("/api", ""));
    const first = page.getByRole("textbox", { name: "Blank 1", exact: true });
    const second = page.getByRole("textbox", { name: "Blank 2", exact: true });
    await expect(first).toHaveValue("");
    await expect(first).toHaveAttribute("type", "text");
    const answerArea = page.getByRole("region", { name: "Complete the code", exact: true });
    await expect(answerArea).toBeVisible();
    expect(await answerArea.locator(".coding-exercise-student-prompt").count()).toBe(0);
    await expect(answerArea.locator(".token.keyword").first()).toBeVisible();
    const sizes = () => answerArea.locator(".coding-blank-field").evaluateAll(fields => fields.map(field => ({
      width: field.getBoundingClientRect().width, height: field.getBoundingClientRect().height, resize: getComputedStyle(field).resize
    })));
    const defaults = await sizes();
    expect(defaults[0]).toEqual(defaults[1]);
    expect(defaults[0].resize).toBe("horizontal");
    expect(defaults[0].width).toBeGreaterThan(140);
    await first.fill("x ** 2"); await first.press("Enter");
    await expect(first).toHaveValue("x ** 2");
    await expect(page.getByRole("button", { name: "Run test", exact: true })).toBeEnabled();
    await first.fill("x");
    await second.fill("0".repeat(120));
    expect(await sizes()).toEqual(defaults);
    await expect(page.getByRole("button", { name: "Run test", exact: true })).toBeEnabled();
    await first.fill("x ** 2");
    await second.fill("0");
    await expect.poll(async () => (await student.get(`${assigned}/draft`).then(r => r.json())).draft?.state?.blankAnswers)
      .toEqual({ [expressionId]: "x ** 2", [offsetId]: "0" });
    await page.reload();
    await expect(first).toHaveValue("x ** 2");
    await expect(second).toHaveValue("0");
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    await expect(page.getByLabel("Test output", { exact: true })).toContainText("4", { timeout: 60_000 });
    for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
      await page.setViewportSize(viewport);
      await page.screenshot({ fullPage: true, path: testInfo.outputPath(`student-blanks-${name}.png`) });
      await page.locator(".coding-blank-editor").screenshot({ path: testInfo.outputPath(`blanks-${name}.png`) });
      expect(await page.locator(".coding-blank-editor").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    const blankAnswers = { [expressionId]: "x ** 2", [offsetId]: "0" };
    // Fixed code from the caller is ignored; authoritative source is built on the server.
    const forged = await responseJson<{ execution: { sourceCode: string; stdout: string } }>(await student.post(`${assigned}/coding-exercises/run`, { data: {
      sourceCode: "print('forged')", blankTemplate, blankAnswers, stdin: "2", testCode: harness, expectedOutput: "4"
    } }));
    expect(forged.execution.sourceCode).toBe("def square(x):\n    return x ** 2 + 0");
    expect(forged.execution.stdout.trim()).toBe("4");
    expect((await student.post(`${assigned}/coding-exercises/run`, { data: { sourceCode: "forged", blankTemplate: "stale", blankAnswers } })).status()).toBe(409);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect.poll(() => prisma.activityAttempt.count({ where: { activityId, lifecycle: { in: ["submitted", "graded"] } } })).toBe(1);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } });
    expect(attempt.metadata).toMatchObject({ blankTemplate, blankAnswers, submittedSourceCode: "def square(x):\n    return x ** 2 + 0" });
    const [execution] = await prisma.$queryRaw<Array<{ sourceCode: string; resultSummary: { earnedWeight: number; totalWeight: number } }>>`
      SELECT "sourceCode", "resultSummary" FROM "PluginCodingExerciseExecution" WHERE id = ${attempt.pluginAttemptRef}`;
    expect(execution.resultSummary).toMatchObject({ earnedWeight: 2, totalWeight: 2 });
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/reopen`, { data: {} }));
    await page.goto(assigned.replace("/api", ""));
    await expect(first).toHaveValue("x ** 2");
    await expect(second).toHaveValue("0");
  } finally {
    await teacher.dispose(); await student.dispose(); await removeActivitySuite(data);
  }
});

test("saves, reviews and submits code blanks inside a Test", async ({ studentPage: page }) => {
  test.setTimeout(150_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher");
  try {
    const title = `Test blanks ${data.token}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacher.post(`/api/courses/${data.courseId}/tests`, {
      data: { title, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true } }
    }));
    const activityId = created.activity.id;
    const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacher.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, {
      data: { source: "local", activityTypeKey: "coding-exercise", title: "Square completion", config, pointsPossible: 10 }
    }));
    await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`, {
      data: { tests, sampleTests: config.sampleTests, referenceSolution, privateConfig }
    }));
    const { item: untouchedItem } = await responseJson<{ item: { id: string; activityId: string } }>(await teacher.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, {
      data: { source: "local", activityTypeKey: "coding-exercise", title: "Unanswered completion", config, pointsPossible: 10 }
    }));
    await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${untouchedItem.activityId}/coding-exercises/hidden-tests`, {
      data: { tests, sampleTests: config.sampleTests, referenceSolution, privateConfig }
    }));
    await assignCourseTest(data, activityId, title);
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`);
    await page.getByRole("button", { name: "Start Test", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Start Test", exact: true }).click();
    await page.getByRole("textbox", { name: "Blank 1", exact: true }).fill("x * x");
    await page.getByRole("textbox", { name: "Blank 2", exact: true }).fill("0");
    await page.getByRole("button", { name: "Next activity", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Blank 1", exact: true })).toHaveValue("");
    await page.getByRole("button", { name: "Submit the test", exact: true }).click();
    await expect(page.getByRole("region", { name: "Review your answers" }).getByText("Answered", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${data.groupId}$`), { timeout: 60_000 });
    const parent = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId }, include: { testItemAttempts: true } });
    const answered = parent.testItemAttempts.find(child => child.activityId === item.activityId)!;
    const untouched = parent.testItemAttempts.find(child => child.activityId === untouchedItem.activityId)!;
    expect((answered.result as { state: unknown }).state).toMatchObject({ sourceCode: referenceSolution, blankTemplate: template, blankAnswers: referenceAnswers });
    expect((untouched.result as { state: unknown }).state).toMatchObject({ sourceCode: "", blankTemplate: template, blankAnswers: { expression: "", offset: "" } });
    expect(answered.pluginAttemptRef).toBeTruthy();
  } finally { await teacher.dispose(); await removeActivitySuite(data); }
});

test("shows highlighted C code with uniform single-line blanks and horizontal-only resizing", async ({ studentPage: page }, testInfo) => {
  test.setTimeout(90_000);
  const data = await provisionActivitySuite();
  try {
    const title = `Inline C blanks ${data.token}`;
    const blankTemplate = [
      "void sort_array(int arr[], int size) {",
      "    for (int i = 0; i < {{ BLANK:limit }} - 1; i++) {",
      "        for (int j = {{ BLANK:start }}; j < size; j++) {",
      "            if ({{ BLANK:condition }}) {",
      "                int temp = arr[i];",
      "                arr[i] = arr[j];",
      "                arr[j] = {{ BLANK:swap }};",
      "            }",
      "        }",
      "    }",
      "}"
    ].join("\n");
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title, config: {
      language: "c", responseMode: "blanks", blankTemplate, sampleTests: [],
      prompt: "## Edge cases\n\nSort the array in ascending order. Leave arrays of size 0 or 1 unchanged."
    } });
    await assignCourseTest(data, activityId, title);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`);
    const area = page.getByRole("region", { name: "Complete the code", exact: true });
    const fields = area.locator(".coding-blank-field");
    await expect(fields).toHaveCount(4);
    const keyword = area.locator(".token.keyword").first();
    await expect(keyword).toHaveText("void");
    expect(await keyword.evaluate(el => getComputedStyle(el).color)).not.toBe(await area.locator(".code-renderer-line-content").first().evaluate(el => getComputedStyle(el).color));
    expect(await area.textContent()).not.toContain("__cognelo_blank_");
    const prompt = page.locator(".coding-exercise-student-prompt");
    expect((await area.boundingBox())!.y).toBeGreaterThan((await prompt.boundingBox())!.y + (await prompt.boundingBox())!.height);
    expect(await prompt.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe("solid");
    const first = fields.first();
    const before = (await first.boundingBox())!;
    await page.mouse.move(before.x + before.width - 3, before.y + before.height - 3);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width + 65, before.y + before.height + 45, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await first.boundingBox())!.width).toBeGreaterThan(before.width + 20);
    expect((await first.boundingBox())!.height).toBe(before.height);
    const resizedWidth = (await first.boundingBox())!.width;
    await page.getByRole("textbox", { name: "Blank 1", exact: true }).fill("x".repeat(120));
    expect((await first.boundingBox())!.width).toBe(resizedWidth);
    expect((await first.boundingBox())!.height).toBe(before.height);
    await page.reload();
    await expect(fields).toHaveCount(4);
    for (const [index, value] of ["size", "i + 1", "arr[i] > arr[j]", "temp"].entries()) {
      await page.getByRole("textbox", { name: `Blank ${index + 1}`, exact: true }).fill(value);
    }
    for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
      await page.setViewportSize(viewport);
      const dimensions = await fields.evaluateAll(elements => elements.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
      expect(dimensions.every(size => size.width === dimensions[0].width && size.height === dimensions[0].height)).toBe(true);
      expect(await area.locator(".coding-blank-editor").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({ fullPage: true, path: testInfo.outputPath(`c-blanks-${name}.png`) });
    }
  } finally { await removeActivitySuite(data); }
});
