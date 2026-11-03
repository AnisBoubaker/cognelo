import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createStoredZip } from "./fixtures/zip";

test("homework preparation persists files, replaces ZIPs, validates signatures, and stays outside SEB/timing", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Prepared C homework", config: {} });
    const authoring = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    await responseJson(await teacherApi.put(`${authoring}/teacher-solution`, { data: { fileName: "solution.c", base64: Buffer.from("int add(int values[], int n) { return n; }").toString("base64") } }));
    const solution = await responseJson<{ functions: Array<{ functionName: string; signature: { returnType: string; parameterTypes: string[] } }> }>(await teacherApi.get(`${authoring}/teacher-solution`));
    expect(solution.functions[0]).toMatchObject({ functionName: "add", signature: { returnType: "int", parameterTypes: ["int*", "int"] } });
    const current = await responseJson<{ assignment: Record<string, unknown> }>(await teacherApi.get(`${authoring}/authoring`));
    await responseJson(await teacherApi.put(`${authoring}/authoring`, { data: { assignment: current.assignment, requirements: {
      requiredFiles: [{ path: "src/main.c" }], requiredFunctions: [{ name: "add", returnType: "int", parameterTypes: ["int*", "int"] }]
    } } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: {
      activityId, availableFrom: null, availableUntil: null, metadata: { assessmentMode: "summative", requireSafeExamBrowser: true, timeLimitMinutes: 20 },
      config: {}, gradebookSettings: { pointsPossible: 100, maxAttempts: 1, attemptLimitMode: "max_attempts", gradeStrategy: "latest" }
    } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const preparation = `${assigned}/coding-homework-grader/preparation`;
    const initial = await responseJson<{ draft: { revision: number; files: unknown[] } }>(await student.get(preparation));
    expect(initial.draft).toMatchObject({ revision: 0, files: [] });
    expect((await student.get(`${assigned}/coding-homework-grader/teacher-solution`)).status()).toBe(403);
    const first = await responseJson<{ draft: { revision: number; files: Array<{ path: string }> }; readiness: { canSubmit: boolean; requiresAcknowledgement: boolean } }>(await student.post(preparation, { data: {
      kind: "file", path: "src/main.c", fileName: "main.c", base64: Buffer.from("int add(int *data, int length) { return length; }").toString("base64"), expectedRevision: 0
    } }));
    expect(first.draft.files).toEqual([expect.objectContaining({ path: "src/main.c" })]);
    expect(first.readiness).toMatchObject({ canSubmit: true, requiresAcknowledgement: false });
    expect((await student.post(preparation, { data: { kind: "file", path: "src/main.c", base64: Buffer.from("int main(void) { return 0; }").toString("base64"), expectedRevision: first.draft.revision } })).status()).toBe(409);
    expect((await student.post(preparation, { data: { kind: "file", path: "../escape.c", base64: "YQ==", expectedRevision: first.draft.revision } })).status()).toBe(400);
    const zip = createStoredZip([{ path: "replacement.c", contents: "int add(double value) { return 0; }" }]);
    const replacement = await responseJson<{ draft: { revision: number; files: Array<{ path: string }> }; readiness: { canSubmit: boolean; requiresAcknowledgement: boolean } }>(await student.post(preparation, { data: {
      kind: "zip", fileName: "submission.zip", base64: zip.toString("base64"), expectedRevision: first.draft.revision, replace: true
    } }));
    expect(replacement.draft.files.map(file => file.path)).toEqual(["replacement.c"]);
    expect(replacement.readiness).toMatchObject({ canSubmit: true, requiresAcknowledgement: true });
    expect(await responseJson(await student.get(preparation))).toMatchObject({ draft: replacement.draft });
    await responseJson(await student.delete(preparation, { data: { path: "replacement.c", expectedRevision: replacement.draft.revision } }));
    expect(await responseJson(await student.get(preparation))).toMatchObject({ draft: { files: [] } });
    await page.goto(assigned.replace(/^\/api/, ""));
    const fileUpload = page.locator('input[type="file"][multiple]');
    await expect(fileUpload).toBeEnabled();
    await expect(page.getByLabel("Destination folder (optional)", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create folder", exact: true })).toHaveCount(0);
    await fileUpload.setInputFiles({ name: "single.c", mimeType: "text/plain", buffer: Buffer.from("int single(void) { return 1; }") });
    await expect(page.getByText("single.c", { exact: true })).toBeVisible();
    expect(await responseJson(await student.get(preparation))).toMatchObject({ draft: { files: [expect.objectContaining({ path: "single.c" })] } });
    await page.locator('input[type="file"][accept=".zip"]').setInputFiles({ name: "nested.zip", mimeType: "application/zip", buffer: createStoredZip([
      { path: "starter/src/main.c", contents: "int add(int *data, int length) { return length; }" },
      { path: "starter/include/api.h", contents: "int add(int *data, int length);" }
    ]) });
    await page.getByRole("dialog", { name: "Replace existing files?", exact: true }).getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText("starter/src/main.c", { exact: true })).toBeVisible();
    await expect(page.getByText("single.c", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("starter/include/api.h", { exact: true })).toBeVisible();
    const nested = await responseJson<{ draft: { files: Array<{ path: string }> } }>(await student.get(preparation));
    expect(nested.draft.files.map(file => file.path).sort()).toEqual(["starter/include/api.h", "starter/src/main.c"]);
    expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(0);
    expect(await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${activityId}`).toEqual([{ count: 0n }]);
    expect(await responseJson(await student.get(`${assigned}/seb`))).toMatchObject({ access: { requiresSafeExamBrowser: true, preparationAllowed: true, accessGranted: false } });
    expect((await student.get(`${assigned}/timing`)).ok()).toBe(true);
  } finally { await student.dispose(); }
});
