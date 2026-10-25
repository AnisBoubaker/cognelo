import { generateAiAgentText } from "../../packages/core/src/ai-agents";
import { requestEmailVerification, verifyEmailAddress } from "../../packages/core/src/email-verification";
import { request } from "@playwright/test";
import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, API_BASE_URL, WEB_BASE_URL } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createStoredZip } from "./fixtures/zip";
import { prisma as homeworkDb } from "../../packages/plugin-activities/plugin-coding-homework-grader/src/db-client";
import { rateLimitKey } from "../../packages/core/src/rate-limits";
import { rm, access } from "node:fs/promises";
import path from "node:path";

test("hidden placements, files and other sections cannot be enumerated through alternate lists", async ({ bankCourse: data, teacherApi }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const id = await createCourseActivity(data, { activityTypeKey: "mcq", title: "Hidden confidential question", config: { source: "## Private\nChoose an answer.\n- [x] Alpha\n- [ ] Beta" } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, contentPlacement: { isVisible: false, parentId: null }, metadata: { assessmentMode: "summative" } } }));
    const placement = await prisma.courseContentItem.findFirstOrThrow({ where: { courseId: data.courseId, activityId: id, groupId: null } });
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/content/${placement.id}`, { data: { isVisible: false } }));
    const { material } = await responseJson<{ material: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/materials/upload`, { multipart: { title: "Hidden exam file", file: { name: "harmless.txt", mimeType: "text/plain", buffer: Buffer.from("Synthetic private content") } } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/content/materials`, { data: { materialId: material.id, isVisible: false, parentId: null } }));
    for (const endpoint of [
      `/api/courses/${data.courseId}/groups/${data.groupId}/content?visibleOnly=false`,
      `/api/courses/${data.courseId}/content?includeGroupItems=true&visibleOnly=false`,
      `/api/courses/${data.courseId}`, `/api/courses/${data.courseId}/materials`
    ]) {
      const body = await responseJson(await student.get(endpoint));
      expect(JSON.stringify(body)).not.toContain(id);
      expect(JSON.stringify(body)).not.toContain(material.id);
      expect(JSON.stringify(body)).not.toContain("Synthetic private content");
    }
    expect((await student.get(`/api/courses/${data.courseId}/materials/${material.id}/download`)).status()).toBe(404);
    expect((await teacherApi.get(`/api/courses/${data.courseId}/materials/${material.id}/download`)).ok()).toBe(true);
    const { group } = await responseJson<{ group: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/groups`, { data: { title: "Other section" } }));
    expect((await student.get(`/api/courses/${data.courseId}/groups/${group.id}/content?visibleOnly=false`)).status()).toBe(403);
    expect((await student.post(`/api/courses/${data.courseId}/materials/upload`, { data: "invalid multipart", headers: { "Content-Type": "multipart/form-data; boundary=x" } })).status()).toBe(403);
    expect((await teacherApi.put(`/api/courses/${data.courseId}/materials/missing/upload`, { data: "invalid multipart", headers: { "Content-Type": "multipart/form-data; boundary=x" } })).status()).toBe(404);
  } finally { await student.dispose(); await rm(path.join(process.cwd(), "storage/course-materials", data.courseId), { recursive: true, force: true }); }
});

test("homework reserves one workflow and finalizes answers atomically", async ({ bankCourse: data }) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student");
  let activityId: string | undefined;
  try {
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Atomic homework", config: { gradingMode: "manual", maxAttempts: 1 } });
    await assignCourseTest(data, activityId, "Atomic homework");
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}/coding-homework-grader`;
    expect((await student.post(`${assigned}/submission-analysis`, { data: {} })).status()).toBe(403);
    const base64 = createStoredZip([{ path: "main.c", contents: "int main(void) { return 0; }" }]).toString("base64");
    const preflight = await responseJson<{ preflight: { id: string; zipAttachmentId: string } }>(await student.post(`${assigned}/preflight`, { data: { base64, fileName: "preflight.zip" } }));
    const temporary = await homeworkDb.pluginCodingHomeworkAttachment.findUniqueOrThrow({ where: { id: preflight.preflight.zipAttachmentId } });
    await homeworkDb.pluginCodingHomeworkSubmission.update({ where: { id: preflight.preflight.id }, data: { metadata: { expiresAt: new Date(0).toISOString(), temporary: true } } });
    const responses = await Promise.all(Array.from({ length: 4 }, (_, index) => student.post(`${assigned}/submission`, { data: { base64, fileName: "submission.zip", idempotencyKey: `${data.token}-${index}` } })));
    const accepted = responses.filter((response) => response.ok());
    expect(accepted).toHaveLength(1);
    for (const response of responses.filter((response) => !response.ok())) expect([400, 409, 429]).toContain(response.status());
    const payload = await accepted[0].json();
    const submissionId: string = payload.submission.id;
    expect(payload.submission.coreAttemptId).toBeTruthy();
    expect(await homeworkDb.pluginCodingHomeworkSubmission.findUnique({ where: { id: preflight.preflight.id } })).toBeNull();
    await expect(access(path.join(process.cwd(), "storage/coding-homework-grader/preflight", temporary.storedName))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(1);
    expect(await homeworkDb.pluginCodingHomeworkSubmission.count({ where: { activityId, kind: "final" } })).toBe(1);
    // Let the real worker finish before exercising concurrent finalization. Inserting
    // questions while it is running races its replace-on-process question writes.
    await expect.poll(async () => {
      const jobs = await prisma.$queryRaw<Array<{ status: string }>>`SELECT status FROM "BackgroundJob" WHERE metadata->>'activityId' = ${activityId}`;
      return jobs[0]?.status;
    }, { timeout: 90_000, message: "Homework background processing must complete before answers are finalized" }).toBe("succeeded");
    const ready = await homeworkDb.pluginCodingHomeworkSubmission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(ready.status).toBe("challenge_ready");
    const metadata = ready.metadata && typeof ready.metadata === "object" && !Array.isArray(ready.metadata) ? ready.metadata : {};
    await homeworkDb.pluginCodingHomeworkSubmission.update({ where: { id: submissionId }, data: { metadata: { ...metadata, internalPrompt: "PRIVATE_ARTIFACT" } } });
    const questions = await homeworkDb.pluginCodingHomeworkChallengeQuestion.findMany({ where: { submissionId }, orderBy: { orderIndex: "asc" } });
    expect(questions.length).toBeGreaterThan(0);
    const answers = questions.map((question) => ({ questionId: question.id, answer: "The program returns zero." }));
    const finals = await Promise.all(Array.from({ length: 4 }, () => student.post(`${assigned}/challenge-answers`, { data: { submissionId, answers } })));
    for (const response of finals) expect(response.ok(), await response.text()).toBe(true);
    expect(await prisma.activityAttempt.count({ where: { activityId, lifecycle: "submitted" } })).toBe(1);
    expect((await student.put(`${assigned}/challenge-answers`, { data: { submissionId, answers: [{ questionId: questions[0].id, answer: "changed" }] } })).status()).toBe(409);
    const latest = await responseJson(await student.get(`${assigned}/submission`));
    expect(JSON.stringify(latest)).not.toContain("PRIVATE_ARTIFACT");
    expect((await student.post(`${assigned}/submission`, { data: { base64, fileName: "another.zip", idempotencyKey: `${data.token}-again` } })).ok()).toBe(false);
  } finally {
    if (activityId) await prisma.$executeRaw`DELETE FROM "BackgroundJob" WHERE metadata->>'activityId' = ${activityId}`;
    await student.dispose();
  }
});

test("login failures are generic and throttled, and cross-origin login is denied", async ({ bankCourse: data }) => {
  const client = await request.newContext({ baseURL: API_BASE_URL, extraHTTPHeaders: { Origin: WEB_BASE_URL } });
  const email = `${data.token}-unknown@example.test`;
  try {
    for (let index = 0; index < 10; index++) {
      const response = await client.post("/api/auth/login", { data: { email, password: "synthetic-invalid-password" } });
      expect(response.status()).toBe(401);
      expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    }
    const limited = await client.post("/api/auth/login", { data: { email, password: "synthetic-invalid-password" } });
    expect(limited.status()).toBe(429); expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
    expect((await client.post("/api/auth/login", { data: { email, password: "unused" }, headers: { Origin: "https://untrusted.example" } })).status()).toBe(403);
    expect((await client.post("/api/auth/login", { data: { email, password: "x".repeat(10_000) } })).status()).toBe(413);
  } finally { await prisma.rateLimitBucket.deleteMany({ where: { key: rateLimitKey("auth-login", email) } }); await client.dispose(); }
});

test("concurrent email guesses cannot exceed the challenge allowance", async ({ bankCourse: data }) => {
  const record = await prisma.user.create({ data: { email: `${data.token}-verification@example.test`, passwordHash: "not-a-password-hash", isActive: true } });
  const user = { id: record.id, email: record.email, roles: ["student" as const], name: null, firstName: null, lastName: null };
  try {
    await requestEmailVerification(user, { locale: "en" }, process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY, { generateCode: () => "123456", deliver: async () => ({}) });
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => verifyEmailAddress(user, { code: "000000" }, process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY)));
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect((await prisma.emailVerificationChallenge.findUniqueOrThrow({ where: { userId: record.id } })).failedAttempts).toBe(5);
    await expect(verifyEmailAddress(user, { code: "123456" }, process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY)).rejects.toMatchObject({ status: 429 });
  } finally { await prisma.user.delete({ where: { id: record.id } }); }
});

test("changing a password invalidates other sessions while renewing the changing session", async ({ bankCourse: data }) => {
  const bcrypt = (await import("bcryptjs")).default;
  const account = { email: `${data.token}-password@example.test`, password: "InitialPassword123!" };
  const user = await prisma.user.create({ data: { email: account.email, passwordHash: await bcrypt.hash(account.password, 4), emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } });
  const first = await createAuthenticatedApiWithCredentials(account);
  const second = await createAuthenticatedApiWithCredentials(account);
  try {
    await responseJson(await first.put("/api/users/me/password", { data: { currentPassword: account.password, newPassword: "ReplacementPassword123!", confirmNewPassword: "ReplacementPassword123!" } }));
    expect((await first.get("/api/users/me")).ok()).toBe(true);
    expect((await second.get("/api/users/me")).status()).toBe(401);
  } finally { await first.dispose(); await second.dispose(); await prisma.user.delete({ where: { id: user.id } }); }
});

test("model credentials are encrypted and personal endpoints cannot reach private addresses", async ({ bankCourse: data }) => {
  const student = await createAuthenticatedApi("student");
  let id: string | undefined;
  try {
    const result = await responseJson<{ connection: { id: string; hasApiKey: boolean } }>(await student.post("/api/ai-agents", { data: { displayName: `Security fixture ${data.token}`, provider: "openai", model: "test-model", baseUrl: "http://127.0.0.1:1", apiKey: "synthetic-provider-key", scope: "personal" } }));
    id = result.connection.id;
    expect(JSON.stringify(result)).not.toContain("synthetic-provider-key");
    const saved = await prisma.aiAgentConnection.findUniqueOrThrow({ where: { id } });
    expect(saved.apiKey).toMatch(/^ai-v1:/);
    await expect(generateAiAgentText(saved, { systemPrompt: "Test", userPrompt: "Test" })).rejects.toMatchObject({ code: "AI_ENDPOINT_NOT_PUBLIC" });
  } finally { if (id) await student.delete(`/api/ai-agents/${id}`); await student.dispose(); }
});

test("a submission body arriving after the deadline cannot replace the saved answer", async ({ bankCourse: data, teacherApi }) => {
  const { request: httpRequest } = await import("node:http");
  const student = await createAuthenticatedApi("student");
  const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
  try {
    const { settings } = await responseJson<{ settings: import("../../apps/web/src/lib/api").CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", timeLimitMinutes: 1, groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: [] })) } }));
    await responseJson(await student.get(`${assigned}/mcq/submission`));
    await responseJson(await student.post(`${assigned}/timing`, { data: {} }));
    const saved = { "question-1": ["question-1-choice-2"] };
    await responseJson(await student.put(`${assigned}/draft`, { data: { state: { answers: saved } } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: data.activityId } });
    await prisma.activityAttempt.update({ where: { id: attempt.id }, data: { startedAt: new Date(Date.now() - 58_000) } });
    const cookie = (await student.storageState()).cookies.map((value) => `${value.name}=${value.value}`).join("; ");
    const status = await new Promise<number>((resolve, reject) => {
      const pending = httpRequest(new URL(`${assigned}/mcq/submission`, API_BASE_URL), { method: "POST", headers: { Cookie: cookie, Origin: WEB_BASE_URL, "Content-Type": "application/json" } }, (response) => {
        response.resume(); response.on("end", () => resolve(response.statusCode ?? 0));
      });
      pending.on("error", reject);
      pending.write('{"answers":');
      setTimeout(() => pending.end('{"question-1":["question-1-choice-1"]}}'), 2600);
    });
    expect(status).toBe(200);
    const result = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect((result.metadata as Record<string, unknown>).submittedAnswers).toEqual(saved);
    const grade = await prisma.grade.findFirstOrThrow({ where: { selectedAttemptId: attempt.id } });
    expect(grade.normalizedScore).toBe(0);
  } finally { await student.dispose(); }
});
