import { expect, test } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { defaultWebDesignExerciseConfig } from "../../packages/plugin-activities/plugin-web-design-coding-exercises/src/web-design-coding-exercises";

for (const expired of [false, true]) {
  test(`loads Web Design language workers for ${expired ? "teacher review of an expired" : "a learner's active"} activity`, async ({ studentPage, teacherPage, teacherApi, bankCourse: data }) => {
    const activityId = await createCourseActivity(data, {
      activityTypeKey: "web-design-coding-exercise",
      title: `Worker loading ${data.token}`,
      config: defaultWebDesignExerciseConfig
    });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, {
      data: {
        activityId,
        availableUntil: expired ? new Date(Date.now() - 60_000).toISOString() : null,
        metadata: { assessmentMode: "formative" },
        contentPlacement: { isVisible: true, parentId: null }
      }
    }));
    const page = expired ? teacherPage : studentPage;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`);
    if (expired) {
      await page.getByRole("link", { name: "Edit activity", exact: true }).click();
      await page.getByRole("tab", { name: "Student starting files", exact: true }).click();
    }
    await expect(page.locator(".monaco-editor").first()).toBeVisible();

    // A painted editor alone does not prove that its background language services work.
    const results = await page.evaluate(async () => {
      const monaco = (window as typeof window & { monaco: typeof import("monaco-editor") }).monaco;
      const formatted: string[] = [];
      for (const [language, source] of [["html", "<main><h1>Hello</h1></main>"], ["css", "body{color:red}"]] as const) {
        const model = monaco.editor.createModel(source, language);
        const worker = monaco.editor.createWebWorker<{
          format: (uri: string, range: null, options: { tabSize: number; insertSpaces: boolean }) => Promise<Array<{ newText: string }>>;
        }>({
          moduleId: `vs/language/${language}/${language}Worker`,
          createData: language === "html" ? { languageId: language, languageSettings: {} } : { languageId: language, options: {} }
        });
        try {
          const proxy = await worker.withSyncedResources([model.uri]);
          const edits = await proxy.format(model.uri.toString(), null, { tabSize: 2, insertSpaces: true });
          if (edits.some((edit) => edit.newText.includes("\n"))) formatted.push(language);
        } finally {
          worker.dispose();
          model.dispose();
        }
      }
      const model = monaco.editor.createModel("const = ;", "javascript");
      try {
        const getWorker = await monaco.languages.typescript.getJavaScriptWorker();
        const worker = await getWorker(model.uri);
        const diagnostics = await worker.getSyntacticDiagnostics(model.uri.toString());
        return { formatted, javascriptDiagnostics: diagnostics.length };
      } finally {
        model.dispose();
      }
    });
    expect(results.formatted).toEqual(["html", "css"]);
    expect(results.javascriptDiagnostics).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}
