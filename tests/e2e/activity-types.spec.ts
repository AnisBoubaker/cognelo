import type { Locator, Page } from "@playwright/test";
import { prisma } from "@cognelo/db";
import { expect, test } from "./fixtures/auth";
import {
  assignCourseTest,
  copyAndAssignBankActivity,
  createBankActivityThroughUi,
  createCourseTestThroughUi,
  openStudentActivity,
  provisionActivitySuite,
  publishCurrentBankActivity,
  removeActivitySuite,
  type ActivitySuiteData
} from "./fixtures/activity-suite";
import { createStoredZip } from "./fixtures/zip";

async function replaceCodeEditorContents(page: Page, label: string, value: string, scope: Page | Locator = page) {
  const editor = scope.getByRole("textbox", { name: label, exact: true });
  await expect(editor).toBeVisible({ timeout: 10_000 });
  const editorSurface = editor
    .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' monaco-code-editor ')][1]")
    .locator(".view-lines");
  await page.evaluate((nextValue) => {
    const monaco = (
      globalThis as typeof globalThis & {
        monaco?: { editor?: { getModels?: () => Array<{ getValue: () => string; setValue: (value: string) => void }> } };
      }
    ).monaco;
    const model = monaco?.editor?.getModels?.().at(-1);
    if (!model) throw new Error("The Monaco model was not available.");
    model.setValue(nextValue);
  }, value);
  await expect(editorSurface).toContainText(value, { timeout: 10_000 });
}

test.describe.serial("authoring and completing every activity type", () => {
  let data: ActivitySuiteData | undefined;
  let mcqBankActivityId = "";
  let mcqTitle = "";
  let parsonsBankActivityId = "";
  let parsonsTitle = "";

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("teacher authors an MCQ and the student submits its summative answer", async ({ teacherPage, studentPage }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    mcqTitle = `E2E authored MCQ ${data.token}`;
    mcqBankActivityId = await createBankActivityThroughUi(teacherPage, data, {
      category: "Generic Activity",
      typeName: /Mult.*choice questions/
    });

    await expect(teacherPage.getByRole("heading", { name: "Multiple choice questions authoring" })).toBeVisible();
    await teacherPage.getByLabel("Title", { exact: true }).fill(mcqTitle);
    await teacherPage.getByLabel("Student prompt").fill("Select the value returned by the expression.");
    await teacherPage.locator("#mcq-source").fill([
      "## Result",
      "What is `6 * 7`?",
      "",
      "- [x] 42",
      "- [ ] 36"
    ].join("\n"));
    await teacherPage.getByLabel("Randomize choices").check();
    await teacherPage.getByRole("button", { name: "Save multiple choice questions" }).click();
    await expect(teacherPage.getByText("Multiple choice questions activity saved.", { exact: true })).toBeVisible();
    await publishCurrentBankActivity(teacherPage);

    await copyAndAssignBankActivity(data, {
      activityTypeKey: "mcq",
      bankActivityId: mcqBankActivityId,
      title: mcqTitle
    });

    await openStudentActivity(studentPage, data, mcqTitle);
    await studentPage.getByLabel("42", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    const confirmation = studentPage.getByRole("dialog", { name: "Submit answers?" });
    await confirmation.getByRole("button", { name: "Submit answers" }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    await expect(studentPage.getByText("Submitted", { exact: true })).toBeVisible();
  });

  test("teacher authors a Parsons problem and the student submits the rebuilt program", async ({ teacherPage, studentPage }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    parsonsTitle = `E2E authored Parsons ${data.token}`;
    parsonsBankActivityId = await createBankActivityThroughUi(teacherPage, data, {
      category: "Programming",
      typeName: "Parsons problem"
    });

    await expect(teacherPage.getByRole("heading", { name: "Configure the problem" })).toBeVisible();
    await teacherPage.getByLabel("Activity title").fill(parsonsTitle);
    await teacherPage.getByLabel("Activity description").fill("Rebuild a one-line Python greeting.");
    await teacherPage.getByLabel("Prompt", { exact: true }).fill("Submit the Python statement that prints the E2E greeting.");
    await teacherPage.getByLabel("Reference solution", { exact: true }).fill("print('E2E Parsons')");
    await teacherPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(teacherPage.getByText("Parsons problem saved.", { exact: true })).toBeVisible();
    await publishCurrentBankActivity(teacherPage);

    await copyAndAssignBankActivity(data, {
      activityTypeKey: "parsons-problem",
      bankActivityId: parsonsBankActivityId,
      title: parsonsTitle
    });

    await openStudentActivity(studentPage, data, parsonsTitle);
    await expect(studentPage.getByRole("heading", { name: "Rebuild the solution" })).toBeVisible();
    const submit = studentPage.getByRole("button", { name: "Submit", exact: true });
    await submit.click();
    const confirmation = studentPage.getByRole("dialog", { name: "Submit solution?" });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Keep working" }).click();
    await expect(confirmation).toBeHidden();

    await submit.click();
    const submissionFinished = studentPage.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "PATCH" &&
        response.url().endsWith("/parsons/attempt")
    );
    await confirmation.getByRole("button", { name: "Submit solution" }).click();
    await submissionFinished;
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
  });

  test("teacher authors a coding exercise and the student runs and submits code", async ({ teacherPage, studentPage }) => {
    test.setTimeout(240_000);
    if (!data) throw new Error("The activity suite was not provisioned.");
    const title = `E2E authored coding exercise ${data.token}`;
    const solution = "print(f'Hello, {input().strip()}!')";
    const bankActivityId = await createBankActivityThroughUi(teacherPage, data, {
      category: "Programming",
      typeName: "Coding exercise"
    });

    await expect(teacherPage.getByRole("heading", { name: "Coding exercise authoring" })).toBeVisible();
    await teacherPage.getByLabel("Title", { exact: true }).fill(title);
    await teacherPage.getByLabel("Description").fill("Read a name and print a greeting.");
    await teacherPage.getByLabel("Prompt").fill("Read one name from standard input and print `Hello, <name>!`.");
    await teacherPage
      .getByText("Reference solution", { exact: true })
      .locator("..")
      .getByRole("textbox")
      .fill(solution);
    await teacherPage.getByRole("button", { name: "Add sample test" }).click();
    const sampleTestToggle = teacherPage.getByRole("button", { name: "sample-2" });
    await expect(sampleTestToggle).toBeVisible({ timeout: 10_000 });
    const sampleTests = teacherPage
      .getByRole("heading", { name: "Visible sample tests" })
      .locator("..")
      .locator("..");
    await sampleTests.getByRole("textbox").nth(0).fill("Visible greeting", { timeout: 10_000 });
    await sampleTests.getByRole("textbox").nth(1).fill("Ada", { timeout: 10_000 });
    await sampleTests.getByRole("textbox").nth(2).fill("Hello, Ada!", { timeout: 10_000 });
    await sampleTests.getByLabel("Output matching").selectOption("contains_lines");
    await sampleTests.getByLabel("Require lines in this order").check();
    await teacherPage.getByRole("button", { name: "Add hidden test" }).click();
    const hiddenTestToggle = teacherPage.getByRole("button", { name: "Hidden test 1" });
    await expect(hiddenTestToggle).toBeVisible({ timeout: 10_000 });
    const hiddenTests = teacherPage.getByRole("heading", { name: "Hidden tests" }).locator("..").locator("..");
    await hiddenTests.getByRole("textbox").nth(2).fill("Grace", { timeout: 10_000 });
    await hiddenTests.getByRole("textbox").nth(3).fill("Hello, Grace!", { timeout: 10_000 });
    await teacherPage.getByRole("button", { name: "Save coding exercise" }).click();
    await expect(teacherPage.getByText("Coding exercise saved.", { exact: true })).toBeVisible({ timeout: 120_000 });
    await publishCurrentBankActivity(teacherPage);

    await copyAndAssignBankActivity(data, {
      activityTypeKey: "coding-exercise",
      bankActivityId,
      gradebookSettings: { maxAttempts: 2 },
      title
    });

    await openStudentActivity(studentPage, data, title);
    await expect(studentPage.getByText("Hidden test 1", { exact: true })).toHaveCount(0);
    await expect(studentPage.getByText("Grace", { exact: true })).toHaveCount(0);
    await replaceCodeEditorContents(studentPage, title, solution);
    const testSelector = studentPage.locator("#coding-visible-sample");
    await testSelector.click();
    await studentPage.getByRole("menuitemradio", { name: "Visible greeting" }).click();
    const testRunner = studentPage.getByRole("button", { name: "Run test" }).locator("xpath=ancestor::section[1]");
    await expect(testRunner.getByRole("group", { name: "Input (one value per line)" })).toContainText("Ada");
    await expect(testRunner.getByRole("group", { name: "Expected output" })).toContainText("Hello, Ada!");
    await expect(testRunner.getByRole("group", { name: "Expected output" })).toContainText("Contains lines");
    await expect(testRunner.getByRole("group", { name: "Expected output" })).toContainText("Require lines in this order");
    await expect(testRunner.getByRole("textbox", { name: "Input (one value per line)" })).toHaveCount(0);
    await expect(testRunner.getByRole("textbox", { name: "Expected output" })).toHaveCount(0);
    await expect(testRunner.getByText("Test code", { exact: true })).toHaveCount(0);

    await testSelector.press("ArrowDown");
    await expect(studentPage.getByRole("menuitemradio", { name: "Personalized test" })).toBeVisible();
    await studentPage.getByRole("menuitemradio", { name: "Personalized test" }).click();
    const personalizedInput = testRunner.getByRole("textbox", { name: "Input (one value per line)" });
    await expect(personalizedInput).toBeEditable();
    await expect(testRunner.getByRole("group", { name: "Expected output" })).toHaveCount(0);
    await expect(testRunner.getByText("Test code", { exact: true })).toHaveCount(0);
    const personalizedInputBox = await personalizedInput.boundingBox();
    const personalizedButtonBox = await testRunner.getByRole("button", { name: "Run test" }).boundingBox();
    const personalizedOutputBox = await testRunner.getByLabel("Test output").boundingBox();
    expect(personalizedInputBox?.height).toBeLessThan(180);
    expect(personalizedButtonBox?.height).toBeLessThan(80);
    expect(personalizedOutputBox?.height).toBeGreaterThanOrEqual(128);

    await testSelector.press("ArrowDown");
    await expect(studentPage.getByRole("menuitemradio", { name: "Visible greeting" })).toBeVisible();
    await studentPage.getByRole("menuitemradio", { name: "Visible greeting" }).click();
    const runTest = testRunner.getByRole("button", { name: "Run test" });
    await expect(runTest).toBeEnabled({ timeout: 10_000 });
    await runTest.click();
    await expect(testRunner.getByRole("img", { name: "Passed" })).toBeVisible({ timeout: 60_000 });
    await expect(testRunner.getByLabel("Test output")).toContainText("Hello, Ada!");
    const currentRuns = studentPage.getByRole("heading", { name: "Recent runs" }).locator("..");
    await expect(currentRuns).toContainText("Input");
    await expect(currentRuns).toContainText("Ada");
    await expect(currentRuns).toContainText("Hello, Ada!");
    const submitForGrading = studentPage.getByRole("button", { name: "Submit for grading" });
    await expect(submitForGrading).toBeEnabled({ timeout: 10_000 });
    await submitForGrading.click();
    const firstConfirmation = studentPage.getByRole("dialog", { name: "Submission complete" });
    await expect(firstConfirmation).toBeVisible({ timeout: 60_000 });
    await expect(firstConfirmation.getByRole("img", { name: "Passed" })).toBeVisible();
    await expect(firstConfirmation).toContainText("1 submission(s) remaining.");
    await firstConfirmation.getByRole("button", { name: "OK" }).click();

    await expect(studentPage.getByRole("tab", { name: "New attempt" })).toBeVisible();
    await expect(studentPage.getByRole("heading", { name: "Recent runs" })).toHaveCount(0);
    const resetEditor = studentPage.getByRole("textbox", { name: title, exact: true })
      .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' monaco-code-editor ')][1]")
      .locator(".view-lines");
    await expect(resetEditor).not.toContainText(solution);

    await studentPage.getByRole("tab", { name: "Previous submissions" }).click();
    await expect(studentPage.getByText("Read one name from standard input", { exact: false })).toHaveCount(0);
    await studentPage.getByText("Attempt 1", { exact: true }).click();
    const firstAttempt = studentPage.locator(".coding-exercise-attempt-accordion").filter({ hasText: "Attempt 1" });
    await expect(firstAttempt).toContainText(solution);
    await expect(firstAttempt).toContainText("Runs in this attempt");
    await expect(firstAttempt).toContainText("Input");
    await expect(firstAttempt).toContainText("Ada");
    await expect(firstAttempt).toContainText("Hello, Ada!");

    await studentPage.getByRole("tab", { name: "New attempt" }).click();
    await replaceCodeEditorContents(studentPage, title, solution);
    await studentPage.getByRole("button", { name: "Submit for grading" }).click();
    const finalConfirmation = studentPage.getByRole("dialog", { name: "Submission complete" });
    await expect(finalConfirmation).toBeVisible({ timeout: 60_000 });
    await expect(finalConfirmation).toContainText("No submissions remain.");
    await finalConfirmation.getByRole("button", { name: "OK" }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));

    await openStudentActivity(studentPage, data, title);
    await expect(studentPage.getByRole("tab", { name: "New attempt" })).toHaveCount(0);
    await expect(studentPage.getByRole("tab", { name: "Previous submissions" })).toBeVisible();
    await expect(studentPage.getByText("Read one name from standard input", { exact: false })).toHaveCount(0);
    await expect(studentPage.locator(".coding-exercise-attempt-accordion")).toHaveCount(2);
  });

  test("teacher authors a web-design exercise and the student edits, previews, tests, and submits it", async ({ teacherPage, studentPage }) => {
    test.setTimeout(240_000);
    if (!data) throw new Error("The activity suite was not provisioned.");
    const title = `E2E authored web design ${data.token}`;
    const bankActivityId = await createBankActivityThroughUi(teacherPage, data, {
      category: "Programming",
      typeName: "Web design coding exercise"
    });

    await expect(teacherPage.getByRole("heading", { name: "Web design exercise authoring" })).toBeVisible();
    await teacherPage.getByLabel("Title", { exact: true }).fill(title);
    await teacherPage.getByLabel("Description").fill("Create an accessible profile card.");
    await teacherPage.getByLabel("Prompt").fill("Add an accessible heading and a follow button to the profile card.");
    await teacherPage.getByRole("tab", { name: "Solution files" }).click();
    await replaceCodeEditorContents(
      teacherPage,
      "Editor content",
      '<main><h1>Accessible profile</h1><button type="button">Follow</button></main>'
    );
    await teacherPage.getByRole("tab", { name: "Student starting files" }).click();
    await replaceCodeEditorContents(
      teacherPage,
      "Editor content",
      '<main><h1>Profile draft</h1><button type="button">Follow</button></main>'
    );
    await teacherPage.getByRole("tab", { name: "Playwright tests" }).click();
    await expect(teacherPage.getByText("No tests yet.", { exact: true })).toBeVisible();
    const sampleTests = teacherPage
      .getByRole("heading", { name: "Sample", exact: true })
      .locator("..")
      .locator("..");
    await sampleTests.getByRole("button", { name: "Add test" }).click();
    await replaceCodeEditorContents(
      teacherPage,
      "Editor content",
      'await expect(page.getByRole("heading", { name: "Accessible profile" })).toBeVisible();',
      sampleTests
    );
    const hiddenTests = teacherPage
      .getByRole("heading", { name: "Hidden", exact: true })
      .locator("..")
      .locator("..");
    await hiddenTests.getByRole("button", { name: "Add test" }).click();
    await replaceCodeEditorContents(
      teacherPage,
      "Editor content",
      'await expect(page.getByRole("button", { name: "Follow" })).toBeVisible();',
      hiddenTests
    );
    await teacherPage.getByRole("button", { name: "Save web design exercise" }).click();
    await expect(teacherPage.getByText("Web design exercise saved.", { exact: true })).toBeVisible({ timeout: 120_000 });
    await publishCurrentBankActivity(teacherPage);

    await copyAndAssignBankActivity(data, {
      activityTypeKey: "web-design-coding-exercise",
      bankActivityId,
      title
    });

    await openStudentActivity(studentPage, data, title);
    await expect(studentPage.getByText("Hidden 1", { exact: true })).toHaveCount(0);
    await replaceCodeEditorContents(
      studentPage,
      "Editor: index.html",
      '<main><h1>Accessible profile</h1><button type="button">Follow</button></main>'
    );
    await expect(studentPage.getByTitle("Preview")).toBeVisible();
    const sampleRunFinished = studentPage.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "POST" &&
        response.url().endsWith("/web-design-coding-exercises/run"),
      { timeout: 120_000 }
    );
    await studentPage.getByRole("button", { name: "Run sample tests" }).click();
    await sampleRunFinished;
    await expect(studentPage.getByRole("heading", { name: "Result" })).toBeVisible({ timeout: 60_000 });
    const submissionFinished = studentPage.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "POST" &&
        response.url().endsWith("/web-design-coding-exercises/submit"),
      { timeout: 120_000 }
    );
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await submissionFinished;
    await expect(studentPage.getByRole("heading", { name: "Result" })).toBeVisible({ timeout: 60_000 });
  });

  test("teacher authors a Coding Homework assignment and the student completes ZIP and challenge stages", async ({ teacherPage, studentPage }) => {
    test.setTimeout(240_000);
    if (!data) throw new Error("The activity suite was not provisioned.");
    const title = `E2E authored coding homework ${data.token}`;
    const bankActivityId = await createBankActivityThroughUi(teacherPage, data, {
      category: "Programming",
      typeName: "Coding Homework Grader"
    });

    await expect(teacherPage.getByRole("heading", { name: "Coding Homework Grader authoring" })).toBeVisible();
    await teacherPage.getByLabel("Title", { exact: true }).fill(title);
    await teacherPage.getByLabel("Description").fill("Submit a small C program and explain its behavior.");
    await teacherPage.getByLabel("Assignment text").fill("Implement `main` in `main.c`, then submit the project ZIP.");
    await teacherPage.getByLabel("Questions").fill("1");
    await teacherPage.getByLabel("Required files").fill("main.c");
    await teacherPage.getByLabel("Required functions").fill("main");
    await teacherPage.getByLabel("Allowed extensions").fill(".c");
    await teacherPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(teacherPage.getByText("Coding homework saved.", { exact: true })).toBeVisible();
    await publishCurrentBankActivity(teacherPage);

    await copyAndAssignBankActivity(data, {
      activityTypeKey: "coding-homework-grader",
      bankActivityId,
      gradebookSettings: { maxAttempts: 3 },
      title
    });

    const submissionZip = createStoredZip([
      {
        contents: "#include <stdio.h>\nint main(void) { puts(\"hello\"); return 0; }\n",
        path: "main.c"
      }
    ]);
    await openStudentActivity(studentPage, data, title);
    await studentPage.getByLabel("Check ZIP").setInputFiles({
      buffer: submissionZip,
      mimeType: "application/zip",
      name: "e2e-homework.zip"
    });
    await expect(studentPage.getByRole("status").getByText("Structure check passed.", { exact: true })).toBeVisible();
    await studentPage.getByLabel("Submit ZIP").setInputFiles({
      buffer: submissionZip,
      mimeType: "application/zip",
      name: "e2e-homework.zip"
    });
    await expect(studentPage.getByLabel("Answer 1")).toBeVisible({ timeout: 180_000 });
    await studentPage.getByLabel("Answer 1").fill("The main function prints a greeting and exits successfully.");
    await studentPage.getByRole("button", { name: "Save draft" }).click();
    await expect(studentPage.getByText("Answers saved.")).toBeVisible();
    await studentPage.getByRole("button", { name: "Submit answers" }).click();
    await expect(studentPage.getByText("Submission complete", { exact: true })).toBeVisible();
  });

  test("teacher composes a Test from authored activities and the student completes the whole assessment", async ({ teacherPage, studentPage }) => {
    test.setTimeout(180_000);
    if (!data || !mcqBankActivityId || !parsonsBankActivityId) {
      throw new Error("The reusable MCQ and Parsons bank activities were not authored.");
    }
    const title = `E2E composed Test ${data.token}`;
    const testActivityId = await createCourseTestThroughUi(teacherPage, data, title);

    await teacherPage.getByRole("button", { name: "Add activity", exact: true }).click();
    let picker = teacherPage.getByRole("dialog", { name: "Add activity to Test" });
    await picker.getByLabel("Activity bank").selectOption(data.activityBankId);
    await picker.getByRole("button", { name: new RegExp(`^${escapeRegex(mcqTitle)}`) }).click();
    await expect(picker).toBeHidden();
    await expect(teacherPage.getByText(`1. ${mcqTitle}`, { exact: true })).toBeVisible();

    await teacherPage.getByRole("button", { name: "Add activity", exact: true }).click();
    picker = teacherPage.getByRole("dialog", { name: "Add activity to Test" });
    await picker.getByLabel("Activity bank").selectOption(data.activityBankId);
    await picker.getByRole("button", { name: new RegExp(`^${escapeRegex(parsonsTitle)}`) }).click();
    await expect(picker).toBeHidden();
    await expect(teacherPage.getByText(`2. ${parsonsTitle}`, { exact: true })).toBeVisible();
    await assignCourseTest(data, testActivityId, title);

    await openStudentActivity(studentPage, data, title);
    await studentPage.getByRole("button", { name: "Start Test" }).click();
    await studentPage.getByRole("dialog", { name: "Start this Test now?" }).getByRole("button", { name: "Start Test" }).click();
    await studentPage.getByLabel("42", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Next activity" }).click();
    await expect(studentPage.getByRole("heading", { name: parsonsTitle, exact: true })).toBeVisible();
    await studentPage.getByRole("button", { name: "Submit Test" }).click();
    await studentPage.getByRole("dialog", { name: "Submit the entire Test?" }).getByRole("button", { name: "Submit Test" }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    const testRow = studentPage
      .getByText(title, { exact: true })
      .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' table-main ')][1]");
    await expect(testRow.getByText("Submitted", { exact: true })).toBeVisible();
  });

  test("placeholder activities expose their intentional no-answer state without submission controls", async ({ teacherPage, studentPage }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const [installation, activityType] = await Promise.all([
      prisma.activityPluginInstallation.findUniqueOrThrow({ where: { key: "placeholder" } }),
      prisma.activityType.findUniqueOrThrow({ where: { key: "placeholder" } })
    ]);
    await prisma.$transaction([
      prisma.activityPluginInstallation.update({
        where: { key: "placeholder" },
        data: { isActivated: true, isEnabled: true }
      }),
      prisma.activityType.update({ where: { key: "placeholder" }, data: { isEnabled: true } })
    ]);

    try {
      const title = "Placeholder activity";
      const bankActivityId = await createBankActivityThroughUi(teacherPage, data, {
        category: "Miscellaneous",
        typeName: title
      });
      await expect(teacherPage.getByRole("heading", { name: "Unsupported activity type" })).toBeVisible();
      await publishCurrentBankActivity(teacherPage);

      await copyAndAssignBankActivity(data, {
        activityTypeKey: "placeholder",
        assessmentMode: "formative",
        bankActivityId,
        title
      });

      await openStudentActivity(studentPage, data, title);
      await expect(studentPage.getByRole("heading", { name: "Activity view not available" })).toBeVisible();
      await expect(studentPage.getByRole("button", { name: /Submit|Check answer/ })).toHaveCount(0);
    } finally {
      await prisma.$transaction([
        prisma.activityPluginInstallation.update({
          where: { key: "placeholder" },
          data: { isActivated: installation.isActivated, isEnabled: installation.isEnabled }
        }),
        prisma.activityType.update({ where: { key: "placeholder" }, data: { isEnabled: activityType.isEnabled } })
      ]);
    }
  });
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
