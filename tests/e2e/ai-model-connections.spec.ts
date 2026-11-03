import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";
import { homeworkModelFixture } from "./fixtures/homework-model";
import { isolatedAiOwner } from "./fixtures/isolated-ai-owner";

test("one saved credential offers several models in account and course settings", async ({ bankCourse: data, browser, teacherPage, teacherApi }) => {
  const owner = await isolatedAiOwner(data);
  const admin = owner.api, page = await owner.page(browser);
  const name = `Model catalogue ${data.token}`;
  let id: string | undefined;
  try {
    await page.goto("/settings/ai-agents");
    await page.getByLabel("Display name", { exact: true }).fill(name);
    await page.getByLabel("Provider", { exact: true }).selectOption("codex");
    await page.getByLabel("Model", { exact: true }).fill("text-a");
    await page.getByLabel("Additional text models", { exact: true }).fill("text-b\ntext-c");
    await page.getByLabel("Embedding models", { exact: true }).fill("vectors-a\nvectors-b");
    await page.getByLabel("API key", { exact: true }).fill("synthetic-ui-credential");
    await page.getByLabel("Scope", { exact: true }).selectOption("global");
    const saved = page.waitForResponse(response => response.url().endsWith("/api/ai-agents") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    const result = await (await saved).json(); id = result.connection.id;
    expect(id).toBeTruthy(); expect(JSON.stringify(result)).not.toContain("synthetic-ui-credential");
    const before = await prisma.aiAgentConnection.findUniqueOrThrow({ where: { id } });
    expect(before.apiKey).not.toBe("synthetic-ui-credential");
    await page.locator(".ai-agent-row").filter({ hasText: name }).getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("API key", { exact: true })).toHaveValue("");
    await page.getByLabel("Additional text models", { exact: true }).fill("text-b\ntext-c\ntext-d");
    const updated = page.waitForResponse(response => response.url().endsWith(`/api/ai-agents/${id}`) && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save model", exact: true }).click(); await updated;
    expect((await prisma.aiAgentConnection.findUniqueOrThrow({ where: { id } })).apiKey).toBe(before.apiKey);
    await page.getByLabel("AI agent for question authoring", { exact: true }).selectOption(id!);
    await page.getByLabel("Question-authoring model", { exact: true }).selectOption("text-c");
    await page.getByRole("button", { name: "Save AI preferences", exact: true }).click();
    await expect(page.getByText("AI preferences saved.", { exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByLabel("Question-authoring model", { exact: true })).toHaveValue("text-c");
    const account = await responseJson<{ preferences: unknown }>(await admin.get("/api/ai-agents"));
    expect(account.preferences).toMatchObject({ questionAuthoringAiAgentConnectionId: id, questionAuthoringModel: "text-c" });

    await teacherPage.goto(`/courses/${data.courseId}?tab=settings&section=ai`);
    const form = teacherPage.locator("#course-ai-settings-form");
    const pickers = form.locator(".ai-model-picker");
    await pickers.nth(0).locator("select").nth(0).selectOption(id!);
    await pickers.nth(0).locator("select").nth(1).selectOption("text-b");
    await form.getByRole("checkbox").check();
    await pickers.nth(1).locator("select").nth(0).selectOption(id!);
    await pickers.nth(1).locator("select").nth(1).selectOption("text-d");
    const courseSaved = teacherPage.waitForResponse(response => response.url().endsWith(`/courses/${data.courseId}/settings`) && response.request().method() === "PATCH");
    await form.getByRole("button", { name: "Save AI settings", exact: true }).click();
    expect((await courseSaved).ok()).toBe(true);
    const course = await prisma.course.findUniqueOrThrow({ where: { id: data.courseId } });
    expect((course.metadata as { aiSettings: unknown }).aiSettings).toMatchObject({ studentSupportAiAgentConnectionId: id, studentSupportAiAgentModel: "text-b", assessmentFeedbackAiAgentConnectionId: id, assessmentFeedbackAiAgentModel: "text-d" });
    await teacherPage.reload(); await expect(pickers.nth(0).locator("select").nth(1)).toHaveValue("text-b"); await expect(pickers.nth(1).locator("select").nth(1)).toHaveValue("text-d");
    expect((await teacherApi.patch(`/api/ai-agents/${id}`, { data: { model: "unauthorized" } })).status()).toBe(403);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: "tmp/ai-model-connections-mobile.png", fullPage: true });
  } finally {
    if (id) await prisma.aiAgentConnection.delete({ where: { id } });
    await owner.close();
  }
});

for (const provider of ["codex", "ollama"] as const) test(`homework selects ${provider} embeddings and an independent text model, preserving frozen work`, async ({ bankCourse: data, browser }) => {
  test.setTimeout(120_000);
  await ensureContentTypePluginEnabled("text-content");
  const model = await homeworkModelFixture(data, { provider, hold: true });
  const student = await createAuthenticatedApi("student");
  const admin = model.api, teacherApi = model.api, page = await model.page(browser);
  let activityId: string | undefined;
  try {
    await responseJson(await admin.patch(`/api/ai-agents/${model.connection.id}`, { data: { models: [
      { model: "synthetic-model", purpose: "generation" }, { model: "alternate-text", purpose: "generation" },
      { model: "vectors-a", purpose: "embedding" }, { model: "vectors-b", purpose: "embedding" }
    ] } }));
    const { resource } = await responseJson<{ resource: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/content-resources`, { data: { contentTypeKey: "text", payload: { title: "C model reference", body: "C functions take typed parameters and return typed values. Check pointer boundaries." }, isVisible: true } }));
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Model selection homework", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { selected: [resource.id] } }));
    await page.goto(`/courses/${data.courseId}/activities/${activityId}`);
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    const referencePanel = page.locator(".homework-reference-materials");
    await referencePanel.getByLabel("AI connection", { exact: true }).selectOption(model.connection.id);
    await referencePanel.getByLabel("Model", { exact: true }).selectOption("vectors-a");
    await referencePanel.getByRole("button", { name: "Save model choice", exact: true }).click();
    await expect(referencePanel.getByText("Model in use: vectors-a", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    const settingsPanel = page.locator(".homework-workflow-settings");
    await settingsPanel.getByLabel("AI connection", { exact: true }).selectOption(model.connection.id);
    await settingsPanel.getByLabel("Model", { exact: true }).selectOption("alternate-text");
    await settingsPanel.getByRole("button", { name: "Save model choice", exact: true }).click();
    await expect(settingsPanel.getByText("Model in use: alternate-text", { exact: true })).toBeVisible();
    await settingsPanel.getByRole("button", { name: "Generate embeddings", exact: true }).click();
    await expect(settingsPanel.getByText("Reference selection is prepared.", { exact: true })).toBeVisible();
    expect(model.requests.filter(request => request.model === "vectors-a")).toHaveLength(1);
    const indexA = await prisma.contentMaterialIndex.findFirstOrThrow({ where: { resourceId: resource.id } });
    expect(indexA.embeddingConfig).toMatchObject({ model: "vectors-a", vectorDimensions: 8 });
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { questionGenerationAi: { connectionId: model.connection.id, model: "synthetic-model" } } }));
    expect(await responseJson(await teacherApi.get(`${base}/workflow-settings`))).toMatchObject({ prepared: true, statuses: { [resource.id]: { state: "ready" } } });
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { embeddingAi: { connectionId: model.connection.id, model: "vectors-b" } } }));
    expect(await responseJson(await teacherApi.get(`${base}/workflow-settings`))).toMatchObject({ prepared: false, statuses: { [resource.id]: { state: "missing" } } });
    await responseJson(await teacherApi.post(`${base}/prepare-material`, { data: { resourceId: resource.id } }));
    await responseJson(await teacherApi.post(`${base}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { embeddingAi: { connectionId: model.connection.id, model: "vectors-a" }, questionGenerationAi: { connectionId: model.connection.id, model: "alternate-text" } } }));
    const reused = await responseJson<{ id: string }>(await teacherApi.post(`${base}/prepare-material`, { data: { resourceId: resource.id } }));
    expect(reused.id).toBe(indexA.id); expect(model.requests.filter(request => request.model === "vectors-a")).toHaveLength(1);
    await responseJson(await teacherApi.post(`${base}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    expect((await teacherApi.put(`${base}/workflow-settings`, { data: { embeddingAi: { connectionId: model.connection.id, model: "vectors-b" } } })).status()).toBe(409);
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId, availableFrom: null, availableUntil: null, metadata: { assessmentMode: "summative" }, config: {}, gradebookSettings: { pointsPossible: 100, maxAttempts: 1, attemptLimitMode: "max_attempts", gradeStrategy: "latest" } } }));
    const endpoint = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", base64: Buffer.from("int add(int x, int y) { return x + y; }").toString("base64"), expectedRevision: 0, replace: false } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    await expect.poll(() => model.active, { timeout: 30_000 }).toBe(1);
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { questionGenerationAi: { connectionId: model.connection.id, model: "synthetic-model" } } }));
    model.release();
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${endpoint}/workspace`))).submission.status, { timeout: 45_000 }).toBe("challenge_ready");
    const textRequests = model.requests.filter(request => request.path.endsWith("/responses") || request.path.endsWith("/api/chat"));
    expect(textRequests).toHaveLength(3); expect(textRequests.every(request => request.model === "alternate-text")).toBe(true);
    expect(model.requests.every(request => request.authenticated)).toBe(true);
    const publicAssignment = JSON.stringify(await responseJson(await student.get(`${endpoint}/assignment`)));
    expect(publicAssignment).not.toContain("questionGenerationAi"); expect(publicAssignment).not.toContain("synthetic-test-key");
    expect((await student.put(`${endpoint}/workflow-settings`, { data: { questionGenerationAi: { connectionId: model.connection.id, model: "synthetic-model" } } })).status()).toBe(403);
  } finally {
    model.release();
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await student.dispose(); await model.close();
  }
});

for (const provider of ["openai", "claude"] as const) test(`rubric authoring uses either ${provider} model with one stored token`, async ({ bankCourse: data }) => {
  const model = await homeworkModelFixture(data, { provider });
  const admin = model.api, teacherApi = model.api;
  try {
    await responseJson(await admin.patch(`/api/ai-agents/${model.connection.id}`, { data: { models: [{ model: "synthetic-model", purpose: "generation" }, { model: "rubric-model", purpose: "generation" }] } }));
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: "Model choice rubric", config: { language: "python", prompt: "Print one.", starterCode: "", sampleTests: [] } });
    for (const choice of ["synthetic-model", "rubric-model"]) {
      await responseJson(await teacherApi.patch("/api/ai-agents/preferences", { data: { questionAuthoringAiAgentConnectionId: model.connection.id, questionAuthoringModel: choice } }));
      const rubric = await responseJson<{ criteria: unknown[] }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/coding-exercises/generate-rubric`, { data: {
        title: "Print one", description: "", prompt: "Print one.", referenceSolution: "print(1)", language: "python"
      } }));
      expect(rubric.criteria).toHaveLength(1);
    }
    expect(model.requests.map(request => request.model)).toEqual(["synthetic-model", "rubric-model"]);
    expect(model.requests.every(request => request.authenticated)).toBe(true);
  } finally { await model.close(); }
});
