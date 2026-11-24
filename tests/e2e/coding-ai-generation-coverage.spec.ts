import { createServer } from "node:http";
import { prisma } from "@cognelo/db";
import { encryptCredential } from "@cognelo/core";
import { expect, test, createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";
import { isolatedAiOwner } from "./fixtures/isolated-ai-owner";

const files = [
  { id: "main", name: "main.py", starterCode: "from helper import triple\nprint(triple(int(input())))", studentTemplateSource: "{{ STUDENT_CODE }}" },
  { id: "helper", name: "helper.py", starterCode: "def triple(n):\n    return 0", studentTemplateSource: "{{ STUDENT_CODE }}" }
];
const referenceFiles = [
  { id: "main", name: "main.py", sourceCode: "from helper import triple\nprint(triple(int(input())))" },
  { id: "helper", name: "helper.py", sourceCode: "def triple(n):\n    return n * 3" }
];
const references = Object.fromEntries(referenceFiles.map(file => [file.id, {
  referenceSolution: file.sourceCode, templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: []
}]));
const referenceSolution = referenceFiles.map(file => `===== ${file.name} =====\n${file.sourceCode}`).join("\n\n");
const visible = { id: "new-visible", title: "Triple two", input: "2", output: "6", testCode: "" };
const hidden = { id: "new-hidden", name: "Triple four", stdin: "4", expectedOutput: "12", testCode: "", isEnabled: true, weight: 1 };

async function generationFixture() {
  const data = await provisionActivitySuite();
  const owner = await isolatedAiOwner(data);
  const responses: string[] = [], requests: string[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(body);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ output_text: responses.shift() ?? "invalid response" }));
  });
  try {
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const connection = await prisma.aiAgentConnection.create({ data: { displayName: `Generation fixture ${data.token}`, provider: "openai",
      model: "synthetic-model", ownerId: owner.user.id, baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
      apiKey: encryptCredential("synthetic-test-key") } });
    await prisma.user.update({ where: { id: owner.user.id }, data: { metadata: { e2e: true,
      aiPreferences: { questionAuthoringAiAgentConnectionId: connection.id } } } });
    const close = async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await owner.close();
      await removeActivitySuite(data);
    };
    return { data, owner, responses, requests, close };
  } catch (error) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await owner.close();
    await removeActivitySuite(data);
    throw error;
  }
}

type Generated = { status: string; attempts: number; sampleTests: Array<{ id: string; title: string; output: string }>;
  hiddenTests: Array<{ id: string; name: string; expectedOutput: string }>; validationSummary: { accepted: boolean } };
function generationInput(existingTests?: unknown) {
  return { prompt: "Read a number and print its triple.", language: "python", referenceSolution,
    templateSource: "{{ STUDENT_CODE }}", projectFiles: files, projectReferences: references,
    visibleTestCount: 1, hiddenTestCount: 1, ...(existingTests ? { existingTests } : {}) };
}

for (const result of ["correction", "partial"] as const) {
  test(`real multi-file generation retains passing cases through ${result}`, async () => {
    test.setTimeout(120_000);
    const fixture = await generationFixture();
    try {
      const { data, owner, responses, requests } = fixture;
      const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: `Generation ${result} ${data.token}`,
        config: { language: "python", prompt: "Read a number and print its triple.", files, sampleTests: [] } });
      const path = `/api/courses/${data.courseId}/activities/${activityId}`;
      responses.push(JSON.stringify({ sampleTests: [visible], hiddenTests: [{ ...hidden, expectedOutput: "" }] }));
      if (result === "correction") responses.push(JSON.stringify({ sampleTests: [{ ...visible, output: "999" }], hiddenTests: [hidden] }));
      else responses.push("invalid JSON", "invalid JSON");
      const generated = await responseJson<Generated>(await owner.api.post(`${path}/coding-exercises/generate-tests`, { data: generationInput() }));
      expect(generated).toMatchObject({ status: result === "correction" ? "ok" : "warning", attempts: result === "correction" ? 2 : 3,
        sampleTests: [{ id: visible.id, output: "6" }], hiddenTests: result === "correction" ? [{ id: hidden.id, expectedOutput: "12" }] : [],
        validationSummary: { accepted: true } });
      expect(requests).toHaveLength(result === "correction" ? 2 : 3);
      expect(requests[1]).toContain("Triple two");
      expect(requests[1]).toContain("helper.py");
      // Generation is a private preview: it must not persist tests or the draft reference.
      const saved = await responseJson<{ tests: unknown[]; referenceSolution: unknown }>(await owner.api.get(`${path}/coding-exercises/hidden-tests`));
      expect(saved.tests).toEqual([]);
      expect(saved.referenceSolution).toBeNull();
    } finally { await fixture.close(); }
  });
}

test("real generation rejects duplicate cases in Add, allows them in Replace, and protects private cases", async () => {
  test.setTimeout(120_000);
  const fixture = await generationFixture();
  const student = await createAuthenticatedApi("student");
  try {
    const { data, owner, responses, requests } = fixture;
    const originalSample = { id: "sample-original", title: "Already public", input: "1", output: "3", testCode: "", outputMatchMode: "exact" as const, containsLinesOrderMatters: false };
    const originalHidden = { id: "hidden-original", name: "Private held-out", stdin: "5", expectedOutput: "15", testCode: "", outputMatchMode: "exact" as const, containsLinesOrderMatters: false, isEnabled: true, weight: 2 };
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: `Add replace ${data.token}`,
      config: { language: "python", prompt: "Read a number and print its triple.", files, sampleTests: [originalSample] } });
    const path = `/api/courses/${data.courseId}/activities/${activityId}`;
    await responseJson(await owner.api.put(`${path}/coding-exercises/hidden-tests`, { data: { tests: [originalHidden], sampleTests: [originalSample],
      referenceSolution, privateConfig: { templateSource: "{{ STUDENT_CODE }}", fileSources: references } } }));
    await assignCourseTest(data, activityId, "Add replace");
    const duplicate = { id: "candidate", title: "Repeated one", input: "1", output: "3", testCode: "" };
    responses.push(JSON.stringify({ sampleTests: [duplicate], hiddenTests: [] }),
      JSON.stringify({ sampleTests: [visible], hiddenTests: [] }), JSON.stringify({ sampleTests: [duplicate], hiddenTests: [] }));
    const input = { ...generationInput({ sampleTests: [originalSample], hiddenTests: [originalHidden] }), hiddenTestCount: 0 };
    const added = await responseJson<Generated>(await owner.api.post(`${path}/coding-exercises/generate-tests`, { data: input }));
    expect(added).toMatchObject({ status: "ok", attempts: 2, sampleTests: [{ id: visible.id, output: "6" }], hiddenTests: [], validationSummary: { accepted: true } });
    expect(requests[0]).toContain("Already public");
    expect(requests[0]).toContain("Private held-out");
    expect(requests[1]).toContain("Private held-out");
    const { existingTests: _existing, ...replaceInput } = input;
    const replaced = await responseJson<Generated>(await owner.api.post(`${path}/coding-exercises/generate-tests`, { data: replaceInput }));
    expect(replaced).toMatchObject({ status: "ok", attempts: 1, sampleTests: [{ id: duplicate.id, output: "3" }], hiddenTests: [], validationSummary: { accepted: true } });
    expect(requests[2]).not.toContain("Private held-out");
    const saved = await responseJson<{ tests: Array<{ name: string }> }>(await owner.api.get(`${path}/coding-exercises/hidden-tests`));
    expect(saved.tests.map(item => item.name)).toEqual(["Private held-out"]);
    const publicData = await responseJson<{ activity: { config: { sampleTests: Array<{ title: string }> } } }>(await owner.api.get(path));
    expect(publicData.activity.config.sampleTests.map(item => item.title)).toEqual(["Already public"]);
    expect((await student.post(`${path}/coding-exercises/generate-tests`, { data: input })).status()).toBe(403);
    expect((await student.get(`${path}/coding-exercises/hidden-tests`)).status()).toBe(403);
    const assigned = await responseJson<unknown>(await student.get(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`));
    expect(JSON.stringify(assigned)).not.toContain("Private held-out");
    expect(requests).toHaveLength(3);
  } finally { await student.dispose(); await fixture.close(); }
});

test("real generation reports an invalid multi-file C reference as a compilation failure without changing the draft", async () => {
  test.setTimeout(120_000);
  const fixture = await generationFixture();
  try {
    const { data, owner, responses, requests } = fixture;
    const sources = [
      { id: "main", name: "main.c", sourceCode: '#include <stdio.h>\nint main(void) { int value = ; printf("%d\\n", value); return 0; }' },
      { id: "helper", name: "helper.c", sourceCode: "int helper(void) { return 1; }" }
    ];
    const projectFiles = sources.map(file => ({ id: file.id, name: file.name, starterCode: "", studentTemplateSource: "{{ STUDENT_CODE }}" }));
    const projectReferences = Object.fromEntries(sources.map(file => [file.id, { referenceSolution: file.sourceCode,
      templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] }]));
    const reference = sources.map(file => `===== ${file.name} =====\n${file.sourceCode}`).join("\n\n");
    const prompt = "Print the computed integer.";
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: `Invalid project ${data.token}`,
      config: { language: "c", prompt, files: projectFiles, sampleTests: [] } });
    const path = `/api/courses/${data.courseId}/activities/${activityId}`;
    const before = await responseJson<{ tests: unknown[]; referenceSolution: unknown }>(await owner.api.get(`${path}/coding-exercises/hidden-tests`));
    responses.push(JSON.stringify({ sampleTests: [{ id: "example", title: "Print one", input: "", output: "1", testCode: "" }], hiddenTests: [] }));
    const response = await owner.api.post(`${path}/coding-exercises/generate-tests`, { data: { prompt, language: "c", referenceSolution: reference,
      templateSource: "{{ STUDENT_CODE }}", projectFiles, projectReferences, visibleTestCount: 1, hiddenTestCount: 0 } });
    expect(response.status()).toBe(422);
    expect((await response.json()).error.code).toBe("REFERENCE_SOLUTION_COMPILATION_FAILED");
    expect(requests).toHaveLength(1);
    expect(await responseJson(await owner.api.get(`${path}/coding-exercises/hidden-tests`))).toEqual(before);
    const activity = await responseJson<{ activity: { config: { sampleTests: unknown[] } } }>(await owner.api.get(path));
    expect(activity.activity.config.sampleTests).toEqual([]);
  } finally { await fixture.close(); }
});

for (const problem of ["bad call", "duplicate main"] as const) {
  test(`real C blank generation corrects or explains a generated harness with ${problem}`, async () => {
    test.setTimeout(120_000);
    const fixture = await generationFixture();
    try {
      const { data, owner, responses, requests } = fixture;
      const templateSource = "{{ STUDENT_CODE }}\n\n{{ TEST_CODE }}";
      const sources = [
        { id: "main", name: "main.c", sourceCode: problem === "duplicate main"
          ? '#include "test.h"\nint main(void) { int a[] = {2, 1}; sort_array(a, 2); return 0; }' : '#include "test.h"' },
        { id: "header", name: "test.h", sourceCode: "void sort_array(int arr[], int size);" },
        { id: "sort", name: "test.c", sourceCode: '#include "test.h"\nvoid sort_array(int arr[], int size) { for (int i = 0; i < size; i++) for (int j = i + 1; j < size; j++) if (arr[i] > arr[j]) { int t = arr[i]; arr[i] = arr[j]; arr[j] = t; } }' }
      ];
      const projectFiles = sources.map(file => ({ id: file.id, name: file.name, starterCode: "", studentTemplateSource: "{{ STUDENT_CODE }}",
        blankTemplate: file.id === "sort" ? file.sourceCode.replace("arr[j] = t;", "arr[j] = {{ BLANK:swap }};") : file.sourceCode }));
      const projectReferences = Object.fromEntries(sources.map((file, index) => [file.id, { referenceSolution: file.sourceCode,
        templateSource: index === 0 ? templateSource : "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] }]));
      const prompt = "Sort the array in place in ascending order.";
      const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: `Callable sort ${data.token}`,
        config: { language: "c", responseMode: "blanks", prompt, files: projectFiles, sampleTests: [] } });
      const path = `/api/courses/${data.courseId}/activities/${activityId}`;
      const validHarness = '#include <stdio.h>\nint main(void) { int a[] = {2, 1}; sort_array(a, 2); printf("%d %d\\n", a[0], a[1]); return 0; }';
      const generated = (testCode: string) => JSON.stringify({ sampleTests: [{ id: "sort", title: "Sort reverse pair", input: "", output: "1 2", testCode }], hiddenTests: [] });
      responses.push(generated(problem === "bad call" ? validHarness.replace("sort_array(a, 2)", "sort_array(a)") : validHarness));
      const guidance = "The reference already defines main. Move the demonstration main into the test harness to test other arrays.";
      responses.push(problem === "bad call" ? generated(validHarness) : JSON.stringify({ status: "error", message: guidance }));
      const result = await responseJson<Record<string, unknown>>(await owner.api.post(`${path}/coding-exercises/generate-tests`, { data: {
        prompt, language: "c", referenceSolution: sources.map(file => `===== ${file.name} =====\n${file.sourceCode}`).join("\n\n"),
        templateSource, projectFiles, projectReferences, visibleTestCount: 1, hiddenTestCount: 0
      } }));
      expect(requests).toHaveLength(2);
      expect(requests[1]).toContain(problem === "bad call" ? "too few arguments" : "redefinition");
      expect(result).toMatchObject(problem === "bad call"
        ? { status: "ok", attempts: 2, validationSummary: { accepted: true } }
        : { status: "error", attempts: 2, message: guidance });
      const saved = await responseJson<{ tests: unknown[]; referenceSolution: unknown }>(await owner.api.get(`${path}/coding-exercises/hidden-tests`));
      expect(saved.tests).toEqual([]);
      expect(saved.referenceSolution).toBeNull();
    } finally { await fixture.close(); }
  });
}

test("AI generation validates and saves a harness in the selected non-entry file", async () => {
  test.setTimeout(120_000);
  const fixture = await generationFixture();
  try {
    const { data, owner, responses, requests } = fixture;
    const sources = [
      { id: "main", name: "main.c", sourceCode: "int run_case(void);\nint main(void) { return run_case(); }" },
      { id: "cases", name: "cases.c", sourceCode: "int run_case(void) { return 0; }" },
      { id: "solution", name: "solution.c", sourceCode: "int twice(int n) { return n * 2; }" }
    ];
    const projectFiles = sources.map(file => ({ id: file.id, name: file.name, starterCode: file.sourceCode, studentTemplateSource: "{{ STUDENT_CODE }}" }));
    const projectReferences = Object.fromEntries(sources.map(file => [file.id, { referenceSolution: file.sourceCode,
      templateSource: file.id === "cases" ? "#include <stdio.h>\nint twice(int n);\n{{ TEST_CODE }}" : "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [] }]));
    const referenceSolution = sources.map(file => `===== ${file.name} =====\n${file.sourceCode}`).join("\n\n");
    const prompt = "Implement twice to double its integer argument.";
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: `Selected fixture file ${data.token}`,
      config: { language: "c", prompt, files: projectFiles, sampleTests: [] } });
    const path = `/api/courses/${data.courseId}/activities/${activityId}`;
    const testCode = 'int run_case(void) { printf("%d\\n", twice(4)); return 0; }';
    responses.push(JSON.stringify({ sampleTests: [], hiddenTests: [{ id: "double", name: "Double four", stdin: "", expectedOutput: "8", testCode, weight: 1, isEnabled: true }] }));
    const generated = await responseJson<Generated>(await owner.api.post(`${path}/coding-exercises/generate-tests`, { data: {
      prompt, language: "c", referenceSolution, templateSource: "{{ STUDENT_CODE }}", projectFiles, projectReferences, visibleTestCount: 0, hiddenTestCount: 1
    } }));
    expect(generated).toMatchObject({ status: "ok", attempts: 1, validationSummary: { accepted: true } });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("cases.c");
    expect(requests[0]).toContain("Individual file templates");
    await responseJson(await owner.api.put(`${path}/coding-exercises/hidden-tests`, { data: { tests: generated.hiddenTests, referenceSolution,
      privateConfig: { templateSource: "{{ STUDENT_CODE }}", fileSources: projectReferences } } }));
    const saved = await responseJson<{ referenceSolution: { validationSummary: { accepted: boolean } } }>(await owner.api.get(`${path}/coding-exercises/hidden-tests`));
    expect(saved.referenceSolution.validationSummary.accepted).toBe(true);
  } finally { await fixture.close(); }
});
