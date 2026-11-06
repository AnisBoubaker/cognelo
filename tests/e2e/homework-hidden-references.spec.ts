import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";
import { homeworkModelFixture } from "./fixtures/homework-model";

type Settings = { selected: string[]; prepared: boolean; rows: Array<{ id: string; resourceId: string | null; hidden: boolean }> };
test("hidden references start unchecked, can be prepared explicitly, and stay private during generation", async ({ bankCourse: data, browser }) => {
  test.setTimeout(120_000);
  await ensureContentTypePluginEnabled("text-content");
  const model = await homeworkModelFixture(data), api = model.api, page = await model.page(browser), student = await createAuthenticatedApi("student"); let activityId: string | undefined;
  try {
    const course = `/api/courses/${data.courseId}`;
    const create = async (title: string, body: string, position: number, isVisible: boolean, parentId?: string) => (await responseJson<{ resource: { id: string } }>(await api.post(`${course}/content-resources`, { data: { contentTypeKey: "text", payload: { title, body }, position, isVisible, ...(parentId ? { parentId } : {}) } }))).resource;
    const visible = await create("Visible lesson", "VISIBLE_LESSON: C functions take typed parameters.", 1, true);
    const hidden = await create("Hidden instructor note", "PRIVATE_DIRECT_REFERENCE: Explain the return value of a small C function.", 2, false);
    const { contentItem: folder } = await responseJson<{ contentItem: { id: string } }>(await api.post(`${course}/content/folders`, { data: { title: "Hidden instructor folder", position: 3, isVisible: false } }));
    const child = await create("Note inside hidden folder", "PRIVATE_FOLDER_REFERENCE: Relate a function's arguments to its arithmetic return expression.", 0, true, folder.id);
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Hidden reference homework", config: {} });
    const { contentItems } = await responseJson<{ contentItems: Array<{ id: string; activityId: string | null }> }>(await api.get(`${course}/content`));
    const placement = contentItems.find(item => item.activityId === activityId)!;
    await responseJson(await api.patch(`${course}/content/${placement.id}`, { data: { position: 100, isVisible: false } }));
    const later = await create("Later visible lesson", "LATER_VISIBLE_REFERENCE: A topic not yet taught.", 200, true);
    const base = `${course}/activities/${activityId}/coding-homework-grader`;
    const initial = await responseJson<Settings>(await api.get(`${base}/workflow-settings`));
    expect(initial.selected).toEqual([visible.id]);
    expect(initial.rows.find(row => row.resourceId === hidden.id)?.hidden).toBe(true);
    expect(initial.rows.find(row => row.resourceId === child.id)?.hidden).toBe(true);
    expect(initial.rows.find(row => row.resourceId === later.id)?.hidden).toBe(false);
    await page.goto(`/courses/${data.courseId}/activities/${activityId}`);
    await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    const picker = page.locator(".homework-reference-materials");
    await expect(picker.getByRole("checkbox", { name: "Visible lesson", exact: true })).toBeChecked();
    for (const title of ["Hidden instructor note", "Hidden instructor folder", "Note inside hidden folder", "Later visible lesson"]) await expect(picker.getByRole("checkbox", { name: title, exact: true })).not.toBeChecked();
    await expect(picker.getByText("Hidden from students", { exact: false })).toHaveCount(3);
    await picker.getByRole("checkbox", { name: "Hidden instructor folder", exact: true }).check();
    await expect(picker.getByRole("checkbox", { name: "Note inside hidden folder", exact: true })).toBeChecked();
    await picker.getByRole("checkbox", { name: "Hidden instructor note", exact: true }).check();
    await picker.screenshot({ path: "tmp/homework-hidden-references.png" });
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Generate embeddings", exact: true }).click();
    await expect(page.getByText("Reference selection is prepared.", { exact: true })).toBeVisible();
    const prepared = await responseJson<Settings>(await api.get(`${base}/workflow-settings`));
    expect(prepared.prepared).toBe(true); expect(prepared.selected.sort()).toEqual([visible.id, hidden.id, child.id].sort());
    const [snapshot] = await prisma.$queryRaw<Array<{ metadata: { preparedByUserId: string; hiddenReferenceIndexIds: string[] } }>>`SELECT s.metadata FROM "PluginCodingHomeworkDocumentationSnapshot" s JOIN "PluginCodingHomeworkAssignment" a ON a.settings->>'preparedSnapshotId'=s.id WHERE a."activityId"=${activityId}`;
    expect(snapshot.metadata.hiddenReferenceIndexIds).toHaveLength(2); expect(snapshot.metadata.preparedByUserId).toBeTruthy();
    expect(model.embeddingTexts.some(text => text.includes("PRIVATE_DIRECT_REFERENCE"))).toBe(true);
    expect(model.embeddingTexts.some(text => text.includes("PRIVATE_FOLDER_REFERENCE"))).toBe(true);
    expect(model.embeddingTexts.some(text => text.includes("LATER_VISIBLE_REFERENCE"))).toBe(false);
    await page.reload(); await page.getByRole("tab", { name: "Reference materials", exact: true }).click();
    await expect(picker.getByRole("checkbox", { name: "Hidden instructor note", exact: true })).toBeChecked();
    await expect(picker.getByRole("checkbox", { name: "Note inside hidden folder", exact: true })).toBeChecked();
    // Selection never changes learner visibility or grants direct access to hidden documents.
    for (const id of [hidden.id, child.id]) expect((await student.get(`${course}/groups/${data.groupId}/content-resources/${id}`)).status()).toBe(404);
    expect(JSON.stringify(await responseJson(await student.get(`${course}/groups/${data.groupId}/content`)))).not.toMatch(/PRIVATE_DIRECT_REFERENCE|PRIVATE_FOLDER_REFERENCE|Hidden instructor note|Note inside hidden folder/);
    await responseJson(await api.patch(`${course}/content/${placement.id}`, { data: { isVisible: true } }));
    await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId, metadata: { assessmentMode: "summative" } } }));
    await responseJson(await api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${activityId}/coding-homework-grader`;
    expect((await student.get(`${endpoint}/workflow-settings`)).status()).toBe(403);
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int a, int b) { return a + b; }").toString("base64") } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    await expect.poll(async () => {
      const state = await responseJson<{ submission: { status: string } }>(await student.get(`${endpoint}/workspace`));
      if (state.submission.status === "failed") {
        const result = await responseJson<{ submissions: Array<{ processingError: string | null }> }>(await api.get(`${base}/manage-submissions`));
        throw new Error(result.submissions[0]?.processingError ?? "Question generation failed.");
      }
      return state.submission.status;
    }, { timeout: 45_000 }).toBe("challenge_ready");
    const prompts = model.requests.filter(request => request.userPrompt?.includes("submittedCode")).map(request => request.userPrompt!);
    expect(prompts.some(prompt => prompt.includes("PRIVATE_DIRECT_REFERENCE"))).toBe(true);
    expect(prompts.some(prompt => prompt.includes("PRIVATE_FOLDER_REFERENCE"))).toBe(true);
    const answers = await responseJson(await student.post(`${endpoint}/answering`, { data: {} }));
    expect(JSON.stringify(answers)).not.toMatch(/PRIVATE_DIRECT_REFERENCE|PRIVATE_FOLDER_REFERENCE|hiddenReferenceIndexIds|preparedByUserId/);
    expect((await student.get(`${course}/groups/${data.groupId}/content-resources/${hidden.id}`)).status()).toBe(404);
  } finally {
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await page.close(); await student.dispose(); await model.close();
  }
});
