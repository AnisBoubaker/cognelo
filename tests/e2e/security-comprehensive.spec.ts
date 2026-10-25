import { prisma as webDesignDb } from "../../packages/plugin-activities/plugin-web-design-coding-exercises/src/db-client";
import bcrypt from "bcryptjs";
import { createServer } from "node:http";
import { once } from "node:events";
import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, WEB_BASE_URL, API_BASE_URL } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, responseJson } from "./fixtures/activity-suite";

test("section grading access cannot disclose another section's authoring configuration", async ({ bankCourse: data, teacherApi }) => {
  const account = { email: `${data.token}-ta@example.test`, password: "SyntheticPassword123!" };
  const user = await prisma.user.create({ data: { email: account.email, passwordHash: await bcrypt.hash(account.password, 4), emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } });
  const staff = await createAuthenticatedApiWithCredentials(account);
  try {
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: account.email, role: "ta" } }));
    const { group } = await responseJson<{ group: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/groups`, { data: { title: "Separate section" } }));
    const other = await createCourseActivity(data, { activityTypeKey: "mcq", title: "Separate section exam", config: { source: "## Private question\nChoose one.\n- [x] Confidential answer\n- [ ] Other answer" } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${group.id}/activities`, { data: { activityId: other, metadata: { assessmentMode: "summative" }, contentPlacement: { isVisible: true } } }));
    expect((await staff.get(`/api/courses/${data.courseId}/activities/${other}`)).status()).toBe(404);
    const own = await responseJson<{ activity: { bankActivity: unknown; activityVersion: unknown } }>(await staff.get(data.courseActivityPath));
    expect(own.activity.bankActivity).toBeNull();
    expect(own.activity.activityVersion).toBeNull();
    // Test children inherit the parent's section scope, including retained history.
    for (const groupId of [data.groupId, group.id]) {
      const { test: exam } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: { title: "Scoped Test", lifecycle: "published" } }));
      const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${exam.activity.id}/test/items`, { data: { source: "local", activityTypeKey: "mcq", title: "Private Test question", config: { source: "## Question\nChoose one.\n- [x] Correct\n- [ ] Other" } } }));
      await assignCourseTest({ ...data, groupId }, exam.activity.id, "Scoped Test");
      const child = `/api/courses/${data.courseId}/activities/${item.activityId}`;
      expect((await staff.get(child)).status()).toBe(groupId === data.groupId ? 200 : 404);
      if (groupId === data.groupId) {
        const student = await createAuthenticatedApi("student");
        try {
          const assigned = `/api/courses/${data.courseId}/groups/${groupId}/activities/assigned/${exam.activity.id}/test`;
          const { runtime } = await responseJson<{ runtime: { attempt: { id: string } } }>(await student.post(assigned, { data: { sessionId: "scope-history" } }));
          await responseJson(await student.post(`${assigned}/submit`, { data: { parentAttemptId: runtime.attempt.id, sessionId: "scope-history" } }));
          await responseJson(await teacherApi.delete(`/api/courses/${data.courseId}/activities/${exam.activity.id}/test/items/${item.id}`));
          expect(await prisma.testItemAttempt.count({ where: { testItemId: item.id } })).toBe(1);
          expect((await staff.get(child)).status()).toBe(200);
        } finally { await student.dispose(); }
      }
    }
  } finally { await staff.dispose(); await prisma.user.delete({ where: { id: user.id } }); }
});

test("concurrent password changes accept only one verified account version", async ({ bankCourse: data }) => {
  const account = { email: `${data.token}-password-race@example.test`, password: "SyntheticPassword123!" };
  const user = await prisma.user.create({ data: { email: account.email, passwordHash: await bcrypt.hash(account.password, 4), emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } });
  const first = await createAuthenticatedApiWithCredentials(account);
  const second = await createAuthenticatedApiWithCredentials(account);
  try {
    const passwords = ["FirstReplacement123!", "SecondReplacement123!"];
    const responses = await Promise.all([first, second].map((api, index) => api.put("/api/users/me/password", { data: { currentPassword: account.password, newPassword: passwords[index], confirmNewPassword: passwords[index] } })));
    expect(responses.filter((response) => response.ok())).toHaveLength(1);
    expect([401, 409]).toContain(responses.find((response) => !response.ok())!.status());
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.authVersion).toBe(1);
    const winner = responses.findIndex((response) => response.ok());
    expect(await bcrypt.compare(passwords[winner], saved.passwordHash)).toBe(true);
    expect(await bcrypt.compare(passwords[1 - winner], saved.passwordHash)).toBe(false);
  } finally { await first.dispose(); await second.dispose(); await prisma.user.delete({ where: { id: user.id } }); }
});

test("Test-item deletion authorizes before reading and limits optional request bodies", async ({ bankCourse: data, teacherApi }) => {
  const { test: exam } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: { title: "Bounded deletion", lifecycle: "draft" } }));
  const items = `/api/courses/${data.courseId}/activities/${exam.activity.id}/test/items`;
  const { item } = await responseJson<{ item: { id: string } }>(await teacherApi.post(items, { data: { source: "local", activityTypeKey: "mcq", title: "Disposable question" } }));
  const target = `${items}/${item.id}`;
  const student = await createAuthenticatedApi("student");
  try {
    expect((await student.delete(target, { data: "malformed" })).status()).toBe(403);
    expect((await teacherApi.delete(target, { data: " ".repeat(2 * 1024 * 1024 + 1) })).status()).toBe(413);
    expect(await prisma.testItem.findUnique({ where: { id: item.id } })).not.toBeNull();
    expect((await teacherApi.delete(target)).ok()).toBe(true);
  } finally { await student.dispose(); }
});

test("content uploads and repository links reject oversized titles and embedded credentials", async ({ bankCourse: data, teacherApi }) => {
  const resources = `/api/courses/${data.courseId}/content-resources`;
  const denied = await teacherApi.post(resources, { data: { contentTypeKey: "github-repo", payload: { title: "Credential must stay private", url: "https://synthetic-token@github.com/example/repo" } } });
  expect(denied.status()).toBe(400);
  for (const url of ["https://synthetic-token@github.com/example/repo", "javascript:alert(1)", "not a URL"]) {
    for (const target of [`/api/courses/${data.courseId}/materials`, `/api/courses/${data.courseId}/groups/${data.groupId}/materials`]) {
      expect((await teacherApi.post(target, { data: { title: "Rejected legacy URL", kind: "github_repo", url } })).status()).toBe(400);
    }
  }
  expect((await teacherApi.post("/api/ai-agents", { data: { displayName: "Rejected model URL", provider: "openai", model: "test-model", baseUrl: "not a URL", scope: "personal" } })).status()).toBe(400);
  const { resource } = await responseJson<{ resource: { id: string } }>(await teacherApi.post(resources, { data: { contentTypeKey: "file", payload: { title: "Bounded upload" } } }));
  const upload = await teacherApi.put(`${resources}/${resource.id}/upload`, { multipart: { title: "x".repeat(181), file: { name: "harmless.txt", mimeType: "text/plain", buffer: Buffer.from("local test") } } });
  expect(upload.status()).toBe(400);
  const stored = await prisma.courseContentResource.findUniqueOrThrow({ where: { id: resource.id } });
  expect(stored.title).toBe("Bounded upload");
  expect(stored.metadata).not.toHaveProperty("storedName");
});

test("browser responses block foreign framing while API documents allow the configured web origin", async ({ studentPage: page }) => {
  const web = await page.request.get(`${WEB_BASE_URL}/courses`);
  expect(web.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(web.headers()["x-content-type-options"]).toBe("nosniff");
  expect(web.headers()["referrer-policy"]).toBe("no-referrer");
  const api = await page.request.get(`${API_BASE_URL}/api/health`);
  expect(api.headers()["content-security-policy"]).toContain(new URL(WEB_BASE_URL).origin);
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const foreign = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html"); response.end(`<iframe src="${WEB_BASE_URL}/courses"></iframe>`);
  });
  foreign.listen(0, "127.0.0.1"); await once(foreign, "listening");
  try {
    const address = foreign.address(); if (!address || typeof address === "string") throw new Error("No test server port");
    await page.goto(`http://127.0.0.1:${address.port}`);
    await expect.poll(() => errors.some((message) => /frame-ancestors|X-Frame-Options/i.test(message))).toBe(true);
    await expect(page.frameLocator("iframe").getByRole("button", { name: "Open account menu" })).toHaveCount(0);
  } finally { await new Promise<void>((resolve) => foreign.close(() => resolve())); }
});

test("authored Markdown cannot inject page-wide styles or form controls", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const source = "## Safe display\n\n<div><style>body { --cognelo-security-probe: injected; }</style><form><input name=probe><button>Injected control</button></form></div>\n\nChoose one.\n- [x] Four\n- [ ] Five";
  await responseJson(await teacherApi.patch(data.courseActivityPath, { data: { config: { source, randomizeChoices: false } } }));
  await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`);
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--cognelo-security-probe"))).toBe("");
  await expect(page.getByRole("button", { name: "Injected control", exact: true })).toHaveCount(0);
});

test("Web Design enforces authored files and rejects exhausted submissions before execution", async ({ bankCourse: data }) => {
  const locked = { id: "html", path: "index.html", language: "html" as const, starterCode: "<h1>Fixed</h1>", isEditable: false, orderIndex: 0 };
  const editable = { id: "css", path: "style.css", language: "css" as const, starterCode: "", isEditable: true, orderIndex: 1 };
  const activityId = await createCourseActivity(data, { activityTypeKey: "web-design-coding-exercise", title: "Protected file fixture", config: { files: [locked, editable] } });
  await assignCourseTest(data, activityId, "Protected file fixture");
  await webDesignDb.pluginWebDesignExerciseTest.createMany({ data: (["sample", "hidden"] as const).map((kind) => ({ activityId, kind, name: "Fixed heading", testCode: 'await expect(page.locator("h1")).toHaveText("Fixed");' })) });
  const files = [
    { ...locked, isEditable: true, starterCode: "<h1>Injected</h1>" },
    { ...editable, path: "attack.js", language: "javascript", starterCode: "document.querySelector('h1').textContent = 'Injected';" },
    { ...editable, id: "extra", path: "extra.js", language: "javascript", starterCode: "document.querySelector('h1').textContent = 'Injected';" }
  ];
  const student = await createAuthenticatedApi("student");
  const endpoint = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}/web-design-coding-exercises`;
  try {
    const result = await responseJson<{ submission: { status: string; files: Array<typeof locked | typeof editable> } }>(await student.post(`${endpoint}/run`, { data: { files } }));
    expect(result.submission.status).toBe("completed");
    expect(result.submission.files).toHaveLength(2);
    expect(result.submission.files[0]).toEqual(locked);
    expect(result.submission.files[1]).toMatchObject({ id: "css", path: "style.css", language: "css", isEditable: true });
    await responseJson(await student.post(`${endpoint}/submit`, { data: { files } }));
    const before = await webDesignDb.pluginWebDesignExerciseSubmission.count({ where: { activityId } });
    const denied = await student.post(`${endpoint}/submit`, { data: { files } });
    expect(denied.status()).toBe(409);
    expect((await denied.json()).error.code).toBe("ATTEMPT_LIMIT_REACHED");
    expect(await webDesignDb.pluginWebDesignExerciseSubmission.count({ where: { activityId } })).toBe(before);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } });
    expect((attempt.metadata as { submittedFiles: unknown }).submittedFiles).toEqual(result.submission.files);
  } finally { await student.dispose(); }
});

test("MCQ submissions discard fields outside the authored questions and choices", async ({ bankCourse: data }) => {
  const student = await createAuthenticatedApi("student");
  try {
    await responseJson(await student.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}/mcq/submission`, { data: { answers: {
      "question-1": ["question-1-choice-1", "invented-choice", "question-1-choice-1"], "invented-question": ["discard this payload"]
    } } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: data.activityId } });
    expect((attempt.metadata as { submittedAnswers: unknown }).submittedAnswers).toEqual({ "question-1": ["question-1-choice-1"] });
  } finally { await student.dispose(); }
});

test("legacy course CSV exports keep student-controlled names literal", async ({ bankCourse: data, teacherApi }) => {
  const account = { email: `${data.token}-csv@example.test`, password: "SyntheticPassword123!" };
  const user = await prisma.user.create({ data: { email: account.email, passwordHash: await bcrypt.hash(account.password, 4), emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } });
  const student = await createAuthenticatedApiWithCredentials(account);
  try {
    await responseJson(await student.patch("/api/users/me", { data: { firstName: "=1+", lastName: "1" } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: account.email, role: "student" } }));
    const response = await teacherApi.get(`/api/courses/${data.courseId}/gradebook?format=csv`);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain(",'=1+ 1,");
  } finally { await student.dispose(); await prisma.user.delete({ where: { id: user.id } }); }
});
