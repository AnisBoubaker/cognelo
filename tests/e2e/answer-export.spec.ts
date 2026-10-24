import { unzipSync } from "fflate";
import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";
import { parseMcqSource } from "../../packages/plugin-activities/plugin-mcq/src/mcq";
import type { AnswerExportStudent } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

 test("exports selected submitted answers with exact attempts, PDF/ZIP and guarded access", async ({ bankCourse: data, teacherApi, teacherPage: page }, testInfo) => {
  test.setTimeout(180_000);
  const studentApi = await createAuthenticatedApi("student");
  const endpoint = `/api/courses/${data.courseId}/gradebook/activities/${data.activityId}/answers-export`;
  try {
    const settingsPath = `${data.courseActivityPath}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    await responseJson(await teacherApi.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative",
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: "unlimited" },
      groupAssignments: settings.groups.map((group) => ({ ...group, overrideFields: group.overrideFields.filter((field) => field !== "attempts") })) } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`;
    const question = parseMcqSource(ORIGINAL_SOURCE, "none").questions[0]!;
    await responseJson(await studentApi.post(`${assigned}/mcq/submission`, { data: { answers: { [question.id]: [question.choices[0].id] } } }));
    await responseJson(await studentApi.post(`${assigned}/mcq/submission`, { data: { answers: { [question.id]: [question.choices[1].id] } } }));
    const { students } = await responseJson<{ students: AnswerExportStudent[] }>(await teacherApi.get(endpoint));
    expect(students).toHaveLength(1); expect(students[0].attempts).toHaveLength(2);
    const participantId = students[0].participantId;
    const request = { participantIds: [participantId], attempts: "latest", includePrompt: true, includeGrading: false, format: "pdf", locale: "en" };
    expect((await studentApi.get(endpoint)).status()).toBe(403);
    expect((await studentApi.post(endpoint, { data: request })).status()).toBe(403);
    expect((await teacherApi.post(endpoint, { data: { ...request, participantIds: ["not-a-submitting-student"] } })).status()).toBe(400);
    expect((await teacherApi.post(endpoint, { data: { ...request, attemptId: "another-students-attempt" } })).status()).toBe(400);
    const before = await prisma.activityAttempt.findMany({ where: { activityId: data.activityId }, orderBy: { id: "asc" } });
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${data.activityId}?report=overview`);
    await page.getByRole("button", { name: "Export student answers", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Export student answers", exact: true });
    await expect(dialog.getByLabel("Attempts to include")).toHaveValue("latest");
    await expect(dialog.getByRole("checkbox", { name: "Include the prompt with each answer", exact: true })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: "Include grades, rubric scores, comments and test results", exact: true })).not.toBeChecked();
    await dialog.getByRole("button", { name: "Uncheck all", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Export", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Check all", exact: true }).click();
    await dialog.getByLabel("Attempts to include").selectOption("all");
    await page.screenshot({ path: testInfo.outputPath("answer-export-selection.png") });
    const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
    await dialog.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs(testInfo.outputPath("all-attempts.pdf"));
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Export student answers", exact: true }).click();
    await dialog.getByLabel("Download format").selectOption("zip");
    await dialog.getByRole("checkbox", { name: "Include grades, rubric scores, comments and test results", exact: true }).check();
    const zipDownloadPromise = page.waitForEvent("download", { timeout: 45_000 });
    await dialog.getByRole("button", { name: "Export", exact: true }).click();
    const zipDownload = await zipDownloadPromise;
    await zipDownload.saveAs(testInfo.outputPath("student-answers.zip"));
    const { readFile } = await import("node:fs/promises");
    const files = unzipSync(await readFile(testInfo.outputPath("student-answers.zip")));
    expect(Object.keys(files)).toHaveLength(1);
    expect(Buffer.from(Object.values(files)[0]).subarray(0, 5).toString()).toBe("%PDF-");
    await page.getByRole("tab", { name: "Student results", exact: true }).click();
    await page.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Export answer as PDF", exact: true }).click();
    await expect(dialog.getByLabel("Submission", { exact: true })).toHaveValue(students[0].attempts[0].id);
    await dialog.getByLabel("Submission", { exact: true }).selectOption(students[0].attempts[1].id);
    const singlePromise = page.waitForEvent("download", { timeout: 45_000 });
    await dialog.getByRole("button", { name: "Export", exact: true }).click();
    await (await singlePromise).saveAs(testInfo.outputPath("first-attempt.pdf"));
    expect(await prisma.activityAttempt.findMany({ where: { activityId: data.activityId }, orderBy: { id: "asc" } })).toEqual(before);
    for (const attempt of students[0].attempts) await responseJson(await teacherApi.delete(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}`, { data: { reason: "Export regression cleanup" } }));
    expect((await responseJson<{ students: AnswerExportStudent[] }>(await teacherApi.get(endpoint))).students).toEqual([]);
    expect((await teacherApi.post(endpoint, { data: request })).status()).toBe(400);
    await page.reload();
    await expect(page.getByRole("button", { name: "Export student answers", exact: true })).toBeDisabled();
    await page.getByRole("tab", { name: "Student results", exact: true }).click();
    await page.getByRole("button", { name: /^Actions for / }).click();
    await expect(page.getByRole("menuitem", { name: "Export answer as PDF", exact: true })).toHaveCount(0);
  } finally { await studentApi.dispose(); }
});

test("exports a compound Test with saved code, question prompts and only selected students", async ({ bankCourse: data, teacherApi, teacherPage: page }, testInfo) => {
  test.setTimeout(180_000);
  const { assignCourseTest } = await import("./fixtures/activity-suite");
  const { createAuthenticatedApiWithCredentials } = await import("./fixtures/auth");
  const student = await createAuthenticatedApi("student");
  const admin = await createAuthenticatedApi("admin");
  let peer: Awaited<ReturnType<typeof createAuthenticatedApi>> | undefined, peerId: string | undefined;
  try {
    const account = { email: `pdf-${data.token}@cognelo.local`, password: "AnswerExport123!" };
    const created = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: { ...account, firstName: "Export", lastName: "Peer", roles: ["student"] } }));
    peerId = created.user.id;
    await prisma.user.update({ where: { id: peerId }, data: { emailVerifiedAt: new Date(), mustChangePassword: false } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: account.email, role: "student" } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: `not-submitted-${data.token}@cognelo.local`, firstName: "No", lastName: "Submission", role: "student" } }));
    peer = await createAuthenticatedApiWithCredentials(account);
    const { test: createdTest } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: { title: `Réponses d’examen ${data.token}`, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true } } }));
    const testId = createdTest.activity.id;
    for (const item of [
      { activityTypeKey: "mcq", title: "Probabilités", config: { source: "## Calcul\nCalculer $\\frac{1}{2}$ et choisir la réponse.\n\n| Variable | Valeur |\n|---|---|\n| x | 2 |\n\n- [x] Un demi\n- [ ] Trois" } },
      { activityTypeKey: "coding-exercise", title: "Programme long", config: { language: "python", prompt: "Écrire le programme.\n\n$$x^2 + y^2 = z^2$$", sampleTests: [] } }
    ]) await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${testId}/test/items`, { data: { source: "local", ...item, pointsPossible: 10 } }));
    await assignCourseTest(data, testId, "Export Test");
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${testId}`;
    const sourceCode = Array.from({ length: 150 }, (_, i) => `print("ligne ${i + 1}: réponse enregistrée")`).join("\n") + `\n# ${"longline ".repeat(35)}`;
    for (const [api, label] of [[student, "Sam"], [peer, "Peer"]] as const) {
      const { runtime } = await responseJson<{ runtime: { attempt: { id: string }; test: { items: Array<{ id: string; activity: { activityType: { key: string }; config: Record<string, unknown> } }> } } }>(await api.post(`${assigned}/test`, { data: { sessionId: `${data.token}-${label}` } }));
      for (const item of runtime.test.items) {
        const question = item.activity.activityType.key === "mcq" ? parseMcqSource(String(item.activity.config.source), "none").questions[0] : null;
        const state = question ? { answers: { [question.id]: [question.choices[0].id] } } : { sourceCode: `# ${label}\n${sourceCode}` };
        await responseJson(await api.put(`${assigned}/test/items/${item.id}`, { data: { parentAttemptId: runtime.attempt.id, sessionId: `${data.token}-${label}`, state } }));
      }
      await responseJson(await api.post(`${assigned}/test/submit`, { data: { parentAttemptId: runtime.attempt.id, sessionId: `${data.token}-${label}` } }));
    }
    const endpoint = `/api/courses/${data.courseId}/gradebook/activities/${testId}/answers-export`;
    const { students } = await responseJson<{ students: AnswerExportStudent[] }>(await teacherApi.get(endpoint));
    expect(students).toHaveLength(2);
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${testId}?report=overview`);
    await page.getByRole("button", { name: "Export student answers", exact: true }).click();
    const selection = page.getByRole("dialog", { name: "Export student answers", exact: true });
    await expect(selection.getByRole("checkbox")).toHaveCount(4);
    await selection.getByRole("checkbox", { name: /Export Peer/ }).uncheck();
    await expect(selection).toContainText("Students: 1 of 2 selected");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(selection.getByRole("button", { name: "Export", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("answer-export-mobile.png") });
    await selection.getByRole("button", { name: "Cancel", exact: true }).click();
    const sam = students.find((student) => student.email === "student@cognelo.local")!;
    const before = await prisma.testItemAttempt.findMany({ where: { parentAttempt: { activityId: testId } }, orderBy: { id: "asc" } });
    const { writeFile } = await import("node:fs/promises");
    for (const includePrompt of [true, false]) {
      const response = await teacherApi.post(endpoint, { data: { participantIds: [sam.participantId], includePrompt, includeGrading: false, locale: "fr", format: "pdf" } });
      expect(response.ok(), await response.text().then((s) => s.slice(0, 200))).toBe(true);
      await writeFile(testInfo.outputPath(includePrompt ? "test-with-prompts.pdf" : "test-answers-only.pdf"), await response.body());
    }
    const response = await teacherApi.post(endpoint, { data: { participantIds: students.map((student) => student.participantId), includePrompt: true, includeGrading: true, locale: "en", format: "zip" } });
    expect(response.ok()).toBe(true);
    const archive = unzipSync(await response.body()); expect(Object.keys(archive)).toHaveLength(2);
    await writeFile(testInfo.outputPath("two-students.zip"), await response.body());
    expect(await prisma.testItemAttempt.findMany({ where: { parentAttempt: { activityId: testId } }, orderBy: { id: "asc" } })).toEqual(before);
  } finally {
    await peer?.dispose(); await student.dispose(); await admin.dispose();
    if (peerId) await prisma.user.delete({ where: { id: peerId } });
  }
});
