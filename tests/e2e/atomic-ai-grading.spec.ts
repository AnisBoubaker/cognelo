import { createServer } from "node:http";
import { prisma } from "@cognelo/db";
import { encryptCredential } from "@cognelo/core";
import type { APIRequestContext } from "@playwright/test";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials } from "./fixtures/auth";
import type { AiGradingRunSummary } from "@cognelo/contracts";

test("atomic Test AI grading supports cancel, keep, discard, failed requests and reload recovery", async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(180_000);
  let mode: "normal" | "fail-second" | "gate-third" = "normal";
  let calls = 0;
  let release = () => {};
  let gate: Promise<void> = Promise.resolve();
  const reset = (next: typeof mode) => { mode = next; calls = 0; gate = new Promise<void>(resolve => { release = resolve; }); };
  const provider = createServer(async (request, response) => {
    let body = ""; for await (const chunk of request) body += chunk;
    const payload = JSON.parse(JSON.parse(body).input);
    const number = ++calls;
    if (mode === "gate-third" && number === 3) await gate;
    if (mode === "fail-second" && number === 2) { response.writeHead(503); response.end("Provider unavailable"); return; }
    response.writeHead(200, { "Content-Type": "application/json" });
    if (payload.questions) {
      response.end(JSON.stringify({ output_text: JSON.stringify({ summary: "New MCQ explanation", questionFeedback:
        payload.questions.map((question: { id: string }) => ({ questionId: question.id, explanation: "The answer is correct." })) }) }));
      return;
    }
    response.end(JSON.stringify({ output_text: JSON.stringify({ summary: "New staged assessment", strengths: ["Clear code"], improvements: ["Check limits"],
      criteria: payload.rubric.criteria.map((criterion: { id: string }) => ({ criterionId: criterion.id, scorePercent: 80, feedback: "New criterion feedback" })) }) }));
  });
  await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve));
  const port = (provider.address() as { port: number }).port;
  const connection = await prisma.aiAgentConnection.create({ data: { displayName: `Atomic AI ${data.token}`, provider: "openai", model: "local-test-model", ownerId: null,
    baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: encryptCredential("synthetic-key") } });
  const student = await createAuthenticatedApi("student"), admin = await createAuthenticatedApi("admin");
  let peer: APIRequestContext | undefined, peerId: string | undefined;
  try {
    const account = { email: `atomic-ai-${data.token}@example.test`, password: "AtomicAi123!" };
    const { user } = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: { ...account, firstName: "Zeta", lastName: "Atomic", roles: ["student"] } }));
    peerId = user.id;
    await prisma.user.update({ where: { id: peerId }, data: { emailVerifiedAt: new Date(), mustChangePassword: false } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: account.email, role: "student" } }));
    peer = await createAuthenticatedApiWithCredentials(account);
    await prisma.course.update({ where: { id: data.courseId }, data: { metadata: { aiSettings: { automaticFeedbackEnabled: true, assessmentFeedbackAiAgentConnectionId: connection.id } } } });
    const base = `/api/courses/${data.courseId}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string; title: string } } }>(await teacherApi.post(`${base}/tests`, { data: {
      title: `Atomic AI ${data.token}`, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true }
    } }));
    const activityId = created.activity.id;
    const children: Array<{ id: string; activityId: string }> = [];
    for (const number of [1, 2]) {
      const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacherApi.post(`${base}/activities/${activityId}/test/items`, { data: {
        source: "local", activityTypeKey: "coding-exercise", title: `Program ${number}`, pointsPossible: 10,
        config: { language: "python", prompt: "Print one.", starterCode: "", sampleTests: [] }
      } }));
      children.push(item);
      await responseJson(await teacherApi.put(`${base}/activities/${item.activityId}/coding-exercises/hidden-tests`, { data: { tests: [], referenceSolution: "print(1)",
        privateConfig: { templateSource: "{{ STUDENT_CODE }}", aiFeedback: { enabled: true, gradingEnabled: true, instructions: "Grade the solution.", testWeightPercent: 0, aiWeightPercent: 100,
          criteria: [{ id: "quality", title: "Quality", description: "Correct code", weightPercent: 100 }] } } } }));
    }
    await assignCourseTest(data, activityId, created.activity.title);
    const assigned = `${base}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const ids: string[] = [];
    for (const [index, learner] of [student, peer].entries()) {
      const sessionId = `atomic-${index}`;
      const { runtime } = await responseJson<{ runtime: { attempt: { id: string } } }>(await learner.post(`${assigned}/test`, { data: { sessionId } }));
      const parentAttemptId = runtime.attempt.id; ids.push(parentAttemptId);
      for (const child of children) await responseJson(await learner.put(`${assigned}/test/items/${child.id}`, { data: { parentAttemptId, sessionId, state: { sourceCode: `print(1) # ${index}` } } }));
      await responseJson(await learner.post(`${assigned}/test/submit`, { data: { parentAttemptId, sessionId } }));
      for (const child of children) {
        const path = `${base}/gradebook/attempts/${parentAttemptId}/test-items/${child.id}/review`;
        const { review } = await responseJson<{ review: { updatedAt: string; feedbackHash: string } }>(await teacherApi.get(path));
        await responseJson(await teacherApi.patch(path, { data: { score: 3, expectedUpdatedAt: review.updatedAt, expectedFeedbackHash: review.feedbackHash } }));
      }
    }
    const evidence = async () => ({
      grades: await prisma.grade.findMany({ where: { selectedAttemptId: { in: ids } }, orderBy: { selectedAttemptId: "asc" } }),
      children: await prisma.testItemAttempt.findMany({ where: { parentAttemptId: { in: ids } }, orderBy: { id: "asc" } })
    });
    const gradebookItem = await prisma.gradebookItem.findFirstOrThrow({ where: { activityId, groupId: data.groupId } });
    await responseJson(await teacherApi.patch(`${base}/gradebook/items/${gradebookItem.id}/release`, { data: { released: true } }));
    const before = await evidence();
    // A single Test must not retain the first question's score when the second question fails.
    reset("fail-second");
    expect((await teacherApi.post(`${base}/gradebook/attempts/${ids[0]}/ai-feedback`, { data: {} })).ok()).toBe(false);
    expect(calls).toBe(2);
    expect(await evidence()).toEqual(before);
    const runs = `${base}/gradebook/activities/${activityId}/ai-grading-runs`;
    expect((await student.post(runs, { data: { attemptIds: ids } })).status()).toBe(403);
    // Browser cancellation during the second student's first question.
    reset("gate-third");
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${activityId}`);
    await page.getByRole("button", { name: "AI-assess all submissions", exact: true }).click();
    await page.getByRole("dialog", { name: "Prepare batch AI grading" }).getByRole("button", { name: "Start AI grading", exact: true }).click();
    await expect.poll(() => calls, { timeout: 30_000 }).toBe(3);
    expect(await evidence()).toEqual(before);
    expect(await (await student.get(`${base}/groups/${data.groupId}/grades`)).text()).not.toContain("New staged assessment");
    const progress = page.getByRole("dialog", { name: "Assessing submissions", exact: true });
    await expect(progress.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await progress.getByRole("button", { name: "Cancel", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(progress.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    const decision = page.getByRole("dialog", { name: "AI grading stopped", exact: true });
    await expect(decision.getByRole("heading", { name: "Completed grading (1)", exact: true })).toBeVisible();
    await expect(decision.getByRole("heading", { name: "Not graded (1)", exact: true })).toBeVisible();
    const { run: cancelled } = await responseJson<{ run: AiGradingRunSummary }>(await teacherApi.get(runs));
    for (const person of cancelled.students) await expect(decision.getByText(person.name, { exact: true })).toBeVisible();
    const completedId = cancelled.students.find(person => person.status === "completed")!.attemptId;
    const pendingId = cancelled.students.find(person => person.status !== "completed")!.attemptId;
    expect(JSON.stringify(cancelled)).not.toContain("New staged assessment");
    await decision.getByRole("button", { name: "Keep completed grading", exact: true }).click();
    await expect(decision).toBeHidden();
    release();
    await expect.poll(async () => (await prisma.grade.findFirst({ where: { selectedAttemptId: completedId } }))?.normalizedScore).toBe(16);
    expect((await prisma.grade.findFirstOrThrow({ where: { selectedAttemptId: pendingId } })).normalizedScore).toBe(6);
    expect(await prisma.testItemAttempt.findMany({ where: { parentAttemptId: pendingId }, orderBy: { id: "asc" } })).toEqual(before.children.filter(child => child.parentAttemptId === pendingId));
    // Lost page/session: completed results remain private and recovery offers the same decision.
    reset("normal");
    const kept = await evidence();
    const { run: interrupted } = await responseJson<{ run: AiGradingRunSummary }>(await teacherApi.post(runs, { data: { attemptIds: ids } }));
    const runPath = `${base}/gradebook/ai-grading-runs/${interrupted.id}`;
    await responseJson(await teacherApi.post(`${runPath}/attempts/${ids[0]}`));
    expect(await evidence()).toEqual(kept);
    await prisma.aiGradingRun.update({ where: { id: interrupted.id }, data: { heartbeatAt: new Date(Date.now() - 60_000) } });
    await page.reload();
    await expect(decision).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "tmp/ai-grading-recovery-mobile.png", fullPage: true });
    await decision.getByRole("button", { name: "Discard this run", exact: true }).click();
    await expect(decision).toBeHidden();
    expect(await evidence()).toEqual(kept);
    // A provider outage yields the same durable review state and leaves grades untouched.
    reset("fail-second");
    const { run: failed } = await responseJson<{ run: AiGradingRunSummary }>(await teacherApi.post(runs, { data: { attemptIds: ids } }));
    const failedPath = `${base}/gradebook/ai-grading-runs/${failed.id}`;
    const { run: failure } = await responseJson<{ run: AiGradingRunSummary }>(await teacherApi.post(`${failedPath}/attempts/${ids[0]}`));
    expect(failure).toMatchObject({ status: "review", completed: 0, stopReason: "failed" });
    expect(await evidence()).toEqual(kept);
    await responseJson(await teacherApi.patch(failedPath, { data: { action: "discard" } }));
    // Stale grades cannot be overwritten when the teacher chooses Keep.
    reset("normal");
    const { run: stale } = await responseJson<{ run: AiGradingRunSummary }>(await teacherApi.post(runs, { data: { attemptIds: ids } }));
    const stalePath = `${base}/gradebook/ai-grading-runs/${stale.id}`;
    for (const attemptId of ids) await responseJson(await teacherApi.post(`${stalePath}/attempts/${attemptId}`));
    await responseJson(await teacherApi.patch(stalePath, { data: { action: "cancel" } }));
    // In commit order, the later student's conflict must roll back the earlier student's save too.
    await prisma.grade.updateMany({ where: { selectedAttemptId: [...ids].sort().at(-1)! }, data: { updatedAt: new Date(Date.now() + 1000) } });
    const revised = await evidence();
    expect((await teacherApi.patch(stalePath, { data: { action: "keep" } })).status()).toBe(409);
    expect(await evidence()).toEqual(revised);
    await responseJson(await teacherApi.patch(stalePath, { data: { action: "discard" } }));
    // The same durable boundary also protects standalone feedback-only activities.
    await responseJson(await teacherApi.patch(data.courseActivityPath, { data: { config: {
      source: ORIGINAL_SOURCE, aiFeedbackEnabled: true, aiFeedbackInstructions: "Explain the student's reasoning.", randomizeChoices: false
    } } }));
    await responseJson(await student.post(`${base}/groups/${data.groupId}/activities/assigned/${data.activityId}/mcq/submission`, {
      data: { answers: { "question-1": ["question-1-choice-1"] } }
    }));
    const mcqAttempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: data.activityId, groupId: data.groupId } });
    const mcqGrade = await prisma.grade.findFirstOrThrow({ where: { selectedAttemptId: mcqAttempt.id } });
    const { run: mcqRun } = await responseJson<{ run: AiGradingRunSummary }>(await teacherApi.post(`${base}/gradebook/activities/${data.activityId}/ai-grading-runs`, { data: { attemptIds: [mcqAttempt.id] } }));
    const mcqPath = `${base}/gradebook/ai-grading-runs/${mcqRun.id}`;
    const { run: ready } = await responseJson<{ run: AiGradingRunSummary }>(await teacherApi.post(`${mcqPath}/attempts/${mcqAttempt.id}`));
    expect(ready).toMatchObject({ status: "running", completed: 1 });
    const callCount = calls;
    await responseJson(await teacherApi.post(`${mcqPath}/attempts/${mcqAttempt.id}`));
    expect(calls).toBe(callCount);
    expect((await student.get(mcqPath)).status()).toBe(404);
    expect(await prisma.grade.findUniqueOrThrow({ where: { id: mcqGrade.id } })).toEqual(mcqGrade);
    await responseJson(await teacherApi.patch(mcqPath, { data: { action: "finish" } }));
    const published = await prisma.grade.findUniqueOrThrow({ where: { id: mcqGrade.id } });
    expect(published.normalizedScore).toBe(mcqGrade.normalizedScore);
    expect(JSON.stringify(published.normalizedResult)).toContain("New MCQ explanation");
    expect((await responseJson<{ run: AiGradingRunSummary }>(await teacherApi.patch(mcqPath, { data: { action: "finish" } }))).run.status).toBe("completed");

  } finally {
    release(); provider.closeAllConnections();
    await student.dispose(); await admin.dispose(); await peer?.dispose();
    if (peerId) await prisma.user.deleteMany({ where: { id: peerId } });
    await prisma.aiAgentConnection.delete({ where: { id: connection.id } });
    await new Promise<void>(resolve => provider.close(() => resolve()));
  }
});
