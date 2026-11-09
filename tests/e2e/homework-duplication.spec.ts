import { openHomeworkEditorSection } from "./fixtures/homework-editor";
import { prisma } from "@cognelo/db";
import { prisma as homeworkDb } from "../../packages/plugin-activities/plugin-coding-homework-grader/src/db-client";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";
import { homeworkModelFixture } from "./fixtures/homework-model";
import { textPdf } from "./fixtures/pdf";

test("course duplication retains homework design and prepared references without assignments or student work", async ({ bankCourse: data, browser }) => {
  test.setTimeout(120_000);
  await ensureContentTypePluginEnabled("text-content");
  const model = await homeworkModelFixture(data, { questionText: number => `For inputs ${number} and 2, what does sum return and why?` });
  const api = model.api, page = await model.page(browser), student = await createAuthenticatedApi("student");
  const course = `/api/courses/${data.courseId}`;
  const created: string[] = [];
  try {
    await responseJson(await api.patch(`/api/ai-agents/${model.connection.id}`, { data: { models: [
      { model: "synthetic-model", purpose: "generation" }, { model: "chosen-questions", purpose: "generation" }, { model: "chosen-vectors", purpose: "embedding" }
    ] } }));
    const { resource } = await responseJson<{ resource: { id: string } }>(await api.post(`${course}/content-resources`, { data: {
      contentTypeKey: "text", payload: { title: "Shared C reference", body: "C functions receive typed parameters and return a value to their caller." }, isVisible: true
    } }));
    const title = "Homework design to duplicate";
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title, description: "Explain your implementation.", config: { languageKey: "c" } });
    created.push(id);
    const base = `${course}/activities/${id}/coding-homework-grader`;
    const pdf = textPdf("Implement sum and explain how it handles its parameters.");
    await responseJson(await api.post(`${base}/assignment-pdf`, { data: { fileName: "assignment.pdf", mimeType: "application/pdf", base64: pdf.toString("base64") } }));
    await responseJson(await api.post(`${base}/provided-files`, { data: { fileName: "starter.h", mimeType: "text/plain", base64: Buffer.from("int sum(int a, int b);\n").toString("base64") } }));
    await responseJson(await api.put(`${base}/teacher-solution`, { data: { fileName: "main.c", base64: Buffer.from("int sum(int a, int b) { return a + b; }").toString("base64") } }));
    const requirements = { requiredFiles: [{ path: "main.c" }], requiredFunctions: [{ name: "sum", filePath: "main.c", returnType: "int", parameterTypes: ["int", "int"] }] };
    await responseJson(await api.post(`${base}/requirements-upload`, { data: { fileName: "requirements.json", base64: Buffer.from(JSON.stringify(requirements)).toString("base64") } }));
    const authored = await responseJson<{ assignment: Record<string, unknown>; requirements: { requirements: object } }>(await api.get(`${base}/authoring`));
    await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...authored.assignment, promptMarkdown: "Implement sum.",
      questionCount: 2, candidateLimit: 7, retrievedExampleCount: 2, generationInstructions: "Ask short questions about parameter values.", settings: { authoringOption: "retained" } }, requirements: authored.requirements.requirements } }));
    const embeddingAi = { connectionId: model.connection.id, model: "chosen-vectors" };
    const questionGenerationAi = { connectionId: model.connection.id, model: "chosen-questions" };
    await responseJson(await api.put(`${course}/material-embedding-settings`, { data: { selection: embeddingAi } }));
    await responseJson(await api.put(`${base}/workflow-settings`, { data: { selected: [resource.id], concurrency: 3, questionGenerationAi } }));
    await responseJson(await api.post(`${base}/prepare-material`, { data: { resourceId: resource.id } }));
    await responseJson(await api.post(`${base}/prepare-references`, { data: {} }));
    await responseJson(await api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    await responseJson(await api.post(`${course}/activities/${id}/assign-all-groups`, { data: {
      assessmentMode: "summative", availableUntil: new Date(Date.now() + 86_400_000).toISOString(), timeLimitMinutes: 30,
      gradebookSettings: { pointsPossible: 100, maxAttempts: 1, attemptLimitMode: "max_attempts" }
    } }));

    // Real retained student work and a grade on the source must not follow its authoring copy.
    const studentBase = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    await responseJson(await student.post(`${studentBase}/preparation`, { data: { kind: "file", fileName: "main.c", path: "main.c", expectedRevision: 0,
      base64: Buffer.from("int sum(int a, int b) { return a + b; }").toString("base64") } }));
    await responseJson(await student.post(`${studentBase}/hand-in`, { data: { expectedRevision: 1 } }));
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${studentBase}/workspace`))).submission.status, { timeout: 40_000 }).toBe("challenge_ready");
    const answering = await responseJson<{ submissionId: string; questions: Array<{ id: string }> }>(await student.post(`${studentBase}/answering`, { data: {} }));
    await responseJson(await student.post(`${studentBase}/challenge-answers`, { data: { submissionId: answering.submissionId,
      answers: answering.questions.map(q => ({ questionId: q.id, answer: "The return expression adds the two parameter values." })) } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: id } });
    await responseJson(await api.patch(`${course}/gradebook/items/${attempt.gradebookItemId}/participants/${attempt.participantId}/override`, {
      data: { score: 80, maxScore: 100, reason: "Reviewed source homework", expectedGradeUpdatedAt: null }
    }));
    const sourceAssignment = await homeworkDb.pluginCodingHomeworkAssignment.findUniqueOrThrow({ where: { activityId: id } });
    const sourceSettings = sourceAssignment.settings as Record<string, unknown>;
    const sourceSnapshot = await homeworkDb.pluginCodingHomeworkDocumentationSnapshot.findUniqueOrThrow({ where: { id: sourceSettings.preparedSnapshotId as string } });
    const sourceSolution = await responseJson<{ files: object[]; functions: object[] }>(await api.get(`${base}/teacher-solution`));
    const modelCalls = model.requests.length;

    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Duplicate", exact: true }) });
    const copyTitle = "Independent homework copy";
    await dialog.getByRole("textbox").fill(copyTitle);
    const copiedResponse = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/activities/${id}/duplicate`));
    await dialog.getByRole("button", { name: "Duplicate", exact: true }).click();
    const response = await copiedResponse;
    expect(response.ok()).toBe(true);
    const { activity: copy } = await response.json();
    created.push(copy.id);
    await expect(dialog).toBeHidden();
    expect(copy).toMatchObject({ lifecycle: "draft", description: "Explain your implementation.", config: { languageKey: "c" } });
    expect(copy.metadata.allGroupsAssignment).toBeUndefined();
    const copyBase = `${course}/activities/${copy.id}/coding-homework-grader`;
    const copiedAssignment = await homeworkDb.pluginCodingHomeworkAssignment.findUniqueOrThrow({ where: { activityId: copy.id } });
    const copiedSettings = copiedAssignment.settings as Record<string, unknown>;
    expect(copiedAssignment).toMatchObject({ promptMarkdown: sourceAssignment.promptMarkdown, questionCount: 2, candidateLimit: 7, retrievedExampleCount: 2, generationInstructions: sourceAssignment.generationInstructions });
    expect(copiedSettings).toEqual({ ...sourceSettings, submissionsEnabled: false, preparedSnapshotId: expect.any(String) });
    expect(copiedSettings.preparedSnapshotId).not.toBe(sourceSnapshot.id);
    const copiedSnapshot = await homeworkDb.pluginCodingHomeworkDocumentationSnapshot.findUniqueOrThrow({ where: { id: copiedSettings.preparedSnapshotId as string } });
    expect(copiedSnapshot).toMatchObject({ activityId: copy.id, courseId: data.courseId, groupId: null, status: "ready", metadata: sourceSnapshot.metadata });
    expect(model.requests).toHaveLength(modelCalls);
    expect(await responseJson(await api.get(`${copyBase}/teacher-solution`))).toMatchObject({ files: sourceSolution.files, functions: sourceSolution.functions, locked: false });
    const copiedAuthoring = await responseJson<{ assignmentPdf: { id: string }; providedFiles: Array<{ id: string }>; requirements: { requirements: object }; requirementsUpload: { id: string } }>(await api.get(`${copyBase}/authoring`));
    expect(copiedAuthoring.requirements.requirements).toEqual(authored.requirements.requirements);
    expect(copiedAuthoring.requirementsUpload.id).not.toBe((await homeworkDb.pluginCodingHomeworkSubmissionRequirementSet.findUniqueOrThrow({ where: { activityId: id } })).sourceAttachmentId);
    expect(copiedAuthoring.assignmentPdf.id).not.toBe(sourceAssignment.promptPdfAttachmentId);
    const copiedPdf = await api.get(`${copyBase}/activity-file?attachmentId=${copiedAuthoring.assignmentPdf.id}`);
    expect(copiedPdf.ok()).toBe(true); expect(await copiedPdf.body()).toEqual(pdf);
    expect(await prisma.courseGroupActivity.count({ where: { activityId: copy.id } })).toBe(0);
    expect(await prisma.activityAttempt.count({ where: { activityId: copy.id } })).toBe(0);
    expect(await prisma.gradebookItem.count({ where: { activityId: copy.id } })).toBe(0);
    expect(await homeworkDb.pluginCodingHomeworkDraft.count({ where: { activityId: copy.id } })).toBe(0);
    expect(await homeworkDb.pluginCodingHomeworkSubmission.count({ where: { activityId: copy.id } })).toBe(0);
    expect(await prisma.grade.count({ where: { gradebookItemId: attempt.gradebookItemId } })).toBe(1);

    // Source deletion must not remove the copied attachment or prepared snapshot.
    await responseJson(await api.delete(`${course}/activities/${id}?confirmRecordedAttempts=true`));
    expect(await homeworkDb.pluginCodingHomeworkDocumentationSnapshot.findUnique({ where: { id: sourceSnapshot.id } })).toBeNull();
    await page.goto(`/courses/${data.courseId}/activities/${copy.id}`);
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Shared C reference", exact: true })).toBeChecked();
    await expect(page.locator(".activity-reference-materials")).toContainText("chosen-vectors");
    await openHomeworkEditorSection(page, "Question Generation");
    await expect(page.locator(".homework-workflow-questions").getByLabel("Model", { exact: true })).toHaveValue("chosen-questions");
    await expect(page.getByLabel("Students processed at once (1–4)")).toHaveValue("3");
    await openHomeworkEditorSection(page, "Submission");
    await expect(page.getByRole("switch", { name: "Accept final submissions", exact: true })).toBeEnabled();
    const opened = page.waitForResponse(response => response.request().method() === "PUT" && response.url().endsWith("/workflow-settings"));
    await page.getByRole("switch", { name: "Accept final submissions", exact: true }).click();
    expect((await opened).ok()).toBe(true);
    await expect(page.getByRole("switch", { name: "Accept final submissions", exact: true })).toBeChecked();
    expect(model.requests).toHaveLength(modelCalls);
    expect(await homeworkDb.pluginCodingHomeworkDocumentationSnapshot.findUnique({ where: { id: copiedSnapshot.id } })).not.toBeNull();
    const provided = await api.get(`${copyBase}/activity-file?attachmentId=${copiedAuthoring.providedFiles[0].id}`);
    expect(provided.ok()).toBe(true); expect(await provided.text()).toBe("int sum(int a, int b);\n");
  } finally {
    for (const activityId of created) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    for (const activityId of created) {
      if (await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true } })) {
        await responseJson(await api.delete(`${course}/activities/${activityId}?confirmRecordedAttempts=true`));
      }
    }
    await page.close(); await student.dispose(); await model.close();
  }
});

test("an unsaved homework copy keeps the source's default materials rather than adopting later materials", async ({ bankCourse: data, teacherApi: api }) => {
  await ensureContentTypePluginEnabled("text-content");
  const course = `/api/courses/${data.courseId}`;
  const { resource } = await responseJson<{ resource: { id: string } }>(await api.post(`${course}/content-resources`, { data: { contentTypeKey: "text", payload: { title: "Earlier material", body: "C functions return values." }, isVisible: true } }));
  const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Unsaved reference defaults", config: {} });
  const placement = await prisma.courseContentItem.findFirstOrThrow({ where: { activityId: id, groupId: null } });
  const before = await prisma.courseContentItem.findFirstOrThrow({ where: { contentResourceId: resource.id, groupId: null } });
  await prisma.courseContentItem.update({ where: { id: before.id }, data: { position: 0 } });
  await prisma.courseContentItem.update({ where: { id: placement.id }, data: { position: 1 } });
  const { resource: later } = await responseJson<{ resource: { id: string } }>(await api.post(`${course}/content-resources`, { data: { contentTypeKey: "text", payload: { title: "Later material", body: "This material was not selected by the source homework." }, isVisible: true } }));
  const { activity: copy } = await responseJson<{ activity: { id: string } }>(await api.post(`${course}/activities/${id}/duplicate`, { data: { title: "Unsaved default copy", contentItemId: placement.id } }));
  const current = await responseJson<{ selected: string[]; prepared: boolean; enabled: boolean }>(await api.get(`${course}/activities/${copy.id}/coding-homework-grader/workflow-settings`));
  expect(current).toMatchObject({ selected: [resource.id], prepared: false, enabled: false });
  expect(current.selected).not.toContain(later.id);
});
