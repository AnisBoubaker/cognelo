import { prisma } from "@cognelo/db";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("question activation rejects section-hidden references in UI, section assignments and exceptions before releasing files", async ({ bankCourse: data, browser, teacherApi }, testInfo) => {
  test.setTimeout(150_000);
  await ensureContentTypePluginEnabled("text-content");
  const model = await homeworkModelFixture(data), api = model.api, page = await model.page(browser), student = await createAuthenticatedApi("student");
  let activityId: string | undefined;
  try {
    const course = `/api/courses/${data.courseId}`, materialTitle = "Prepared C reference";
    const { resource, contentItem } = await responseJson<{ resource: { id: string }; contentItem: { id: string } }>(await api.post(`${course}/content-resources`, { data: { contentTypeKey: "text", payload: { title: materialTitle, body: "C functions return values computed from typed arguments." }, position: 0, isVisible: true } }));
    const title = "Question readiness guard";
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title, config: {} });
    const base = `${course}/activities/${activityId}`, references = `${base}/material-references`, settingsPath = `${base}/assign-all-groups`;
    const read = async () => (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsPath))).settings;
    const save = async (patch: object) => { const settings = await read(); return api.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", groupAssignments: settings.groups, confirmActiveStudents: true, ...patch } }); };
    await responseJson(await api.put(references, { data: { selected: [resource.id] } }));
    await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId, metadata: { assessmentMode: "summative", submissionStages: { files: { enabled: true } } } } }));
    const unprepared = await save({ submissionStages: { files: { enabled: true }, questions: { enabled: true } }, groupAssignments: (await read()).groups.map(group => ({ ...group, submissionStages: { questions: { enabled: true } } })) });
    expect(unprepared.status()).toBe(409); expect(await unprepared.json()).toMatchObject({ error: { code: "HOMEWORK_EMBEDDINGS_REQUIRED", message: expect.stringContaining(materialTitle) } });
    await responseJson(await api.post(`${references}/prepare-material`, { data: { resourceId: resource.id } }));
    await responseJson(await api.post(`${references}/prepare`, { data: {} }));
    await responseJson(await save({}));
    const requests = model.requests.length;
    const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${activityId}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int a, int b) { return a + b; }\n").toString("base64") } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    const [handIn] = await prisma.$queryRaw<Array<{ id: string; metadata: unknown }>>`SELECT id,metadata FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${activityId} AND kind='final'`;
    const files = await prisma.$queryRaw<Array<{ path: string; sha256: string }>>`SELECT path,sha256 FROM "PluginCodingHomeworkSubmissionFile" WHERE "submissionId"=${handIn.id}`;
    await responseJson(await api.patch(`${course}/groups/${data.groupId}/content/${contentItem.id}`, { data: { isVisible: false } }));
    // Root readiness still says prepared: this reproduces a course-visible, section-hidden snapshot.
    expect(await responseJson(await api.get(references))).toMatchObject({ prepared: true });
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${activityId}?settings=1`);
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await dialog.getByRole("switch", { name: "Questions answering — Activate stage", exact: true }).check();
    const rejected = page.waitForResponse(response => response.url().endsWith(settingsPath) && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    expect((await rejected).status()).toBe(409);
    await expect(dialog).toBeVisible();
    const error = dialog.getByRole("alert");
    await expect(error).toContainText(materialTitle);
    await expect(error).toContainText(data.groupTitle);
    await expect(error).toBeFocused();
    await expect(error).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath("activation-error-desktop.png") });
    // A retry from the top must reveal the same error again on a narrow screen.
    await page.setViewportSize({ width: 390, height: 844 });
    await dialog.locator(".activity-settings-content").evaluate(element => { element.scrollTop = 0; });
    await expect(error).not.toBeInViewport();
    const repeated = page.waitForResponse(response => response.url().endsWith(settingsPath) && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
    expect((await repeated).status()).toBe(409);
    await expect(error).toBeFocused();
    await expect(error).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath("activation-error-mobile.png") });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.setViewportSize({ width: 1280, height: 720 });
    expect((await read()).general.submissionStages?.questions.enabled).toBe(false);
    expect((await read()).groups.find(group => group.groupId === data.groupId)?.submissionStages?.questions?.enabled ?? false).toBe(false);
    expect(model.requests).toHaveLength(requests);
    expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(0);
    expect(await prisma.backgroundJob.count({ where: { idempotencyKey: `submission:${handIn.id}` } })).toBe(0);
    expect(await prisma.$queryRaw`SELECT path,sha256 FROM "PluginCodingHomeworkSubmissionFile" WHERE "submissionId"=${handIn.id}`).toEqual(files);
    expect((await prisma.$queryRaw<Array<{ metadata: unknown }>>`SELECT metadata FROM "PluginCodingHomeworkSubmission" WHERE id=${handIn.id}`)[0].metadata).toEqual(handIn.metadata);

    // Reconstruct a retained pre-activation snapshot only in this disposable hand-in.
    const [frozen] = await prisma.$queryRaw<Array<{ snapshotId: string }>>`SELECT settings->>'preparedSnapshotId' AS "snapshotId" FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${activityId}`;
    await prisma.$executeRaw`UPDATE "PluginCodingHomeworkSubmission" SET "documentationSnapshotId"=${frozen.snapshotId} WHERE id=${handIn.id}`;
    await responseJson(await api.put(references, { data: { selected: [] } }));
    await responseJson(await api.post(`${references}/prepare`, { data: {} }));
    const retained = await save({ submissionStages: { questions: { enabled: true } } });
    expect(retained.status()).toBe(409);
    const retainedError = await retained.json();
    expect(retainedError).toMatchObject({ error: { code: "ACTIVITY_REFERENCE_ACCESS_REQUIRED", message: expect.stringContaining(materialTitle) } });
    expect(retainedError.error.message).toContain("Reset question generation for all students");
    expect(await prisma.backgroundJob.count({ where: { idempotencyKey: `submission:${handIn.id}` } })).toBe(0);
    expect(model.requests).toHaveLength(requests);
    await responseJson(await api.put(references, { data: { selected: [resource.id] } }));
    await responseJson(await api.post(`${references}/prepare`, { data: {} }));

    const sectionActivity = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Section activation guard", config: {} });
    const sectionReferences = `${course}/activities/${sectionActivity}/material-references`;
    await responseJson(await api.put(sectionReferences, { data: { selected: [resource.id] } }));
    await responseJson(await api.post(`${sectionReferences}/prepare`, { data: {} }));
    const { assignment } = await responseJson<{ assignment: { id: string; metadata: object } }>(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: sectionActivity, metadata: { assessmentMode: "summative" } } }));
    const direct = await api.patch(`${course}/groups/${data.groupId}/activities/${assignment.id}`, { data: { metadata: { ...assignment.metadata, submissionStages: { questions: { enabled: true } } } } });
    expect(direct.status()).toBe(409); expect(await direct.json()).toMatchObject({ error: { code: "ACTIVITY_REFERENCE_ACCESS_REQUIRED" } });
    const legacy = await api.put(`${course}/activities/${sectionActivity}/coding-homework-grader/workflow-settings`, { data: { enabled: true } });
    expect(legacy.status()).toBe(409); expect(await legacy.json()).toMatchObject({ error: { code: "ACTIVITY_REFERENCE_ACCESS_REQUIRED" } });
    const participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, role: "student" } });
    const exceptions = await save({ groupAssignments: (await read()).groups.map(group => ({ ...group, exceptions: [{ participantId: participant.id, submissionStages: { questions: { enabled: true } } }] })) });
    expect(exceptions.status()).toBe(409); expect(await exceptions.json()).toMatchObject({ error: { code: "ACTIVITY_REFERENCE_ACCESS_REQUIRED" } });
    // Closing/editing closed stages remains possible; correcting visibility then opens the waiting work.
    await responseJson(await save({ submissionStages: { questions: { enabled: false } } }));
    await responseJson(await api.patch(`${course}/groups/${data.groupId}/content/${contentItem.id}`, { data: { isVisible: true } }));
    await responseJson(await save({ submissionStages: { questions: { enabled: true } }, groupAssignments: (await read()).groups.map(group => ({ ...group, submissionStages: { questions: { enabled: true } } })) }));
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${endpoint}/workspace`))).submission.status, { timeout: 45_000 }).toBe("challenge_ready");

    // Adding an empty section must recheck an already-locked snapshot before it inherits activation.
    const { group: empty } = await responseJson<{ group: { id: string } }>(await teacherApi.post(`${course}/groups`, { data: { title: "Empty blocked section", status: "published" } }));
    await responseJson(await api.patch(`${course}/groups/${empty.id}/content/${contentItem.id}`, { data: { isVisible: false } }));
    const added = await api.post(`${course}/groups/${empty.id}/activities`, { data: { activityId, metadata: { assessmentMode: "summative" } } });
    expect(added.status()).toBe(409); expect(await added.json()).toMatchObject({ error: { code: "ACTIVITY_REFERENCE_ACCESS_REQUIRED", message: expect.stringContaining("Empty blocked section") } });
    expect(await prisma.courseGroupActivity.count({ where: { activityId, groupId: empty.id } })).toBe(0);
    await responseJson(await api.post(`${course}/groups/${empty.id}/activities`, { data: { activityId, metadata: { assessmentMode: "summative", submissionStages: { questions: { enabled: false } } } } }));
    expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(0);
  } finally {
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await page.close(); await student.dispose(); await model.close();
  }
});

test("question activation checks actual stored reference vectors without making an AI request", async ({ bankCourse: data }) => {
  await ensureContentTypePluginEnabled("text-content");
  const model = await homeworkModelFixture(data), api = model.api;
  try {
    const course = `/api/courses/${data.courseId}`;
    const { resource } = await responseJson<{ resource: { id: string } }>(await api.post(`${course}/content-resources`, { data: { contentTypeKey: "text", payload: { title: "Vector integrity reference", body: "A C function computes a result from its arguments." } } }));
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Vector readiness", config: {} }), base = `${course}/activities/${id}/material-references`;
    await responseJson(await api.put(base, { data: { selected: [resource.id] } }));
    await responseJson(await api.post(`${base}/prepare-material`, { data: { resourceId: resource.id } }));
    await responseJson(await api.post(`${base}/prepare`, { data: {} }));
    const index = await prisma.contentMaterialIndex.findFirstOrThrow({ where: { resourceId: resource.id } });
    const vectorId = (index.documents as Array<{ vectorId: string }>)[0].vectorId;
    await prisma.contentMaterialVector.delete({ where: { id: vectorId } });
    const requests = model.requests.length;
    const activation = await api.put(`${course}/activities/${id}/coding-homework-grader/workflow-settings`, { data: { enabled: true } });
    expect(activation.status()).toBe(409); expect(await activation.json()).toMatchObject({ error: { code: "EMBEDDING_INDEX_INCOMPATIBLE" } });
    expect(model.requests).toHaveLength(requests);
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
    expect((await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(`${course}/activities/${id}/assign-all-groups`))).settings.general.submissionStages?.questions.enabled).toBe(false);
  } finally { await model.close(); }
});
