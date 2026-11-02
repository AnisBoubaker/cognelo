import { textPdf } from "./fixtures/pdf";
import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";
import { homeworkModelFixture } from "./fixtures/homework-model";
import { githubMaterialIndexing } from "../../packages/plugin-content-types/plugin-github-repo/src/indexing";


test("PDF text is embedded once across homework and GitHub freshness gates enablement only", async ({ bankCourse: data, teacherApi }) => {
  test.setTimeout(120_000);
  for (const plugin of ["file-content", "github-repo-content"]) await ensureContentTypePluginEnabled(plugin);
  const model = await homeworkModelFixture(data.token);
  try {
    const { resource: file } = await responseJson<{ resource: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/content-resources`, { data: { contentTypeKey: "file", payload: { title: "PDF lecture" }, isVisible: true } }));
    await responseJson(await teacherApi.put(`/api/courses/${data.courseId}/content-resources/${file.id}/upload`, { multipart: { file: { name: "lecture.pdf", mimeType: "application/pdf", buffer: textPdf("POINTER_SENTINEL: C arrays decay to pointers in function parameters.") } } }));
    let firstIndexId = "";
    for (const index of [1, 2]) {
      const activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: `PDF homework ${index}`, config: {} });
      const base = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
      await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { selected: [file.id] } }));
      const result = await responseJson<{ id: string }>(await teacherApi.post(`${base}/prepare-material`, { data: { resourceId: file.id } }));
      if (index === 1) firstIndexId = result.id; else expect(result.id).toBe(firstIndexId);
      await responseJson(await teacherApi.post(`${base}/prepare-references`, { data: {} }));
    }
    expect(model.embeddingTexts).toHaveLength(1); expect(model.embeddingTexts[0]).toContain("POINTER_SENTINEL");
    const { resource: repo } = await responseJson<{ resource: { id: string; courseId: string; title: string; metadata: Record<string, unknown>; contentTypeKey: string; pluginKey: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/content-resources`, { data: { contentTypeKey: "github-repo", payload: { title: "Public teaching repo", url: "https://github.com/example/teaching" }, isVisible: true } }));
    expect(repo.metadata.embeddingFreshnessHours).toBe(48);
    const sourceIndex = await prisma.contentMaterialIndex.findUniqueOrThrow({ where: { id: firstIndexId } });
    // Synthetic prepared GitHub corpus isolates the clock policy from network availability.
    const prepared = await prisma.contentMaterialIndex.create({ data: { courseId: data.courseId, resourceId: repo.id, sourceId: repo.id, connectionId: model.connection.id,
      modelKey: sourceIndex.modelKey, contentFingerprint: "synthetic-github-corpus", sourceRevision: githubMaterialIndexing.policy(repo).revision, documents: sourceIndex.documents as object } });
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Repository homework", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { selected: [repo.id] } }));
    await responseJson(await teacherApi.post(`${base}/prepare-references`, { data: {} }));
    await prisma.contentMaterialIndex.update({ where: { id: prepared.id }, data: { checkedAt: new Date(Date.now() - 49 * 3600_000) } });
    expect((await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } })).status()).toBe(409);
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/content-resources/${repo.id}`, { data: { payload: { embeddingFreshnessHours: 72 } } }));
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    await prisma.contentMaterialIndex.update({ where: { id: prepared.id }, data: { checkedAt: new Date(Date.now() - 100 * 3600_000) } });
    expect(await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } }))).toMatchObject({ enabled: true });
    expect(model.embeddingTexts).toHaveLength(1);
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: false } }));
    expect((await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } })).status()).toBe(409);
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { selected: [file.id] } }));
    expect((await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } })).status()).toBe(409);
  } finally { await model.close(); }
});
