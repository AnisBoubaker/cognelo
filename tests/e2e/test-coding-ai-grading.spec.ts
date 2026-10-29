import { createServer } from "node:http";
import { prisma } from "@cognelo/db";
import { encryptCredential } from "@cognelo/core";
import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials } from "./fixtures/auth";
import type { CourseTestRuntime } from "../../apps/web/src/lib/api";

test("Test AI grading uses matching question templates and authoritative question instructions", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(180_000);
  // Only the remote model is replaced. Submission, plugin dispatch, persistence, and grading are real.
  const requests: Array<{ systemPrompt: string; submission: { sourceCode: string }; rubric: { instructions: string; criteria: Array<{ id: string }> };
    gradingTemplates?: Array<{ submission: { sourceCode: string }; feedback: Record<string, unknown> }> }> = [];
  const provider = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      const envelope = JSON.parse(body);
      const payload = { ...JSON.parse(envelope.input), systemPrompt: envelope.instructions } as typeof requests[number];
      requests.push(payload);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ output_text: JSON.stringify({
        summary: "Reviewed submitted code.", strengths: ["Clear approach."], improvements: ["Check edge cases."],
        criteria: payload.rubric.criteria.map(c => ({ criterionId: c.id, scorePercent: 80, feedback: "Mostly meets this criterion." }))
      }) }));
    } catch { response.writeHead(500); response.end(); }
  });
  await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address() as { port: number };
  const connection = await prisma.aiAgentConnection.create({ data: {
    displayName: `Test AI fixture ${data.token}`, provider: "openai", model: "local-test-model", ownerId: null,
    baseUrl: `http://127.0.0.1:${address.port}/v1`, apiKey: encryptCredential("synthetic-test-key")
  } });
  const student = await createAuthenticatedApi("student"), admin = await createAuthenticatedApi("admin");
  let peer: APIRequestContext | undefined, peerId: string | undefined;
  try {
    const account = { email: `test-ai-${data.token}@example.test`, password: "TestAiGrading123!" };
    const { user } = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: { ...account, firstName: "AI", lastName: "Peer", roles: ["student"] } }));
    peerId = user.id;
    await prisma.user.update({ where: { id: peerId }, data: { emailVerifiedAt: new Date(), mustChangePassword: false } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: account.email, role: "student" } }));
    peer = await createAuthenticatedApiWithCredentials(account);
    await prisma.course.update({ where: { id: data.courseId }, data: { metadata: { aiSettings: {
      automaticFeedbackEnabled: true, assessmentFeedbackAiAgentConnectionId: connection.id
    } } } });
    const { test: created } = await responseJson<{ test: { activity: { id: string; title: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title: `Coding AI Test ${data.token}`, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true }
    } }));
    const activityId = created.activity.id;
    const children: Array<{ id: string; activityId: string; privatePath: string; tests: unknown[] }> = [];
    for (const hasTests of [true, false]) {
      const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
        source: "local", activityTypeKey: "coding-exercise", title: hasTests ? "Tests and rubric" : "Rubric only",
        config: { language: "python", prompt: "Print one.", starterCode: "", sampleTests: [] }, pointsPossible: 10
      } }));
      const tests = hasTests ? [{ id: "output", name: "Output", stdin: "", expectedOutput: "1", isEnabled: true, weight: 1 }] : [];
      const privatePath = `/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`;
      await responseJson(await teacherApi.put(privatePath, { data: { tests, referenceSolution: "print(1)", privateConfig: { templateSource: "{{ STUDENT_CODE }}" } } }));
      children.push({ ...item, privatePath, tests });
    }
    await assignCourseTest(data, activityId, created.activity.title);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const ids: string[] = [];
    for (const [index, learner] of [student, peer].entries()) {
      const sessionId = `ai-${index}`;
      const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await learner.post(`${assigned}/test`, { data: { sessionId } }));
      const parentAttemptId = runtime.attempt!.id;
      ids.push(parentAttemptId);
      for (const child of children) await responseJson(await learner.put(`${assigned}/test/items/${child.id}`, { data: {
        parentAttemptId, sessionId, state: { sourceCode: `print(1) # learner ${index}, question ${children.indexOf(child)}` }
      } }));
      await responseJson(await learner.post(`${assigned}/test/submit`, { data: { parentAttemptId, sessionId } }));
    }
    const before = await prisma.activityAttempt.findMany({ where: { id: { in: ids } }, include: { testItemAttempts: true } });
    for (const parent of before) for (const child of parent.testItemAttempts) {
      expect(child.pluginAttemptRef).toBe((child.result as { state: { executionId: string } }).state.executionId);
    }
    expect(requests).toHaveLength(0); // Summative submission never invokes AI.
    // Emulate pre-fix records for one learner; the other retains the new explicit links.
    await prisma.testItemAttempt.updateMany({ where: { parentAttemptId: ids[0] }, data: { pluginAttemptRef: null } });
    const executionEvidence = () => prisma.$queryRaw`SELECT e.* FROM "PluginCodingExerciseExecution" e JOIN "TestItemAttempt" c ON e.id=c.result->'state'->>'executionId' WHERE c."parentAttemptId" IN (${ids[0]}, ${ids[1]}) ORDER BY e.id`;
    const originalExecutions = await executionEvidence();
    // Add the rubric only AFTER both learners submitted, matching the regression.
    const instructionsFor = (child: typeof children[number]) => child.tests.length
      ? "Tests and rubric: user-facing input prompts are allowed even when sample output omits them."
      : "Rubric only: credit a clear solution and give concise feedback.";
    for (const child of children) await responseJson(await teacherApi.put(child.privatePath, { data: {
      tests: child.tests, referenceSolution: "print(1)", privateConfig: {
        templateSource: "{{ STUDENT_CODE }}", aiFeedback: {
          enabled: true, gradingEnabled: true, instructions: instructionsFor(child),
          testWeightPercent: child.tests.length ? 50 : 0, aiWeightPercent: child.tests.length ? 50 : 100,
          criteria: [{ id: "new-quality", title: "Quality", description: "Evaluate the submitted solution.", weightPercent: 100 }]
        }
      }
    } }));
    expect((await student.post(`/api/courses/${data.courseId}/gradebook/attempts/${ids[0]}/ai-feedback`, { data: {} })).status()).toBe(403);
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${activityId}`);
    await page.getByRole("button", { name: "AI-assess all submissions", exact: true }).click();
    const emptySetup = page.getByRole("dialog", { name: "Prepare batch AI grading", exact: true });
    await expect(emptySetup.getByRole("textbox")).toHaveCount(0);
    await expect(emptySetup.getByRole("checkbox")).toHaveCount(0);
    await expect(emptySetup.getByText("Graded examples become available once their grading feedback is complete.", { exact: true })).toBeVisible();
    await emptySetup.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(requests).toHaveLength(0);
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/gradebook/attempts/${ids[0]}/ai-feedback`, { data: {} }));
    expect(requests).toHaveLength(2);
    expect((await teacherApi.patch(`/api/courses/${data.courseId}/gradebook/activities/${activityId}/ai-grading-batch`, {
      data: { attemptId: ids[1], instructions: "No Test-wide policy" }
    })).status()).toBe(400);
    expect((await teacherApi.post(`/api/courses/${data.courseId}/gradebook/attempts/${ids[1]}/ai-feedback`, {
      data: { triggerKind: "teacher_batch", instructions: "Do not replace question policy", templateAttemptIds: [ids[0]] }
    })).status()).toBe(400);
    expect((await teacherApi.post(`/api/courses/${data.courseId}/gradebook/attempts/${ids[0]}/ai-feedback`, {
      data: { triggerKind: "teacher_batch", templateAttemptIds: [ids[0]] }
    })).status()).toBe(400);
    expect(requests).toHaveLength(2);
    const batchRequests: Array<{ id: string; body: Record<string, unknown> }> = [];
    const instructionWrites: string[] = [];
    page.on("request", request => {
      if (request.method() === "POST" && request.url().endsWith("/ai-feedback")) {
        batchRequests.push({ id: new URL(request.url()).pathname.split("/").at(-2)!, body: request.postDataJSON() });
      }
      if (request.method() === "PATCH" && request.url().endsWith("/ai-grading-batch")) instructionWrites.push(request.url());
    });
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${activityId}`);
    await page.getByRole("button", { name: "AI-assess all submissions", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Prepare batch AI grading", exact: true });
    await expect(dialog.getByRole("textbox", { name: "AI instructions", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("checkbox", { name: "Update AI instructions in the activity settings", exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Each question uses its own saved AI grading instructions.", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("checkbox")).toHaveCount(1);
    await expect(dialog.getByText("Complete question feedback: 2", { exact: true })).toBeVisible();
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Start AI grading", exact: true }).click();
    await expect.poll(() => requests.length, { timeout: 60_000 }).toBe(4);
    await expect(page.getByRole("dialog", { name: "Assessing submissions" })).toBeHidden({ timeout: 30_000 });
    expect(batchRequests).toEqual([{ id: ids[1], body: { triggerKind: "teacher_batch", templateAttemptIds: [ids[0]] } }]);
    expect(instructionWrites).toHaveLength(0);
    for (const [index, child] of children.entries()) {
      const calls = requests.filter(request => request.submission.sourceCode.endsWith(`question ${index}`));
      expect(calls).toHaveLength(2);
      for (const call of calls) {
        expect(call.rubric.instructions).toBe(instructionsFor(child));
        expect(call.systemPrompt).toContain(instructionsFor(child));
        expect(call.systemPrompt).toContain("highest priority");
      }
      const target = calls.find(call => call.submission.sourceCode.includes("learner 1"))!;
      expect(target.gradingTemplates).toHaveLength(1);
      expect(target.gradingTemplates![0].submission.sourceCode).toBe(`print(1) # learner 0, question ${index}`);
      expect(JSON.stringify(target.gradingTemplates)).not.toContain(ids[0]);
      expect(JSON.stringify(target.gradingTemplates)).not.toContain("@cognelo.local");
      expect(JSON.stringify(target.gradingTemplates)).not.toContain(account.email);
    }
    const grades = await prisma.grade.findMany({ where: { selectedAttemptId: { in: ids } } });
    expect(grades).toHaveLength(2);
    for (const grade of grades) expect(grade.normalizedScore / grade.normalizedMaxScore).toBeCloseTo(0.85);
    expect(requests.every(r => r.rubric.criteria[0].id === "new-quality")).toBe(true);
    expect(await executionEvidence()).toEqual(originalExecutions);
    const after = await prisma.activityAttempt.findMany({ where: { id: { in: ids } }, include: { testItemAttempts: true, gradebookItem: true } });
    for (const parent of after) {
      const original = before.find(p => p.id === parent.id)!;
      expect(parent.startedAt).toEqual(original.startedAt);
      expect(parent.submittedAt).toEqual(original.submittedAt);
      expect(parent.gradebookItem.gradesReleased).toBe(false);
      for (const child of parent.testItemAttempts) {
        const { aiFeedbackRef, aiFeedbackVersion, ...originalResult } = child.result as Record<string, unknown>;
        expect(aiFeedbackRef).toEqual(expect.any(String));
        expect(aiFeedbackVersion).toBe(1);
        expect(originalResult).toEqual(original.testItemAttempts.find(c => c.id === child.id)!.result);
        expect(child.submittedAt).toEqual(original.testItemAttempts.find(c => c.id === child.id)!.submittedAt);
      }
    }
    const evaluations = await prisma.$queryRaw<Array<{ deterministicScore: number | null; combinedScore: number }>>`SELECT "deterministicScore", "combinedScore" FROM "PluginCodingExerciseAiEvaluation" WHERE "coreAttemptId" IN (${ids[0]}, ${ids[1]}) ORDER BY "combinedScore"`;
    expect(evaluations).toEqual([
      { deterministicScore: null, combinedScore: 80 }, { deterministicScore: null, combinedScore: 80 },
      { deterministicScore: 100, combinedScore: 90 }, { deterministicScore: 100, combinedScore: 90 }
    ]);
    const reruns = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginCodingExerciseTestEvaluation" WHERE "activityId" IN (${children[0].activityId}, ${children[1].activityId})`;
    expect(Number(reruns[0].count)).toBe(0);
  } finally {
    await student.dispose(); await admin.dispose(); await peer?.dispose();
    if (peerId) await prisma.user.deleteMany({ where: { id: peerId } });
    await prisma.aiAgentConnection.delete({ where: { id: connection.id } });
    await new Promise<void>((resolve, reject) => provider.close(error => error ? reject(error) : resolve()));
  }
});
