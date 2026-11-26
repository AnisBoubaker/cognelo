import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { unzipSync } from "fflate";
import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials } from "./fixtures/auth";
import { responseJson, assignCourseTest, createCourseActivity } from "./fixtures/activity-suite";
import { createStoredZip } from "./fixtures/zip";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";
import { parseMcqSource, readMcqConfig } from "../../packages/plugin-activities/plugin-mcq/src/mcq";
import type { CourseActivityAssignmentSettings, CourseTestRuntime } from "../../apps/web/src/lib/api";
import type { TestInfo } from "@playwright/test";

async function archiveText(bytes: Uint8Array, testInfo: TestInfo, label: string) {
  const archive = unzipSync(bytes), texts: Record<string, string> = {};
  const directory = testInfo.outputPath(label); await mkdir(directory, { recursive: true });
  for (const [index, [name, content]] of Object.entries(archive).entries()) {
    if (!name.endsWith(".pdf")) continue;
    const file = `${directory}/${index}.pdf`; await writeFile(file, content);
    texts[name] = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
  }
  return { archive, texts, all: Object.values(texts).join("\n") };
}

test("teacher opt-in exports visible content, original files and only the learner's released submissions", async ({ bankCourse: data, teacherApi, teacherPage, studentPage }, testInfo) => {
  test.setTimeout(300_000);
  const student = await createAuthenticatedApi("student"), admin = await createAuthenticatedApi("admin");
  let peer: Awaited<ReturnType<typeof createAuthenticatedApi>> | undefined, peerId: string | undefined;
  const endpoint = `/api/courses/${data.courseId}/student-export`, content = `/api/courses/${data.courseId}/content-resources`;
  try {
    expect((await student.post(endpoint, { data: { locale: "en" } })).status()).toBe(403);
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await expect(studentPage.getByRole("heading", { name: data.subjectTitle, exact: true })).toBeVisible();
    await expect(studentPage.getByRole("button", { name: "Export course content", exact: true })).toHaveCount(0);
    await teacherPage.goto(`/courses/${data.courseId}?tab=settings&section=general`);
    const setting = teacherPage.getByRole("switch", { name: "Allow students to export course content", exact: true });
    await expect(setting).not.toBeChecked();
    await setting.check(); await teacherPage.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(setting).not.toBeChecked();
    await setting.check(); await teacherPage.getByRole("button", { name: "Save course", exact: true }).click();
    await expect(teacherPage.getByRole("status")).toContainText("General course settings saved.");
    await teacherPage.reload(); await expect(setting).toBeChecked();
    expect((await teacherApi.post(endpoint, { data: { locale: "en" } })).status()).toBe(403);
    expect((await student.patch(`/api/courses/${data.courseId}`, { data: { studentCourseExportEnabled: true } })).status()).toBe(403);
    expect((await student.post(endpoint, { data: { locale: "en", participantId: "someone-else" } })).status()).toBe(400);
    for (const key of ["text-content", "link-content", "github-repo-content", "file-content"]) await ensureContentTypePluginEnabled(key);
    const { contentItem: folder } = await responseJson<{ contentItem: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/content/folders`, { data: { title: "Week 1", isVisible: true, position: 0 } }));
    const { contentItem: hidden } = await responseJson<{ contentItem: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/content/folders`, { data: { title: "Hidden week", isVisible: false, position: 1 } }));
    const { asset } = await responseJson<{ asset: { url: string } }>(await teacherApi.post("/api/media-assets", { multipart: { file: {
      name: "diagram.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
    } } }));
    for (const value of [
      { contentTypeKey: "text", parentId: folder.id, payload: { title: "Lecture notes", body: `## Visible lesson\n\nTexte français: élève.\n\n$$x^2 + y^2 = z^2$$\n\n| Term | Meaning |\n|---|---|\n| PDF | Portable document |\n\n![Course diagram](${asset.url})`, displayMode: "inline" } },
      { contentTypeKey: "link", parentId: folder.id, payload: { title: "Reference link", url: "https://example.com/learning", description: "Visible description" } },
      { contentTypeKey: "github-repo", parentId: folder.id, payload: { title: "Course repository", url: "https://github.com/example/course" } },
      { contentTypeKey: "text", parentId: hidden.id, payload: { title: "Hidden notes", body: "HIDDEN ANCESTOR SECRET" } }
    ]) await responseJson(await teacherApi.post(content, { data: { ...value, isVisible: true } }));
    const { resource: file } = await responseJson<{ resource: { id: string } }>(await teacherApi.post(content, { data: { contentTypeKey: "file", parentId: folder.id, payload: { title: "Starter files" } } }));
    const original = Buffer.from(`Original course file ${data.token}\n`);
    await responseJson(await teacherApi.put(`${content}/${file.id}/upload`, { multipart: { title: "Starter files", file: { name: "starter.txt", mimeType: "text/plain", buffer: original } } }));
    const lesson = await prisma.courseContentResource.findFirstOrThrow({ where: { courseId: data.courseId, title: "Lecture notes" } });
    await prisma.courseContentResource.update({ where: { id: lesson.id }, data: { metadata: { ...(lesson.metadata as Record<string, string>), embeddingIndex: { privateInstructions: "PRIVATE INDEX SECRET" } } } });
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "unlimited" }, groupAssignments: settings.groups.map(group => ({ ...group, overrideFields: [] })) } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`, question = parseMcqSource(ORIGINAL_SOURCE, "none").questions[0];
    for (const choice of question.choices) await responseJson(await student.post(`${assigned}/mcq/submission`, { data: { answers: { [question.id]: [choice.id] } } }));
    const account = { email: `course-export-${data.token}@cognelo.local`, password: "CourseExport123!" };
    const created = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: { ...account, firstName: "Other", lastName: "Learner", roles: ["student"] } }));
    peerId = created.user.id; await prisma.user.update({ where: { id: peerId }, data: { emailVerifiedAt: new Date(), mustChangePassword: false } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: account.email, role: "student" } }));
    peer = await createAuthenticatedApiWithCredentials(account);
    await responseJson(await peer.post(`${assigned}/mcq/submission`, { data: { answers: { [question.id]: [question.choices[0].id] } } }));
    const own = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, user: { email: "student@cognelo.local" } } });
    const item = await prisma.gradebookItem.findFirstOrThrow({ where: { activityId: data.activityId, groupId: data.groupId } });
    await prisma.grade.updateMany({ where: { gradebookItemId: item.id, participantId: own.id, isActive: true }, data: { normalizedResult: { studentFeedback: { feedbackText: "Visible teacher feedback" } } } });
    const before = await prisma.activityAttempt.findMany({ where: { courseId: data.courseId }, orderBy: { id: "asc" } });
    const unreleased = await student.post(endpoint, { data: { locale: "en" }, timeout: 120_000 });
    expect(unreleased.ok(), await unreleased.text().then(value => value.slice(0, 200))).toBe(true);
    const first = await archiveText(await unreleased.body(), testInfo, "unreleased");
    expect(first.all).not.toContain("Visible teacher feedback");
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/gradebook/items/${item.id}/release`, { data: { released: true } }));
    await studentPage.reload();
    const downloadPromise = studentPage.waitForEvent("download", { timeout: 120_000 });
    await studentPage.getByRole("button", { name: "Export course content", exact: true }).click();
    const download = await downloadPromise; await download.saveAs(testInfo.outputPath("course-content.zip"));
    const result = await archiveText(await readFile(testInfo.outputPath("course-content.zip")), testInfo, "released");
    expect(result.all).toContain("Visible lesson"); expect(result.all).toContain("https://example.com/learning"); expect(result.all).toContain("https://github.com/example/course");
    expect(result.all).toContain("Visible teacher feedback"); expect(result.all).toMatch(/Attempt\s+1/); expect(result.all).toMatch(/Attempt\s+2/); expect(result.all).not.toMatch(/Attempt\s+3/);
    for (const secret of ["PRIVATE INDEX SECRET", "HIDDEN ANCESTOR SECRET", "Other Learner", "Correct answer"]) expect(result.all).not.toContain(secret);
    const originalPath = Object.keys(result.archive).find(name => name.endsWith("starter.txt"))!;
    expect(originalPath).toContain("Week 1"); expect(Buffer.from(result.archive[originalPath])).toEqual(original);
    expect(await prisma.activityAttempt.findMany({ where: { courseId: data.courseId }, orderBy: { id: "asc" } })).toEqual(before);
    await studentPage.setViewportSize({ width: 390, height: 844 });
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await studentPage.screenshot({ path: testInfo.outputPath("student-export-mobile.png") });
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}`, { data: { studentCourseExportEnabled: false } }));
    expect((await student.post(endpoint, { data: { locale: "en" } })).status()).toBe(403);
    await studentPage.reload(); await expect(studentPage.getByRole("button", { name: "Export course content", exact: true })).toHaveCount(0);
  } finally { await peer?.dispose(); await student.dispose(); await admin.dispose(); if (peerId) await prisma.user.delete({ where: { id: peerId } }); }
});

test("compound Test exports keep pre-start questions and closed answers private", async ({ bankCourse: data, teacherApi }, testInfo) => {
  test.setTimeout(240_000);
  const student = await createAuthenticatedApi("student"), endpoint = `/api/courses/${data.courseId}/student-export`;
  try {
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}`, { data: { studentCourseExportEnabled: true } }));
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: { title: "Protected final exam", lifecycle: "published", contentPlacement: { isVisible: true } } }));
    const testId = created.activity.id;
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${testId}/test/items`, { data: { source: "local", activityTypeKey: "mcq", title: "Private exam question", config: { source: "## Secret exam prompt\nChoose.\n\n- [x] First\n- [ ] Second" }, pointsPossible: 10 } }));
    await assignCourseTest(data, testId, "Protected final exam");
    const preStart = await student.post(endpoint, { data: { locale: "en" }, timeout: 120_000 });
    expect(preStart.ok()).toBe(true); expect((await archiveText(await preStart.body(), testInfo, "pre-start")).all).not.toContain("Secret exam prompt");
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${testId}`;
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await student.post(`${assigned}/test`, { data: { sessionId: data.token } }));
    const question = runtime.test.items[0], parsed = readMcqConfig(question.activity.config).questions[0];
    await responseJson(await student.put(`${assigned}/test/items/${question.id}`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: data.token, state: { answers: { [parsed.id]: [parsed.choices[0].id] } } } }));
    await responseJson(await student.post(`${assigned}/test/submit`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: data.token } }));
    const open = await student.post(endpoint, { data: { locale: "en" }, timeout: 120_000 }); expect(open.ok()).toBe(true);
    const openText = (await archiveText(await open.body(), testInfo, "submitted-test")).all;
    expect(openText).toContain("Secret exam prompt"); expect(openText).not.toContain("Correct answer");
    const settingsPath = `/api/courses/${data.courseId}/activities/${testId}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, hideAfterAttempts: true, groupAssignments: settings.groups.map(group => ({ ...group, overrideFields: [] })) } }));
    const item = await prisma.gradebookItem.findFirstOrThrow({ where: { activityId: testId, groupId: data.groupId } });
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/gradebook/items/${item.id}/release`, { data: { released: true } }));
    const closed = await student.post(endpoint, { data: { locale: "en" }, timeout: 120_000 }); expect(closed.ok()).toBe(true);
    const result = await archiveText(await closed.body(), testInfo, "closed-test"), exam = Object.entries(result.texts).find(([name]) => name.endsWith("Protected final exam.pdf"))?.[1];
    expect(exam).toContain("20 / 20"); expect(exam).not.toContain("Secret exam prompt"); expect(exam).not.toContain("First"); expect(exam).not.toMatch(/Attempt\s+1/);
  } finally { await student.dispose(); }
});

test("cancelling the progress dialog discards a late download", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}`, { data: { studentCourseExportEnabled: true } }));
  await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
  let complete!: () => void; const pending = new Promise<void>(resolve => { complete = resolve; });
  await page.route(`**/api/courses/${data.courseId}/student-export`, async route => { await pending; await route.fulfill({ status: 200, contentType: "application/zip", body: "late archive" }).catch(() => undefined); });
  let downloads = 0; page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Export course content", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Preparing course export", exact: true });
  await expect(progress).toBeVisible(); await progress.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(progress).toBeHidden(); complete(); await page.unrouteAll({ behavior: "wait" });
  await expect(page.getByRole("button", { name: "Export course content", exact: true })).toBeEnabled(); expect(downloads).toBe(0);
});

test("Homework exports retain provided ZIPs, frozen source, assignment PDF pages and only published feedback", async ({ bankCourse: data, teacherApi }, testInfo) => {
  test.setTimeout(180_000);
  const student = await createAuthenticatedApi("student"), course = `/api/courses/${data.courseId}`;
  try {
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Homework portfolio", config: {} });
    const base = `${course}/activities/${id}/coding-homework-grader`;
    const { assignment } = await responseJson<{ assignment: Record<string, unknown> }>(await teacherApi.get(`${base}/authoring`));
    await responseJson(await teacherApi.put(`${base}/authoring`, { data: { assignment: { ...assignment, promptMarkdown: "# Portfolio instructions\n\nمحتوى المقرر\n\n课程内容\n\nTexte français: élève.", generationInstructions: "PRIVATE HOMEWORK INSTRUCTIONS", settings: { ...(assignment.settings as object), questionGenerationEnabled: false } }, requirements: { requiredFiles: [{ path: "main.c" }] } } }));
    const { PDFDocument, StandardFonts } = await import("pdf-lib"), pdf = await PDFDocument.create();
    pdf.addPage().drawText("Original assignment PDF", { font: await pdf.embedFont(StandardFonts.Helvetica) });
    const assignmentBytes = Buffer.from(await pdf.save());
    await responseJson(await teacherApi.post(`${base}/assignment-pdf`, { data: { fileName: "assignment.pdf", mimeType: "application/pdf", base64: assignmentBytes.toString("base64") } }));
    const starter = createStoredZip([{ path: "src/starter.c", contents: "int starter(void) { return 7; }" }, { path: "include/starter.h", contents: "int starter(void);" }]);
    await responseJson(await teacherApi.post(`${base}/provided-files`, { data: { fileName: "starter.zip", mimeType: "application/zip", base64: starter.toString("base64") } }));
    await responseJson(await teacherApi.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" }, gradebookSettings: { pointsPossible: 100, maxAttempts: 1, attemptLimitMode: "max_attempts" } } }));
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    await responseJson(await teacherApi.patch(course, { data: { studentCourseExportEnabled: true } }));
    const assigned = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    const code = Array.from({ length: 130 }, (_, index) => `// Student's own saved source, line ${index + 1}`).join("\n") + "\n// " + "a very long line ".repeat(30);
    await responseJson(await student.post(`${assigned}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from(code).toString("base64") } }));
    const { submission } = await responseJson<{ submission: { id: string; coreAttemptId: string } }>(await student.post(`${assigned}/hand-in`, { data: { expectedRevision: 1 } }));
    const attempt = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: submission.coreAttemptId } });
    await responseJson(await teacherApi.patch(`${course}/gradebook/items/${attempt.gradebookItemId}/participants/${attempt.participantId}/override`, { data: { score: 75, maxScore: 100, reason: "Overall reviewed grade", expectedGradeUpdatedAt: null } }));
    await responseJson(await teacherApi.patch(`${course}/gradebook/items/${attempt.gradebookItemId}/release`, { data: { released: true } }));
    for (const [status, feedback, offset] of [["completed", "Published homework feedback", 0], ["staged", "PRIVATE STAGED FEEDBACK", 1000]] as const) await prisma.$executeRaw`INSERT INTO "PluginCodingHomeworkReview" (id,"submissionId","reviewerUserId",feedback,rubric,metadata,"createdAt","updatedAt") VALUES (${data.token + status},${submission.id},'fixture-reviewer',${feedback},'{}'::jsonb,${JSON.stringify({ status })}::jsonb,${new Date(Date.now()+offset)},now())`;
    const before = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    const response = await student.post(`${course}/student-export`, { data: { locale: "ar" }, timeout: 120_000 });
    expect(response.ok(), await response.text().then(value => value.slice(0, 200))).toBe(true);
    await writeFile(testInfo.outputPath("homework-ar.zip"), await response.body());
    const result = await archiveText(await response.body(), testInfo, "homework-ar");
    expect(result.all).toContain("Portfolio instructions"); expect(result.all).toContain("Original assignment PDF");
    expect(result.all).toContain("Student's own saved source, line 130"); expect(result.all).toContain("Published homework feedback");
    expect(result.all).not.toContain("PRIVATE STAGED FEEDBACK"); expect(result.all).not.toContain("PRIVATE HOMEWORK INSTRUCTIONS");
    const { PDFDocument: Pdf } = await import("pdf-lib");
    const homeworkPath = Object.keys(result.archive).find(name => name.endsWith("Homework portfolio.pdf"))!;
    const homeworkPdf = await Pdf.load(result.archive[homeworkPath]);
    const artifact = testInfo.outputPath("homework-with-notices.pdf"); await writeFile(artifact, result.archive[homeworkPath]);
    for (let page = 1; page <= homeworkPdf.getPageCount(); page++) {
      const text = execFileSync("pdftotext", ["-f", String(page), "-l", String(page), "-raw", artifact, "-"], { encoding: "utf8" });
      expect(text).toContain("All rights reserved to the copyright owners."); expect(text).toContain("Sam Student");
    }
    const originalPath = Object.keys(result.archive).find(name => name.endsWith("starter.zip"))!;
    expect(Buffer.from(result.archive[originalPath])).toEqual(starter);
    const assignmentPath = Object.keys(result.archive).find(name => name.endsWith("assignment.pdf"))!;
    expect(Buffer.from(result.archive[assignmentPath])).toEqual(assignmentBytes);
    expect(await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toEqual(before);
  } finally { await student.dispose(); }
});

test("multiple enrollments preserve section folders and dual-role accounts cannot use staff visibility", async ({ bankCourse: data, teacherApi }, testInfo) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student"), course = `/api/courses/${data.courseId}`;
  try {
    await ensureContentTypePluginEnabled("text-content");
    await responseJson(await teacherApi.patch(course, { data: { studentCourseExportEnabled: true } }));
    const groups: Record<string, string> = {};
    for (const [title, enrolled, future] of [["Second enrolled section", true, false], ["Other section", false, false], ["Future section", true, true]] as const) {
      const { group } = await responseJson<{ group: { id: string } }>(await teacherApi.post(`${course}/groups`, { data: { title } }));
      groups[title] = group.id;
      await responseJson(await teacherApi.patch(`${course}/groups/${group.id}`, { data: { status: "published", availableFrom: future ? new Date(Date.now()+86_400_000).toISOString() : null, availableUntil: null } }));
      if (enrolled) await responseJson(await teacherApi.post(`${course}/groups/${group.id}/participants`, { data: { email: "student@cognelo.local", role: "student" } }));
      await responseJson(await teacherApi.post(`${course}/content-resources`, { data: { groupId: group.id, contentTypeKey: "text", payload: { title, body: `Only ${title}` } } }));
    }
    for (const isVisible of [true, false]) await responseJson(await teacherApi.post(`${course}/content-resources`, { data: { contentTypeKey: "text", isVisible, payload: { title: isVisible ? "Shared lesson" : "Staff only lesson", body: isVisible ? "Shared public lesson" : "PRIVATE STAFF CONTENT" } } }));
    const response = await student.post(`${course}/student-export`, { data: { locale: "en" }, timeout: 120_000 });
    expect(response.ok()).toBe(true);
    const own = await archiveText(await response.body(), testInfo, "multiple-sections");
    expect(own.all).toContain(data.groupTitle); expect(own.all).toContain("Second enrolled section");
    for (const excluded of ["Other section", "Future section", "PRIVATE STAFF CONTENT"]) expect(own.all).not.toContain(excluded);
    expect(Object.keys(own.archive).filter(name => name.endsWith("Shared lesson.pdf"))).toHaveLength(2);
    // The course creator is automatically a section teacher. This disposable enrollment
    // becomes a student while the account retains explicit course-owner permissions.
    await prisma.courseGroupParticipant.updateMany({ where: { groupId: groups["Second enrolled section"], user: { email: "teacher@cognelo.local" } }, data: { role: "student" } });
    const dual = await teacherApi.post(`${course}/student-export`, { data: { locale: "en" }, timeout: 120_000 });
    expect(dual.ok()).toBe(true);
    const dualResult = await archiveText(await dual.body(), testInfo, "dual-role");
    expect(dualResult.all).toContain("Second enrolled section");
    for (const excluded of [data.groupTitle, "Other section", "Future section", "PRIVATE STAFF CONTENT"]) expect(dualResult.all).not.toContain(excluded);
  } finally { await student.dispose(); }
});
