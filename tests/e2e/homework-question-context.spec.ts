import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("homework questions use course language and teacher policy, and show submitted code after the answer gate", async ({ bankCourse: data, teacherApi, teacherPage, studentPage }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data, { hold: true, questionText: number => `Question ${number} : expliquez le résultat de cette fonction pour les arguments deux et trois.` });
  const student = await createAuthenticatedApi("student");
  let activityId: string | undefined;
  try {
    await responseJson(await teacherApi.patch(`/api/subjects/${data.subjectId}`, { data: { teachingLanguage: "fr" } }));
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "French defense questions", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    const instruction = "PRIVATE_TEACHER_POLICY: Ask only concrete tracing questions. Use inputs 2 and 3. Never ask about complexity.";
    await teacherPage.goto(`/courses/${data.courseId}/activities/${activityId}`);
    await teacherPage.getByRole("tab", { name: "Settings", exact: true }).click();
    const settings = teacherPage.locator(".homework-workflow-settings");
    await expect(settings.getByLabel("AI question-generation instructions", { exact: true })).toBeEnabled();
    await settings.getByLabel("AI question-generation instructions", { exact: true }).fill(instruction);
    await expect(settings.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    let releaseSave = () => {};
    const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
    await teacherPage.route(`**${base}/authoring`, async route => {
      if (route.request().method() === "PUT") await saveGate;
      await route.continue().catch(() => {});
    });
    await settings.getByRole("button", { name: "Save", exact: true }).click();
    try { await expect(teacherPage.getByRole("dialog", { name: "Save", exact: true })).toBeVisible(); }
    finally { releaseSave(); }
    await teacherPage.unroute(`**${base}/authoring`);

    await expect(teacherPage.getByText("Coding homework saved.", { exact: true })).toBeVisible();
    await teacherPage.reload();
    await teacherPage.getByRole("tab", { name: "Settings", exact: true }).click();
    await expect(settings.getByLabel("AI question-generation instructions", { exact: true })).toHaveValue(instruction);
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${base}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId, availableFrom: null, availableUntil: null, metadata: { assessmentMode: "summative" }, config: {}, gradebookSettings: { pointsPossible: 100, maxAttempts: 1, attemptLimitMode: "max_attempts", gradeStrategy: "latest" } } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const endpoint = `${assigned}/coding-homework-grader`;
    const source = [
      "int add(int left, int right)", "{", '    /* <script>alert("code")</script> */',
      '    const char *description = "This intentionally long source line verifies that code scrolls inside its own panel without widening the question or answer area.";',
      "    (void)description;", "    int result = left;", "", "    if (right >= 0)", "    {",
      "        for (int step = 0; step < right; step++)", "        {", "            result++;", "        }", "    }", "    else", "    {",
      "        for (int step = 0; step > right; step--)", "        {", "            result--;", "        }", "    }", "", "    return result;", "}"
    ].join("\n");
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "src/main.c", expectedRevision: 0, replace: false, base64: Buffer.from(source).toString("base64") } }));
    // A conflicting browser/session locale must never choose the academic question language.
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1, locale: "ar" } }));
    await expect.poll(() => model.active, { timeout: 30_000 }).toBe(1);
    const [submission] = await prisma.$queryRaw<Array<{ id: string; metadata: { questionLanguage: string; assignment: { generationInstructions: string } } }>>`SELECT id, metadata FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${activityId}`;
    expect(submission.metadata.questionLanguage).toBe("fr");
    expect(submission.metadata.assignment.generationInstructions).toBe(instruction);
    // Settings changed after hand-in must not split a student's question set across languages.
    await responseJson(await teacherApi.patch(`/api/subjects/${data.subjectId}`, { data: { teachingLanguage: "en" } }));
    model.release();
    await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${endpoint}/workspace`))).submission.status, { timeout: 40_000 }).toBe("challenge_ready");
    const prompts = model.requests.filter(request => request.path.endsWith("/responses"));
    expect(prompts).toHaveLength(3);
    for (const prompt of prompts) {
      expect(prompt.systemPrompt).toContain("COURSE TEACHING LANGUAGE: French");
      expect(prompt.systemPrompt).toContain(instruction);
      expect(prompt.systemPrompt).toContain("complete answer fits in 2–3 sentences");
      expect(prompt.systemPrompt).toContain("A student who wrote this code should reasonably be able to answer");
      expect(prompt.userPrompt).not.toContain(instruction);
    }
    expect((await student.get(`${endpoint}/answering`)).status()).toBe(409);
    const privateBeforeStart = JSON.stringify(await responseJson(await student.get(`${endpoint}/workspace`)));
    expect(privateBeforeStart).not.toContain("questionText"); expect(privateBeforeStart).not.toContain("functionName");
    // Simulate an existing question set without the new context snapshot: its retained function must still display.
    await prisma.$executeRaw`UPDATE "PluginCodingHomeworkChallengeQuestion" SET metadata=metadata-'studentCodeContext' WHERE "submissionId"=${submission.id}`;
    await studentPage.goto(assigned.replace(/^\/api/, ""));
    await studentPage.getByRole("button", { name: "Answer challenge questions", exact: true }).click();
    await expect(studentPage.getByRole("heading", { name: "Challenge questions", exact: true })).toBeVisible();
    const cards = studentPage.locator(".homework-challenge-question");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(1).getByRole("heading", { name: "Question 2 of 3", exact: true })).toBeVisible();
    const contexts = studentPage.getByRole("region", { name: "Submitted code context", exact: true });
    await expect(contexts).toHaveCount(3);
    await expect(contexts.first().locator(".code-renderer-line-content")).toHaveText(source.split("\n"));
    await expect(contexts.first()).toContainText("src/main.c");
    await expect(contexts.first().locator("textarea, input, [contenteditable=true], script")).toHaveCount(0);
    await expect(studentPage.getByText("Question 1 : expliquez le résultat de cette fonction pour les arguments deux et trois.", { exact: true })).toBeVisible();
    const publicQuestions = await responseJson<{ questions: Array<{ context: { code: string; functionName: string; filePath: string } }> }>(await student.get(`${endpoint}/answering`));
    expect(publicQuestions.questions[0].context).toMatchObject({ code: source, functionName: "add", filePath: "src/main.c" });
    expect(JSON.stringify(publicQuestions)).not.toMatch(/PRIVATE_TEACHER_POLICY|nearestExamples|astText|storedName|generationModel/);
    await studentPage.getByRole("textbox", { name: "Your answer Question 1 of 3", exact: true }).fill("La fonction retourne cinq.");
    await expect(studentPage.getByText("Saved", { exact: true })).toBeVisible();
    await studentPage.reload();
    await expect(contexts.first().locator(".code-renderer-line-content")).toHaveText(source.split("\n"));
    await expect(studentPage.locator('textarea[id^="answer-"]').first()).toHaveValue("La fonction retourne cinq.");
    const desktop = await cards.first().evaluate(card => {
      const header = card.querySelector("header")!.getBoundingClientRect();
      const code = card.querySelector(".homework-question-context")!.getBoundingClientRect();
      const answer = card.querySelector("textarea")!.getBoundingClientRect();
      return { promptBeforeCode: header.bottom <= code.top, sideBySide: answer.left >= code.right };
    });
    expect(desktop).toEqual({ promptBeforeCode: true, sideBySide: true });
    await cards.first().scrollIntoViewIfNeeded();
    await studentPage.screenshot({ path: "tmp/homework-question-cards-desktop.png" });
    await studentPage.setViewportSize({ width: 390, height: 844 });
    const mobile = await cards.first().evaluate(card => {
      const code = card.querySelector(".homework-question-context")!.getBoundingClientRect();
      const answer = card.querySelector("textarea")!.getBoundingClientRect();
      const scroll = card.querySelector(".homework-question-context-code")!;
      return { stacked: answer.top >= code.bottom, codeScrolls: scroll.scrollWidth > scroll.clientWidth };
    });
    expect(mobile).toEqual({ stacked: true, codeScrolls: true });
    const firstCard = await cards.first().boundingBox(), secondCard = await cards.nth(1).boundingBox();
    expect(secondCard!.y - (firstCard!.y + firstCard!.height)).toBeGreaterThanOrEqual(24);
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await studentPage.screenshot({ path: "tmp/homework-question-context-mobile.png", fullPage: true });
  } finally {
    model.release();
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await student.dispose(); await model.close();
  }
});
