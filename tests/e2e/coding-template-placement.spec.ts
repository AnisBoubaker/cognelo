import { prisma } from "@cognelo/db";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";

for (const mode of ["code", "blanks"] as const) {
  test(`file and editor tabs retain independent ${mode} drafts and execute test code in the selected file`, async ({ teacherPage: author, studentPage: student }, info) => {
    test.setTimeout(150_000);
    const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher");
    try {
      const title = `Template placement ${mode} ${data.token}`;
      const answer = "def twice(n):\n    return n * 2";
      const comments = "\n" + Array.from({ length: 80 }, (_, i) => `# authoring line ${i}`).join("\n");
      const sources = [
        { id: "main", name: "main.py", sourceCode: "from cases import run_case\nrun_case()" },
        { id: "solution", name: "solution.py", sourceCode: answer },
        { id: "cases", name: "cases.py", sourceCode: "def run_case():\n    print('demonstration')" }
      ];
      const files = sources.map(file => ({ id: file.id, name: file.name, starterCode: file.id === "solution" ? "def twice(n):\n    return 0" : file.sourceCode,
        studentTemplateSource: "{{ STUDENT_CODE }}", ...(mode === "blanks" ? { blankTemplate: file.id === "solution" ? "def twice(n):\n    return n * {{ BLANK:factor }}" : file.sourceCode } : {}) }));
      const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title,
        config: { language: "python", prompt: "Complete the helper function in solution.py.", responseMode: mode, files, sampleTests: [] } });
      const path = `/api/courses/${data.courseId}/activities/${id}`;
      await responseJson(await teacher.put(`${path}/coding-exercises/hidden-tests`, { data: {
        tests: [], referenceSolution: sources.map(file => `===== ${file.name} =====\n${file.sourceCode}`).join("\n\n"), privateConfig: {
          templateSource: "{{ STUDENT_CODE }}", ...(mode === "blanks" ? { blankReferenceAnswers: { factor: "2" } } : {}),
          fileSources: Object.fromEntries(sources.map(file => [file.id, { referenceSolution: file.sourceCode, templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] }]))
        }
      } }));
      await author.goto(path.replace("/api", ""));
      const topTabs = author.getByRole("tablist", { name: "Activity editor", exact: true });
      await expect(topTabs.getByRole("tab")).toHaveText(["Activity", "Solution", "Concepts", "Grading"]);
      await expect(author.getByLabel("Program execution limit (CPU seconds)", { exact: true })).toBeHidden();
      await topTabs.getByRole("tab", { name: "Grading", exact: true }).click();
      await author.getByRole("tab", { name: "General", exact: true }).click();
      const cpu = author.getByLabel("Program execution limit (CPU seconds)", { exact: true });
      await expect(cpu).toHaveValue("5");
      await cpu.fill("2");
      await topTabs.getByRole("tab", { name: "Solution", exact: true }).click();
      await expect(cpu).toBeHidden();
      const sections = author.getByRole("tablist", { name: "File editor", exact: true });
      await expect(sections.getByRole("tab")).toHaveText(mode === "blanks" ? ["Code with blanks", "Template"] : ["Reference solution", "Starter code", "Template"]);
      await author.getByRole("tab", { name: "solution.py", exact: true }).click();
      if (mode === "code") {
        await sections.getByRole("tab", { name: "Starter code", exact: true }).click();
        await expect(author.getByRole("textbox", { name: "Starter code", exact: true })).toHaveValue("def twice(n):\n    return 0");
        await sections.getByRole("tab", { name: "Reference solution", exact: true }).click();
        await expect(author.getByRole("textbox", { name: "Reference solution", exact: true })).toHaveValue(answer);
        await author.getByRole("textbox", { name: "Reference solution", exact: true }).fill(answer + comments);
        await expect.poll(async () => (await author.getByRole("textbox", { name: "Reference solution", exact: true }).boundingBox())!.height).toBeGreaterThan(600);
        expect(await author.getByRole("textbox", { name: "Reference solution", exact: true }).evaluate((el: HTMLTextAreaElement) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
        await author.getByRole("tab", { name: "main.py", exact: true }).click();
        await expect(author.getByRole("textbox", { name: "Reference solution", exact: true })).toHaveValue(sources[0].sourceCode);
        await author.getByRole("tab", { name: "solution.py", exact: true }).click();
        await expect(author.getByRole("textbox", { name: "Reference solution", exact: true })).toHaveValue(answer + comments);
      } else {
        await author.evaluate((extra) => {
          const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco!;
          const editor = monaco.editor.getEditors().find(editor => editor.getModel()?.uri.toString().includes("coding-blank-template-solution"))!;
          const model = editor.getModel()!, end = model.getPositionAt(model.getValueLength());
          editor.executeEdits("authoring-lines", [{ range: new monaco.Range(end.lineNumber, end.column, end.lineNumber, end.column), text: extra }]);
        }, comments);
        await expect.poll(async () => (await author.locator(".coding-blank-authoring > .monaco-code-editor").boundingBox())!.height).toBeGreaterThan(600);
        expect(await author.evaluate(() => {
          const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco!;
          const editor = monaco.editor.getEditors().find(editor => editor.getModel()?.uri.toString().includes("coding-blank-template-solution"))!;
          return editor.getContentHeight() - editor.getLayoutInfo().height;
        })).toBeLessThanOrEqual(1);
      }
      await sections.getByRole("tab", { name: "Template", exact: true }).click();
      await author.getByRole("tab", { name: "cases.py", exact: true }).click();
      const template = author.getByRole("textbox", { name: "Template", exact: true });
      await template.fill("from solution import twice\n");
      await template.evaluate((el: HTMLTextAreaElement) => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
      await author.getByRole("button", { name: "Place test code here", exact: true }).click();
      await expect(template).toHaveValue("from solution import twice\n{{ TEST_CODE }}");
      // Moving the marker to another file removes its previous occurrence.
      await author.getByRole("tab", { name: "main.py", exact: true }).click();
      await author.getByRole("button", { name: "Place test code here", exact: true }).click();
      await author.getByRole("tab", { name: "cases.py", exact: true }).click();
      await template.evaluate((el: HTMLTextAreaElement) => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
      await author.getByRole("button", { name: "Place test code here", exact: true }).click();
      await author.getByRole("button", { name: "Save coding exercise", exact: true }).click();
      await expect(author.getByText("Coding exercise saved.", { exact: true })).toBeVisible();
      await topTabs.getByRole("tab", { name: "Activity", exact: true }).click();
      await topTabs.getByRole("tab", { name: "Solution", exact: true }).click();
      await expect(cpu).toHaveValue("2");
      await author.reload();
      await topTabs.getByRole("tab", { name: "Grading", exact: true }).click();
      await author.getByRole("tab", { name: "General", exact: true }).click();
      await expect(cpu).toHaveValue("2");
      await topTabs.getByRole("tab", { name: "Solution", exact: true }).click();
      await author.getByRole("tab", { name: "cases.py", exact: true }).click();
      await sections.getByRole("tab", { name: "Template", exact: true }).click();
      await expect(template).toHaveValue("from solution import twice\n{{ TEST_CODE }}");
      await author.screenshot({ path: info.outputPath(`template-placement-${mode}.png`) });
      await author.setViewportSize({ width: 390, height: 844 });
      expect(await author.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await author.screenshot({ path: info.outputPath(`template-placement-${mode}-mobile.png`) });
      const saved = await responseJson<{ referenceSolution: { sourceCode: string; privateConfig: { fileSources: Record<string, { templateSource: string }> } } }>(await teacher.get(`${path}/coding-exercises/hidden-tests`));
      expect(saved.referenceSolution.privateConfig.fileSources.main.templateSource).not.toContain("{{ TEST_CODE }}");
      await responseJson(await teacher.put(`${path}/coding-exercises/hidden-tests`, { data: { tests: [{ id: "case", name: "Double four", stdin: "", expectedOutput: "8",
        testCode: "def run_case():\n    print(twice(4))", isEnabled: true, weight: 1 }], referenceSolution: saved.referenceSolution.sourceCode, privateConfig: saved.referenceSolution.privateConfig } }));
      await assignCourseTest(data, id, title);
      await student.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`);
      await student.getByRole("tab", { name: "solution.py", exact: true }).click();
      if (mode === "blanks") await student.getByRole("textbox", { name: "Blank 1", exact: true }).fill("2");
      else {
        await student.getByRole("textbox", { name: title, exact: true }).focus();
        await student.keyboard.press("Control+Home"); await student.keyboard.press("Control+Shift+End"); await student.keyboard.insertText(answer);
      }
      await student.getByRole("button", { name: "Submit for grading", exact: true }).click();
      await expect.poll(() => prisma.activityAttempt.count({ where: { activityId: id, lifecycle: "graded" } })).toBe(1);
      const grade = await prisma.grade.findFirstOrThrow({ where: { gradebookItem: { activityId: id } } });
      expect(grade.normalizedMaxScore).toBeGreaterThan(0);
      expect(grade.normalizedScore).toBe(grade.normalizedMaxScore);
    } finally { await teacher.dispose(); await removeActivitySuite(data); }
  });
}
