import { createServer } from "node:http";
import { prisma } from "@cognelo/db";
import { encryptCredential } from "@cognelo/core";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";
import { isolatedAiOwner } from "./fixtures/isolated-ai-owner";

const main = '#include <stdio.h>\n#include "sort.h"\nint main(void) { int a, b; if (scanf("%d %d", &a, &b) != 2) return 1; sort_pair(&a, &b); printf("%d %d\\n", a, b); return 0; }';
const helperTemplate = '#include "sort.h"\nvoid sort_pair(int *a, int *b) { if (*a > *b) { int tmp = *a; *a = *b; *b = {{ BLANK:swap }}; } }';
const helper = helperTemplate.replace("{{ BLANK:swap }}", "tmp");
const header = "void sort_pair(int *a, int *b);";
const project = [
  { id: "main", name: "main.c", sourceCode: main },
  { id: "sort", name: "sort.c", sourceCode: helper },
  { id: "header", name: "sort.h", sourceCode: header }
];
const bundle = project.map(file => `===== ${file.name} =====\n${file.sourceCode}`).join("\n\n");
const generated = { sampleTests: [{ id: "visible", title: "Reverse pair", input: "9 2", output: "2 9", testCode: "" }],
  hiddenTests: [{ id: "hidden", name: "Negative pair", stdin: "1 -4", expectedOutput: "-4 1", testCode: "", isEnabled: true, weight: 1 }] };

for (const scope of ["course", "bank", "single", "single-blank"] as const) {
  test(`generates and saves real validated tests for ${scope === "single" ? "a single-file exercise" : scope === "single-blank" ? "single-file blanks" : `multi-file blanks in ${scope}`}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const data = await provisionActivitySuite();
    const owner = await isolatedAiOwner(data);
    let calls = 0;
    const server = createServer(async (request, response) => {
      for await (const _chunk of request) { /* Consume the isolated provider request. */ }
      calls++;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ output_text: JSON.stringify(generated) }));
    });
    try {
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
      const connection = await prisma.aiAgentConnection.create({ data: { displayName: `Tests fixture ${data.token}`, provider: "openai", model: "synthetic-model",
        ownerId: owner.user.id, baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, apiKey: encryptCredential("synthetic-test-key") } });
      await prisma.user.update({ where: { id: owner.user.id }, data: { metadata: { e2e: true, aiPreferences: { questionAuthoringAiAgentConnectionId: connection.id } } } });
      const api = owner.api, page = await owner.page(browser);
      const singleSource = '#include <stdio.h>\nint main(void) { int a, b; if (scanf("%d %d", &a, &b) != 2) return 1; if (a > b) { int tmp = a; a = b; b = tmp; } printf("%d %d\\n", a, b); return 0; }';
      const isProject = scope === "course" || scope === "bank";
      const files = project.map(file => ({ id: file.id, name: file.name, starterCode: "", studentTemplateSource: "{{ STUDENT_CODE }}",
        blankTemplate: file.id === "sort" ? helperTemplate : file.sourceCode }));
      const config = { language: "c", prompt: "Read and sort two integers in ascending order.", sampleTests: [],
        ...(isProject ? { responseMode: "blanks", files } : scope === "single-blank"
          ? { responseMode: "blanks", blankTemplate: singleSource.replace("b = tmp;", "b = {{ BLANK:swap }};") } : { starterCode: "" }) };
      let activityId: string;
      if (scope === "bank") {
        const creator = await createAuthenticatedApi("teacher");
        try { activityId = (await responseJson<{ activity: { id: string } }>(await creator.post(`/api/activity-banks/${data.activityBankId}/activities`, { data: { activityTypeKey: "coding-exercise", title: "Sort pair", config } }))).activity.id; }
        finally { await creator.dispose(); }
      } else activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: `Sort pair ${data.token}`, config });
      const path = scope === "bank" ? `/api/activity-banks/${data.activityBankId}/activities/${activityId}` : `/api/courses/${data.courseId}/activities/${activityId}`;
      const privateConfig = { templateSource: "{{ STUDENT_CODE }}", ...(scope !== "single" ? { blankReferenceAnswers: { swap: "tmp" } } : {}),
        ...(isProject ? { fileSources: Object.fromEntries(project.map(file => [file.id, { referenceSolution: file.sourceCode, templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] }])) } : {}) };
      await responseJson(await api.put(`${path}/coding-exercises/hidden-tests`, { data: { tests: [], sampleTests: [],
        referenceSolution: isProject ? bundle : singleSource, privateConfig } }));
      await page.goto(path.replace("/api", ""));
      if (scope !== "single") {
        await page.getByRole("tab", { name: "Solution", exact: true }).click();
        if (isProject) await page.getByRole("tab", { name: "sort.c", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "Code with blanks", exact: true })).toBeVisible();
        await page.evaluate((fileId) => {
          const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco!;
          const editor = monaco.editor.getEditors().find(item => item.getModel()?.uri.toString().includes(`coding-blank-template-${fileId}`))!;
          const model = editor.getModel()!, offset = model.getValue().lastIndexOf("tmp"), start = model.getPositionAt(offset), end = model.getPositionAt(offset + 3);
          editor.focus(); editor.setSelection(new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column));
        }, isProject ? "sort" : "main");
        await page.keyboard.insertText("tmp + 0");
        await expect.poll(() => page.evaluate((fileId) => {
          const monaco = (window as typeof window & { monaco?: typeof import("monaco-editor") }).monaco!;
          return monaco.editor.getModels().find(model => model.uri.toString().includes(`coding-blank-template-${fileId}`))?.getValue();
        }, isProject ? "sort" : "main")).toContain(isProject ? "*b = tmp + 0;" : "b = tmp + 0;");
      }
      await page.getByRole("tab", { name: "Grading", exact: true }).click();
      await page.getByRole("tab", { name: "Test cases", exact: true }).click();
      await page.getByRole("button", { name: "Generate test cases automatically", exact: true }).click();
      const counts = page.getByRole("dialog", { name: "Generate test cases", exact: true });
      await counts.getByLabel("Visible tests", { exact: true }).fill("1");
      await counts.getByLabel("Hidden tests", { exact: true }).fill("1");
      const response = page.waitForResponse(result => result.url().endsWith(`${path}/coding-exercises/generate-tests`) && result.request().method() === "POST");
      await counts.getByRole("button", { name: "Generate tests", exact: true }).click();
      const generatedResponse = await response;
      expect(generatedResponse.status(), await generatedResponse.text()).toBe(200);
      const payload = generatedResponse.request().postDataJSON();
      if (!isProject) {
        expect(payload.projectFiles).toBeUndefined();
        if (scope === "single-blank") expect(payload.referenceSolution).toBe(singleSource.replace("b = tmp;", "b = tmp + 0;"));
      }
      else {
        expect(payload.projectFiles.map((file: { name: string }) => file.name)).toEqual(["main.c", "sort.c", "sort.h"]);
        expect(payload.projectReferences.sort.referenceSolution).toBe(helper.replace("*b = tmp;", "*b = tmp + 0;"));
      }
      await expect(page.getByRole("button", { name: /Reverse pair/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Negative pair/ })).toBeVisible();
      await page.getByRole("button", { name: "Save coding exercise", exact: true }).click();
      await expect(page.getByText("Coding exercise saved.", { exact: true })).toBeVisible();
      const saved = await responseJson<{ tests: Array<{ name: string }>; referenceSolution: { validationSummary: { accepted: boolean } } }>(await api.get(`${path}/coding-exercises/hidden-tests`));
      expect(saved.tests.map(item => item.name)).toEqual(["Negative pair"]);
      expect(saved.referenceSolution.validationSummary.accepted).toBe(true);
      expect(calls).toBe(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await owner.close();
      await removeActivitySuite(data);
    }
  });
}
