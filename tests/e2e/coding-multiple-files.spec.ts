import type { APIRequestContext, Page } from "@playwright/test";
import { prisma } from "@cognelo/db";
import { expect, test, createAuthenticatedApi, confirmSharedDialog } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";

const mainC = '#include <stdio.h>\n#include "ops.h"\nstatic int offset = 0;\nint main(void) { int n; scanf("%d", &n); printf("%d\\n", triple(n) + offset); return 0; }';
const starterC = '#include "ops.h"\nstatic int offset = 0;\nint triple(int n) { return 0 + offset; }';
const referenceC = '#include "ops.h"\nstatic int offset = 0;\nint triple(int n) { return n * 3 + offset; }';
const headerC = 'int triple(int n);';
const samples = [2, -1].map((value, index) => ({ id: `sample-${index}`, title: `Triple ${value}`, input: String(value), output: String(value * 3), testCode: "" }));
const tests = samples.map((sample, index) => ({ id: `hidden-${index}`, name: sample.title, stdin: sample.input, expectedOutput: sample.output, testCode: "", isEnabled: true, weight: 1 }));
type File = { id: string; name: string; sourceCode: string; blankTemplate?: string };
async function addFile(page: Page, name: string) {
  await page.getByRole("button", { name: "Add file", exact: true }).click();
  const input = page.getByRole("textbox", { name: "File name", exact: true });
  await input.fill(name); await input.press("Enter");
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
}
async function replaceStudentCode(page: Page, title: string, source: string) {
  await page.getByRole("textbox", { name: title, exact: true }).focus();
  await page.keyboard.press("Control+Home"); await page.keyboard.press("Control+Shift+End"); await page.keyboard.insertText(source);
}
async function studentCode(page: Page) {
  return page.evaluate(() => {
    const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco;
    return monaco?.editor.getEditors().find(editor => editor.getDomNode()?.closest(".coding-exercise-editor-pane"))?.getModel()?.getValue();
  });
}
async function executionFiles(id: string) {
  const [row] = await prisma.$queryRaw<Array<{ sourceCode: string; sourceFiles: File[]; resultSummary: Record<string, unknown> }>>`
    SELECT "sourceCode", "sourceFiles", "resultSummary" FROM "PluginCodingExerciseExecution" WHERE id=${id}`;
  return row;
}
async function privateData(api: APIRequestContext, path: string) {
  return responseJson<{ tests: unknown[]; referenceSolution: { sourceCode: string; privateConfig: Record<string, unknown> } }>(await api.get(path));
}

test("authors named C files, links separate translation units and retains edits across tabs, full screen and reopening", async ({ teacherPage, studentPage: page }, testInfo) => {
  test.setTimeout(210_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const title = `Multiple C files ${data.token}`;
    const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title,
      config: { language: "c", prompt: "Complete triple in ops.c. Keep the other provided files.", sampleTests: samples, maxTestRuns: 2 } });
    const authorPath = `/api/courses/${data.courseId}/activities/${id}`;
    await teacherPage.goto(authorPath.replace("/api", ""));
    await teacherPage.getByRole("tab", { name: "Solution", exact: true }).click();
    await expect(teacherPage.getByRole("tab", { name: "main.c", exact: true })).toBeVisible();
    await teacherPage.getByRole("tab", { name: "Starter code", exact: true }).click();
    await teacherPage.getByRole("textbox", { name: "Starter code", exact: true }).fill(mainC);
    await teacherPage.getByRole("tab", { name: "Reference solution", exact: true }).click();
    await teacherPage.getByRole("textbox", { name: "Reference solution", exact: true }).fill(mainC);
    await addFile(teacherPage, "math.c");
    await teacherPage.getByRole("button", { name: "Rename math.c", exact: true }).click();
    const rename = teacherPage.getByRole("textbox", { name: "Rename math.c", exact: true });
    await rename.fill("ops.c"); await rename.press("Enter");
    await teacherPage.getByRole("tab", { name: "Starter code", exact: true }).click();
    await teacherPage.getByRole("textbox", { name: "Starter code", exact: true }).fill(starterC);
    await teacherPage.getByRole("tab", { name: "Reference solution", exact: true }).click();
    await teacherPage.getByRole("textbox", { name: "Reference solution", exact: true }).fill(referenceC);
    await addFile(teacherPage, "ops.h");
    await teacherPage.getByRole("tab", { name: "Starter code", exact: true }).click();
    await teacherPage.getByRole("textbox", { name: "Starter code", exact: true }).fill(headerC);
    await teacherPage.getByRole("tab", { name: "Reference solution", exact: true }).click();
    await teacherPage.getByRole("textbox", { name: "Reference solution", exact: true }).fill(headerC);
    await addFile(teacherPage, "unused.txt");
    await teacherPage.getByRole("button", { name: "Remove unused.txt", exact: true }).click();
    await confirmSharedDialog(teacherPage);
    await expect(teacherPage.getByRole("tab", { name: "unused.txt", exact: true })).toHaveCount(0);
    await teacherPage.getByRole("tab", { name: "Reference solution", exact: true }).click();
    await expect(teacherPage.getByRole("textbox", { name: "Reference solution", exact: true })).toHaveValue(mainC);
    await teacherPage.getByRole("button", { name: "Save coding exercise", exact: true }).click();
    await expect(teacherPage.getByText("Coding exercise saved.", { exact: true })).toBeVisible();
    await teacherPage.reload();
    await teacherPage.getByRole("tab", { name: "Solution", exact: true }).click();
    await expect(teacherPage.getByRole("tab", { name: "ops.c", exact: true })).toBeVisible();
    await teacherPage.getByRole("tab", { name: "ops.c", exact: true }).click();
    await teacherPage.getByRole("tab", { name: "Starter code", exact: true }).click();
    await expect(teacherPage.getByRole("textbox", { name: "Starter code", exact: true })).toHaveValue(starterC);
    await teacherPage.getByRole("tab", { name: "Reference solution", exact: true }).click();
    await expect(teacherPage.getByRole("textbox", { name: "Reference solution", exact: true })).toHaveValue(referenceC);
    const privatePath = `${authorPath}/coding-exercises/hidden-tests`;
    const saved = await privateData(teacher, privatePath);
    await responseJson(await teacher.put(privatePath, { data: { tests, sampleTests: samples, referenceSolution: saved.referenceSolution.sourceCode, privateConfig: saved.referenceSolution.privateConfig } }));
    await assignCourseTest(data, id, title, 3);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    expect(JSON.stringify(await responseJson(await student.get(assigned)))).not.toContain("return n * 3");
    await page.goto(assigned.replace("/api", ""));
    const tabs = page.getByRole("tablist", { name: "Source files", exact: true });
    await expect(tabs.getByRole("tab")).toHaveCount(3);
    await page.getByRole("tab", { name: "ops.c", exact: true }).click();
    const answer = starterC.replace("0 + offset", "n + n + n + offset");
    await replaceStudentCode(page, title, answer);
    await expect.poll(async () => (await responseJson<{ draft: { state: { files: File[] } } }>(await student.get(`${assigned}/draft`))).draft?.state.files.find(file => file.name === "ops.c")?.sourceCode).toBe(answer);
    await page.getByRole("button", { name: "Full screen", exact: true }).click();
    await page.getByRole("tab", { name: "main.c", exact: true }).click();
    await expect.poll(() => studentCode(page)).toBe(mainC);
    await page.getByRole("tab", { name: "ops.c", exact: true }).click();
    await expect.poll(() => studentCode(page)).toBe(answer);
    await expect(page.locator(".coding-exercise-editor-pane .view-lines")).toContainText("int triple");
    await page.screenshot({ fullPage: true, path: testInfo.outputPath("multiple-files-full-screen.png") });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Run test", exact: true }).click();
    await expect(page.getByLabel("Test output", { exact: true })).toContainText("6", { timeout: 60000 });
    await page.getByRole("tab", { name: "ops.h", exact: true }).click();
    const allowance = await responseJson<{ practiceRuns: { remaining: number } }>(await student.get(`${assigned}/coding-exercises/run`));
    expect(allowance.practiceRuns.remaining).toBe(1);
    await page.reload();
    await page.getByRole("tab", { name: "ops.c", exact: true }).click();
    await expect.poll(() => studentCode(page)).toBe(answer);
    await page.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect.poll(() => prisma.activityAttempt.count({ where: { activityId: id, lifecycle: "graded" } })).toBe(1);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: id } });
    const original = await executionFiles(attempt.pluginAttemptRef!);
    expect(original.sourceFiles.map(file => file.name)).toEqual(["main.c", "ops.c", "ops.h"]);
    expect(original.sourceFiles[1].sourceCode).toBe(answer);
    expect(original.resultSummary).toMatchObject({ earnedWeight: 2, totalWeight: 2 });
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/regrade`, { data: {} }));
    await teacherPage.reload();
    await teacherPage.getByRole("tab", { name: "Solution", exact: true }).click();
    await teacherPage.getByRole("button", { name: "Rename ops.c", exact: true }).click();
    const renamed = teacherPage.getByRole("textbox", { name: "Rename ops.c", exact: true });
    await renamed.fill("ops_renamed.c"); await renamed.press("Enter");
    await teacherPage.getByRole("button", { name: "Save coding exercise", exact: true }).click();
    const warning = teacherPage.getByRole("dialog", { name: "Please confirm" });
    if (await warning.isVisible()) await confirmSharedDialog(teacherPage);
    await expect(teacherPage.getByText("Coding exercise saved.", { exact: true })).toBeVisible();
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/regrade`, { data: {} }));
    expect(await executionFiles(attempt.pluginAttemptRef!)).toEqual(original);
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/reopen`, { data: {} }));
    await page.goto(assigned.replace("/api", ""));
    await page.getByRole("tab", { name: "ops_renamed.c", exact: true }).click();
    await expect.poll(() => studentCode(page)).toBe(answer);
    expect(await executionFiles(attempt.pluginAttemptRef!)).toEqual(original);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("authors blanks across Python files, preserves both answers and grades missing or invalid blanks independently", async ({ teacherPage, studentPage: page }) => {
  test.setTimeout(210_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const title = `Python blank files ${data.token}`;
    const initialFiles = [
      { id: "main", name: "main.py", starterCode: "", blankTemplate: "from helper import apply\nvalue = int(input())\nprint(apply(value))", studentTemplateSource: "{{ STUDENT_CODE }}" },
      { id: "helper", name: "helper.py", starterCode: "", blankTemplate: "def apply(value):\n    return value * 3", studentTemplateSource: "{{ STUDENT_CODE }}" }
    ];
    const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title, config: {
      language: "python", prompt: "Complete the function call and the helper expression.", responseMode: "blanks", files: initialFiles, sampleTests: [] } });
    await teacherPage.goto(`/courses/${data.courseId}/activities/${id}`);
    await teacherPage.getByRole("tab", { name: "Solution", exact: true }).click();
    async function mark(fileId: string, fragment: string) {
      await teacherPage.evaluate(({ fileId, fragment }) => {
        const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco!;
        const editor = monaco.editor.getEditors().find(editor => editor.getModel()?.uri.toString().includes(`coding-blank-template-${fileId}`))!;
        const model = editor.getModel()!, start = model.getValue().lastIndexOf(fragment), a = model.getPositionAt(start), b = model.getPositionAt(start + fragment.length);
        editor.focus(); editor.setSelection(new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column));
      }, { fileId, fragment });
      await teacherPage.getByRole("button", { name: "Mark selection as blank", exact: true }).click();
    }
    await expect(teacherPage.getByRole("textbox", { name: "Code with blanks", exact: true })).toBeVisible();
    await mark("main", "value");
    await teacherPage.getByRole("tab", { name: "helper.py", exact: true }).click();
    await expect(teacherPage.getByRole("textbox", { name: "Code with blanks", exact: true })).toBeVisible();
    await mark("helper", "value * 3");
    await teacherPage.evaluate(() => {
      const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco!;
      const editor = monaco.editor.getEditors().find(editor => editor.getModel()?.uri.toString().includes("coding-blank-template-helper"))!;
      const model = editor.getModel()!, start = model.getValue().lastIndexOf("value * 3"), a = model.getPositionAt(start), b = model.getPositionAt(start + 9);
      editor.focus(); editor.setSelection(new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column));
    });
    await teacherPage.keyboard.insertText("value + value + value");
    await teacherPage.getByRole("tab", { name: "main.py", exact: true }).click();
    await teacherPage.getByRole("tab", { name: "helper.py", exact: true }).click();
    await teacherPage.getByRole("textbox", { name: "Code with blanks", exact: true }).focus();
    const helperSource = () => teacherPage.evaluate(() => {
      const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco!;
      return monaco.editor.getEditors().find(editor => editor.getModel()?.uri.toString().includes("coding-blank-template-helper"))?.getModel()?.getValue();
    });
    for (let index = 0; index < 8 && await helperSource() !== "def apply(value):\n    return value * 3"; index++) await teacherPage.keyboard.press("Control+z");
    await expect.poll(helperSource).toBe("def apply(value):\n    return value * 3");
    await expect(teacherPage.getByRole("button", { name: "Remove blank 2", exact: true })).toBeVisible();
    await teacherPage.getByRole("button", { name: "Save coding exercise", exact: true }).click();
    await expect(teacherPage.getByText("Coding exercise saved.", { exact: true })).toBeVisible();
    const path = `/api/courses/${data.courseId}/activities/${id}`;
    const { activity } = await responseJson<{ activity: { config: { files: typeof initialFiles } } }>(await teacher.get(path));
    const firstId = activity.config.files[0].blankTemplate.match(/BLANK:([\w-]+)/)![1];
    const secondId = activity.config.files[1].blankTemplate.match(/BLANK:([\w-]+)/)![1];
    const reference = await privateData(teacher, `${path}/coding-exercises/hidden-tests`);
    expect(reference.referenceSolution.privateConfig.blankReferenceAnswers).toEqual({ [firstId]: "value", [secondId]: "value * 3" });
    await responseJson(await teacher.put(`${path}/coding-exercises/hidden-tests`, { data: { tests,
      referenceSolution: reference.referenceSolution.sourceCode, privateConfig: reference.referenceSolution.privateConfig } }));
    await assignCourseTest(data, id, title, 3);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    await page.goto(assigned.replace("/api", ""));
    await expect(page.getByRole("button", { name: "Run test", exact: true })).toHaveCount(0);
    await page.getByRole("textbox", { name: "Blank 1", exact: true }).fill("value");
    await page.getByRole("tab", { name: "helper.py", exact: true }).click();
    await page.getByRole("textbox", { name: "Blank 2", exact: true }).fill("value + value + value");
    await page.getByRole("button", { name: "Full screen", exact: true }).click();
    await page.getByRole("tab", { name: "main.py", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Blank 1", exact: true })).toHaveValue("value");
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await responseJson<{ draft: { state: { blankAnswers: Record<string, string> } } }>(await student.get(`${assigned}/draft`))).draft?.state.blankAnswers)
      .toEqual({ [firstId]: "value", [secondId]: "value + value + value" });
    await page.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect.poll(() => prisma.activityAttempt.count({ where: { activityId: id, lifecycle: "graded" } })).toBe(1);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: id } });
    const original = await executionFiles(attempt.pluginAttemptRef!);
    expect(original.resultSummary).toMatchObject({ earnedWeight: 2, totalWeight: 2, blankGrading: { combinedPassed: true } });
    const stateFiles = activity.config.files.map(file => ({ id: file.id, name: file.name, sourceCode: "ignored", blankTemplate: file.blankTemplate }));
    const missing = await responseJson<{ execution: { id: string } }>(await student.post(`${assigned}/coding-exercises/submit`, {
      data: { sourceCode: "", files: stateFiles, blankAnswers: { [firstId]: "", [secondId]: "value * 3" } } }));
    expect((await executionFiles(missing.execution.id)).resultSummary).toMatchObject({ earnedWeight: 1, totalWeight: 2 });
    const invalid = await responseJson<{ execution: { id: string } }>(await student.post(`${assigned}/coding-exercises/submit`, {
      data: { sourceCode: "", files: stateFiles, blankAnswers: { [firstId]: "value", [secondId]: "(" } } }));
    const invalidRecord = await executionFiles(invalid.execution.id);
    expect(invalidRecord.resultSummary).toMatchObject({ earnedWeight: 1, totalWeight: 2, blankGrading: { syntaxPassed: false, method: "isolated" } });
    expect(invalidRecord.sourceFiles[1].sourceCode).toContain("return (");
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

function bundle(files: File[]) { return files.map(file => `===== ${file.name} =====\n${file.sourceCode}`).join("\n\n"); }

test("submits and regrades every project file inside a Test and retains files in teacher review", async () => {
  test.setTimeout(150_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const { test: parent } = await responseJson<{ test: { activity: { id: string } } }>(await teacher.post(`/api/courses/${data.courseId}/tests`, { data: {
      title: `Project Test ${data.token}`, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true }
    } }));
    const sourceFiles = [{ id: "main", name: "main.py", sourceCode: "from helper import triple\nprint(triple(int(input())))" },
      { id: "helper", name: "helper.py", sourceCode: "def triple(n):\n    return n * 3" }];
    const config = { language: "python", prompt: "Complete the helper function.", files: sourceFiles.map(file => ({ id: file.id, name: file.name,
      starterCode: file.id === "helper" ? "def triple(n):\n    return 0" : file.sourceCode, studentTemplateSource: "{{ STUDENT_CODE }}" })), sampleTests: [] };
    const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacher.post(`/api/courses/${data.courseId}/activities/${parent.activity.id}/test/items`, {
      data: { source: "local", activityTypeKey: "coding-exercise", title: "Python modules", config, pointsPossible: 10 }
    }));
    await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`, { data: {
      tests, referenceSolution: bundle(sourceFiles), privateConfig: { templateSource: "{{ STUDENT_CODE }}", fileSources: Object.fromEntries(sourceFiles.map(file => [file.id,
        { referenceSolution: file.sourceCode, templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] }])) }
    } }));
    await assignCourseTest(data, parent.activity.id, "Project Test");
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${parent.activity.id}`;
    const { runtime } = await responseJson<{ runtime: { attempt: { id: string } } }>(await student.post(`${assigned}/test`, { data: { sessionId: data.token } }));
    const parentId = runtime.attempt.id;
    await responseJson(await student.put(`${assigned}/test/items/${item.id}`, { data: { parentAttemptId: parentId, sessionId: data.token,
      state: { sourceCode: bundle(sourceFiles), files: sourceFiles } } }));
    await responseJson(await student.post(`${assigned}/test/submit`, { data: { parentAttemptId: parentId, sessionId: data.token } }));
    const child = await prisma.testItemAttempt.findFirstOrThrow({ where: { parentAttemptId: parentId } });
    expect((child.result as { state: { files: File[] } }).state.files.map(file => file.name)).toEqual(["main.py", "helper.py"]);
    const original = await executionFiles(child.pluginAttemptRef!);
    expect(original.resultSummary).toMatchObject({ earnedWeight: 2, totalWeight: 2 });
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${parentId}/regrade`, { data: {} }));
    expect(await executionFiles(child.pluginAttemptRef!)).toEqual(original);
    const { review } = await responseJson<{ review: { submission: { files: File[] } } }>(await teacher.get(`/api/courses/${data.courseId}/gradebook/attempts/${parentId}/test-items/${item.id}/review`));
    expect(review.submission.files.map(file => file.sourceCode)).toEqual(sourceFiles.map(file => file.sourceCode));
    const attempt = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: parentId } });
    const grade = await prisma.grade.findFirstOrThrow({ where: { gradebookItemId: attempt.gradebookItemId } });
    expect(grade.normalizedScore).toBe(grade.normalizedMaxScore);
    await responseJson(await teacher.patch(`/api/courses/${data.courseId}/gradebook/items/${attempt.gradebookItemId}/release`, { data: { released: true } }));
    const released = await responseJson<{ grades: { rows: Array<{ activityId: string; feedback: { details: { items: Array<{ testItemId: string; gradingReport: { attempts: Array<{ files: File[] }> } }> } } }> } }>(await student.get(`/api/courses/${data.courseId}/groups/${data.groupId}/grades`));
    const report = released.grades.rows.find(row => row.activityId === parent.activity.id)!.feedback.details.items.find(entry => entry.testItemId === item.id)!.gradingReport;
    expect(report.attempts[0].files.map(file => file.name)).toEqual(["main.py", "helper.py"]);
    expect(report.attempts[0].files.map(file => file.sourceCode)).toEqual(sourceFiles.map(file => file.sourceCode));
    expect(JSON.stringify(released)).not.toContain("fileSources");
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("flags an interaction conflict across files for the shared teacher review instead of awarding 100 percent", async () => {
  test.setTimeout(150_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const files = [
      { id: "main", name: "main.py", starterCode: "", blankTemplate: "from helper import fallback\na, b = map(int, input().split())\nif {{ BLANK:condition }}:\n    print(a)\nelse:\n    print(fallback(a, b))", studentTemplateSource: "{{ STUDENT_CODE }}" },
      { id: "helper", name: "helper.py", starterCode: "", blankTemplate: "def fallback(a, b):\n    return {{ BLANK:fallback }}", studentTemplateSource: "{{ STUDENT_CODE }}" }
    ];
    const answers = { condition: "a >= b", fallback: "b" };
    const referenceFiles = files.map(file => ({ id: file.id, name: file.name, sourceCode: file.blankTemplate.replace(/\{\{ BLANK:(\w+) \}\}/g, (_, id: string) => answers[id as keyof typeof answers]) }));
    const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: `Cross-file conflict ${data.token}`,
      config: { language: "python", prompt: "Complete the maximum program across its files.", responseMode: "blanks", files, sampleTests: [] } });
    await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${id}/coding-exercises/hidden-tests`, { data: {
      tests: [[5, 5], [1, 4], [4, 1]].map(([a, b], i) => ({ id: `case-${i}`, name: `Case ${i + 1}`, stdin: `${a} ${b}`, expectedOutput: String(Math.max(a, b)), isEnabled: true, weight: 1 })),
      referenceSolution: bundle(referenceFiles), privateConfig: { templateSource: "{{ STUDENT_CODE }}", blankReferenceAnswers: answers,
        fileSources: Object.fromEntries(referenceFiles.map(file => [file.id, { referenceSolution: file.sourceCode, templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] }])) }
    } }));
    await assignCourseTest(data, id, "Cross-file conflict");
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    const submitted = await responseJson<{ execution: { id: string } }>(await student.post(`${assigned}/coding-exercises/submit`, { data: {
      sourceCode: "ignored", files: files.map(file => ({ id: file.id, name: file.name, sourceCode: "ignored", blankTemplate: file.blankTemplate })),
      blankAnswers: { condition: "a > b", fallback: "b if b > a else 0" }
    } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: id } });
    expect((await executionFiles(submitted.execution.id)).resultSummary).toMatchObject({ reviewRequired: true,
      blankGrading: { correct: 2, total: 2, combinedPassed: false } });
    expect(await prisma.activityGradingReview.count({ where: { attemptId: attempt.id, status: "required" } })).toBe(1);
    expect(await prisma.grade.count({ where: { gradebookItemId: attempt.gradebookItemId } })).toBe(0);
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/regrade`, { data: {} }));
    expect(await prisma.grade.count({ where: { gradebookItemId: attempt.gradebookItemId } })).toBe(0);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("resolves TypeScript imports before visiting auxiliary files and creates no initial answer draft", async ({ studentPage: page }) => {
  const data = await provisionActivitySuite(), student = await createAuthenticatedApi("student");
  try {
    const title = `Typed project ${data.token}`;
    const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title, config: {
      language: "typescript", prompt: "Complete the TypeScript project.", sampleTests: [], files: [
        { id: "main", name: "main.ts", starterCode: 'import { triple } from "./helper";\nconsole.log(triple(2));', studentTemplateSource: "{{ STUDENT_CODE }}" },
        { id: "helper", name: "helper.ts", starterCode: "export function triple(n: number): number { return n * 3; }", studentTemplateSource: "{{ STUDENT_CODE }}" }
      ]
    } });
    await assignCourseTest(data, id, title);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    await page.goto(assigned.replace("/api", ""));
    await expect(page.getByRole("textbox", { name: title, exact: true })).toBeVisible();
    const result = await page.evaluate(async () => {
      const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco!;
      const main = monaco.editor.getModels().find(model => model.uri.path.endsWith("/main.ts"))!;
      const helper = monaco.editor.getModels().find(model => model.uri.path.endsWith("/helper.ts"));
      const factory = await monaco.languages.typescript.getTypeScriptWorker();
      const worker = await factory(main.uri);
      return { helperRegistered: Boolean(helper), codes: (await worker.getSemanticDiagnostics(main.uri.toString())).map(diagnostic => diagnostic.code) };
    });
    expect(result.helperRegistered).toBe(true);
    expect(result.codes).not.toContain(2307);
    expect((await responseJson<{ draft: unknown }>(await student.get(`${assigned}/draft`))).draft).toBeNull();
  } finally { await student.dispose(); await removeActivitySuite(data); }
});

test("regrades a pre-existing single-file submission after conversion only using its retained original context", async () => {
  test.setTimeout(150_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const oldCode = '#include <stdio.h>\nint triple(int n){return n*3;}\nint main(void){int n;scanf("%d",&n);printf("%d\\n",triple(n));return 0;}';
    const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: `Legacy conversion ${data.token}`,
      config: { language: "c", prompt: "Compute triple for the given number.", starterCode: "", sampleTests: [] } });
    const path = `/api/courses/${data.courseId}/activities/${id}`;
    await responseJson(await teacher.put(`${path}/coding-exercises/hidden-tests`, { data: { tests, referenceSolution: oldCode, privateConfig: { templateSource: "{{ STUDENT_CODE }}" } } }));
    await assignCourseTest(data, id, "Legacy conversion");
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
    await responseJson(await student.post(`${assigned}/coding-exercises/submit`, { data: { sourceCode: oldCode } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: id } });
    const original = await executionFiles(attempt.pluginAttemptRef!);
    expect(original.sourceFiles).toBeNull();
    const { activity } = await responseJson<{ activity: { config: Record<string, unknown> } }>(await teacher.get(path));
    const references = [{ id: "main", name: "main.c", sourceCode: mainC }, { id: "helper", name: "ops.c", sourceCode: referenceC }, { id: "header", name: "ops.h", sourceCode: headerC }];
    const files = references.map(file => ({ id: file.id, name: file.name, starterCode: file.sourceCode, studentTemplateSource: "{{ STUDENT_CODE }}" }));
    await responseJson(await teacher.patch(path, { data: { config: { ...activity.config, files } } }));
    await responseJson(await teacher.put(`${path}/coding-exercises/hidden-tests`, { data: { tests, referenceSolution: bundle(references), privateConfig: {
      templateSource: "{{ STUDENT_CODE }}", fileSources: Object.fromEntries(references.map(file => [file.id, { referenceSolution: file.sourceCode, templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] }]))
    } } }));
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/regrade`, { data: {} }));
    const grade = await prisma.grade.findFirstOrThrow({ where: { gradebookItemId: attempt.gradebookItemId } });
    expect(grade.normalizedScore).toBe(grade.normalizedMaxScore);
    expect(await executionFiles(attempt.pluginAttemptRef!)).toEqual(original);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});
