import { prisma } from "@cognelo/db";
import { parseMcqSource } from "@cognelo/plugin-mcq";
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, confirmSharedDialog } from "./fixtures/auth";
import type { CourseTestRuntime } from "../../apps/web/src/lib/api";

// Delay delivery of actual server progress, without replacing grading or its response.
async function holdProgress(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    const state = window as unknown as { regradePauses: number; resumeRegrade?: () => void };
    state.regradePauses = 0;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (!String(args[0]).endsWith("/regrade") || !response.headers.get("content-type")?.includes("application/x-ndjson")) return response;
      let held = false;
      let buffered = "";
      const transformed = response.body!.pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream<string, Uint8Array>({
        async transform(chunk, controller) {
          buffered += chunk;
          const lines = buffered.split("\n");
          buffered = lines.pop() ?? "";
          for (const line of lines) {
            controller.enqueue(new TextEncoder().encode(`${line}\n`));
            if (!held && line.includes('"completed":1,')) {
              held = true;
              state.regradePauses++;
              await new Promise<void>(resolve => { state.resumeRegrade = resolve; });
            }
          }
        },
        flush(controller) { if (buffered) controller.enqueue(new TextEncoder().encode(buffered)); }
      }));
      return new Response(transformed, { status: response.status, headers: response.headers });
    };
  });
}

async function resumeProgress(page: Page) {
  await page.evaluate(() => (window as unknown as { resumeRegrade?: () => void }).resumeRegrade?.());
}

async function answerMcqTest(api: APIRequestContext, assigned: string, itemIds: string[], sessionId: string) {
  const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await api.post(`${assigned}/test`, { data: { sessionId } }));
  const question = parseMcqSource(ORIGINAL_SOURCE, "none").questions[0];
  for (const id of itemIds) await responseJson(await api.put(`${assigned}/test/items/${id}`, { data: {
    parentAttemptId: runtime.attempt!.id, sessionId,
    state: { answers: { [question.id]: [question.choices.find(c => c.isCorrect)!.id] } }
  } }));
  await responseJson(await api.post(`${assigned}/test/submit`, { data: { parentAttemptId: runtime.attempt!.id, sessionId } }));
  return runtime.attempt!.id;
}

test("individual and whole-class Test regrading rerun every child and display measured progress", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student"), admin = await createAuthenticatedApi("admin");
  const account = { email: `regrade-${data.token}@example.test`, password: "TestRegrade123!" };
  let peer: APIRequestContext | undefined, peerId: string | undefined;
  try {
    const { user } = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: { ...account, firstName: "Regrade", lastName: "Peer", roles: ["student"] } }));
    peerId = user.id;
    await prisma.user.update({ where: { id: peerId }, data: { emailVerifiedAt: new Date(), mustChangePassword: false } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: account.email, role: "student" } }));
    peer = await createAuthenticatedApiWithCredentials(account);
    const title = `Regrade Test ${data.token}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true }
    } }));
    const activityId = created.activity.id;
    const children: Array<{ id: string; activityId: string }> = [];
    for (let n = 1; n <= 2; n++) {
      const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
        source: "local", activityTypeKey: "mcq", title: `Exercise ${n}`, lifecycle: "published", config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: n * 10
      } }));
      children.push(item);
    }
    await assignCourseTest(data, activityId, title);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const ids = [await answerMcqTest(student, assigned, children.map(c => c.id), "student"), await answerMcqTest(peer, assigned, children.map(c => c.id), "peer")];
    const before = await prisma.activityAttempt.findMany({ where: { id: { in: ids } }, include: { testItemAttempts: true } });
    const auditCount = () => prisma.courseAuditEvent.count({ where: { courseId: data.courseId, eventType: "test_item_regraded" } });
    const corrected = ORIGINAL_SOURCE.replace("[x] Four", "[ ] Four").replace("[ ] Five", "[x] Five");
    for (const child of children) await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/activities/${child.activityId}`, { data: { config: { source: corrected } } }));
    expect((await student.post(`/api/courses/${data.courseId}/gradebook/attempts/${ids[0]}/regrade`, { data: {} })).status()).toBe(403);
    await holdProgress(page);
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${activityId}`);
    const rows = page.locator(".table-row-gradebook-detail:not(.table-head)");
    await expect(rows).toHaveCount(2);
    await rows.first().getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Rerun automatic grading", exact: true }).click();
    await confirmSharedDialog(page);
    const progress = page.getByRole("dialog", { name: "Rerunning automatic grading" });
    await expect(progress).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { regradePauses: number }).regradePauses)).toBe(1);
    await expect.poll(async () => Number(await progress.getByRole("progressbar").getAttribute("value"))).toBeGreaterThan(0);
    const partial = Number(await progress.getByRole("progressbar").getAttribute("value"));
    expect(partial).toBeGreaterThan(0); expect(partial).toBeLessThan(100);
    await resumeProgress(page);
    await expect(progress).toBeHidden();
    expect(await auditCount()).toBe(2);
    const firstGrades = await prisma.grade.findMany({ where: { selectedAttemptId: { in: ids } } });
    expect(firstGrades.map(g => g.normalizedScore).sort((a, b) => a - b)).toEqual([0, 20]);
    // Rerun all includes the already-regraded Test as well as the other student's Test.
    for (const child of children) await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/activities/${child.activityId}`, { data: { config: { source: ORIGINAL_SOURCE.replace("- [x] Four\n- [ ] Five", "- [ ] Five\n- [x] Four") } } }));
    await page.getByRole("button", { name: "Rerun automatic grading for all", exact: true }).click();
    await confirmSharedDialog(page);
    for (const pause of [2, 3]) {
      await expect.poll(() => page.evaluate(() => (window as unknown as { regradePauses: number }).regradePauses)).toBe(pause);
      await expect(progress.getByRole("progressbar")).toBeVisible();
      await expect.poll(async () => Number(await progress.getByRole("progressbar").getAttribute("value"))).toBeGreaterThan(pause === 2 ? 0 : 50);
      const value = Number(await progress.getByRole("progressbar").getAttribute("value"));
      expect(value).toBeGreaterThan(pause === 2 ? 0 : 50); expect(value).toBeLessThan(100);
      await resumeProgress(page);
    }
    await expect(progress).toBeHidden();
    await expect(page.getByText("Regrade complete: 2 graded, 0 awaiting grading, 0 failed.")).toBeVisible();
    expect(await auditCount()).toBe(6);
    const after = await prisma.activityAttempt.findMany({ where: { id: { in: ids } }, include: { testItemAttempts: true, gradebookItem: true } });
    for (const p of after) {
      const original = before.find(b => b.id === p.id)!;
      expect(p.startedAt).toEqual(original.startedAt); expect(p.submittedAt).toEqual(original.submittedAt);
      expect(p.gradebookItem.gradesReleased).toBe(false);
      for (const child of p.testItemAttempts) {
        expect(child.rawScore).toBe(1);
        expect((child.result as { state: unknown }).state).toEqual((original.testItemAttempts.find(c => c.id === child.id)!.result as { state: unknown }).state);
      }
    }
    expect((await prisma.grade.findMany({ where: { selectedAttemptId: { in: ids } } })).every(g => g.normalizedScore === 20)).toBe(true);
  } finally {
    await resumeProgress(page).catch(() => {});
    await student.dispose(); await admin.dispose(); await peer?.dispose();
    if (peerId) await prisma.user.deleteMany({ where: { id: peerId } });
  }
});

test("Test regrading uses corrected and added hidden tests with current weights and the original execution", { tag: "@regression" }, async ({ bankCourse: data, teacherApi }) => {
  test.setTimeout(90_000);
  const student = await createAuthenticatedApi("student");
  try {
    const { test: created } = await responseJson<{ test: { activity: { id: string; title: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title: `Coding rerun ${data.token}`, lifecycle: "published", contentPlacement: { isVisible: true }
    } }));
    const activityId = created.activity.id;
    const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
      source: "local", activityTypeKey: "coding-exercise", title: "Corrected hidden tests", config: { language: "python", prompt: "Print the answer.", starterCode: "", sampleTests: [] }
    } }));
    const privatePath = `/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`;
    const definition = (answer: string) => ({ tests: [{ id: "output", name: "Output", stdin: "", expectedOutput: answer, isEnabled: true, weight: 1 }], referenceSolution: `print(${answer})`, privateConfig: { templateSource: "{{ STUDENT_CODE }}" } });
    await responseJson(await teacherApi.put(privatePath, { data: definition("1") }));
    await assignCourseTest(data, activityId, created.activity.title);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await student.post(`${assigned}/test`, { data: { sessionId: "coding" } }));
    const id = runtime.attempt!.id;
    await responseJson(await student.put(`${assigned}/test/items/${item.id}`, { data: { parentAttemptId: id, sessionId: "coding", state: { sourceCode: "print(2)" } } }));
    await responseJson(await student.post(`${assigned}/test/submit`, { data: { parentAttemptId: id, sessionId: "coding" } }));
    const before = await prisma.testItemAttempt.findFirstOrThrow({ where: { parentAttemptId: id } });
    expect(before.rawScore).toBe(0);
    const originalState = (before.result as { state: { executionId: string; sourceCode: string } }).state;
    await responseJson(await teacherApi.put(privatePath, { data: definition("2") }));
    const response = await responseJson<{ result: unknown; items: Array<{ status: string }> }>(await teacherApi.post(`/api/courses/${data.courseId}/gradebook/attempts/${id}/regrade`, { data: {} }));
    expect(response.result).toBeTruthy(); expect(response.items[0].status).toBe("graded");
    const after = await prisma.testItemAttempt.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.rawScore! / after.rawMaxScore!).toBe(1);
    expect((after.result as { state: unknown }).state).toEqual(originalState);
    expect(after.submittedAt).toEqual(before.submittedAt);
    const reruns = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginCodingExerciseTestEvaluation" WHERE "executionId" = ${originalState.executionId} AND status = 'completed'`;
    expect(Number(reruns[0].count)).toBe(1);

    // An added test must participate in the next rerun, with its current weight.
    await responseJson(await teacherApi.put(privatePath, { data: {
      ...definition("2"),
      tests: [...definition("2").tests, { id: "input", name: "Read the input", stdin: "3", expectedOutput: "3", isEnabled: true, weight: 3 }],
      referenceSolution: 'import sys\nprint(sys.stdin.read().strip() or "2")'
    } }));
    const addedTestRegrade = await responseJson<{ result: unknown; items: Array<{ status: string }> }>(await teacherApi.post(`/api/courses/${data.courseId}/gradebook/attempts/${id}/regrade`, { data: {} }));
    expect(addedTestRegrade.result).toBeTruthy();
    expect(addedTestRegrade.items[0].status).toBe("graded");
    const final = await prisma.testItemAttempt.findUniqueOrThrow({ where: { id: before.id } });
    expect(final.rawScore! / final.rawMaxScore!).toBe(0.25);
    expect((final.result as { state: unknown }).state).toEqual(originalState);
    expect(final.submittedAt).toEqual(before.submittedAt);
  } finally { await student.dispose(); }
});
