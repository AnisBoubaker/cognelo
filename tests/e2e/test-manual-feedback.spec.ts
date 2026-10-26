import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials } from "./fixtures/auth";
import type { CourseTestRuntime, TestItemTeacherReview } from "../../apps/web/src/lib/api";

test("Test review reuses rubric feedback, preserves overrides and answers, and protects history and stale edits", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage: page }) => {
  test.setTimeout(150_000);
  const student = await createAuthenticatedApi("student");
  const admin = await createAuthenticatedApi("admin");
  let peerId: string | undefined;
  let peer: typeof student | undefined;
  try {
    const { test: created } = await responseJson<{ test: { activity: { id: string; title: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title: `Manual feedback Test ${data.token}`, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true }
    } }));
    const children: Array<{ id: string; activityId: string }> = [];
    for (const number of [1, 2]) {
      const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/activities/${created.activity.id}/test/items`, { data: {
        source: "local", activityTypeKey: "coding-exercise", title: `Program ${number}`, pointsPossible: number * 10,
        config: { language: "python", prompt: "Print the number.", starterCode: "", sampleTests: [] }
      } }));
      children.push(item);
      await responseJson(await teacherApi.put(`/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`, { data: {
        tests: [], referenceSolution: `print(${number})`, privateConfig: { templateSource: "{{ STUDENT_CODE }}", aiFeedback: {
          enabled: false, gradingEnabled: true, testWeightPercent: 0, aiWeightPercent: 100,
          criteria: [{ id: "quality", title: "Code quality", description: "Explain the score.", weightPercent: 100 }]
        } }
      } }));
    }
    await assignCourseTest(data, created.activity.id, created.activity.title, 2);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${created.activity.id}`;
    async function submit(sessionId: string, learner = student) {
      const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await learner.post(`${assigned}/test`, { data: { sessionId } }));
      const id = runtime.attempt!.id;
      for (const [index, child] of children.entries()) await responseJson(await learner.put(`${assigned}/test/items/${child.id}`, { data: {
        parentAttemptId: id, sessionId, state: { sourceCode: `print(${index + 1})` }
      } }));
      await responseJson(await learner.post(`${assigned}/test/submit`, { data: { parentAttemptId: id, sessionId } }));
      return id;
    }
    const parentId = await submit("first");
    const account = { email: `manual-review-${data.token}@example.test`, password: "ManualReview123!" };
    const { user } = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: { ...account, firstName: "Zeta", lastName: "Review", roles: ["student"] } }));
    peerId = user.id;
    await prisma.user.update({ where: { id: peerId }, data: { emailVerifiedAt: new Date(), mustChangePassword: false } });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: account.email, role: "student" } }));
    peer = await createAuthenticatedApiWithCredentials(account);
    const peerAttempt = await submit("peer", peer);
    for (const child of children) {
      const path = `/api/courses/${data.courseId}/gradebook/attempts/${peerAttempt}/test-items/${child.id}/review`;
      const { review } = await responseJson<{ review: TestItemTeacherReview }>(await teacherApi.get(path));
      await responseJson(await teacherApi.patch(path, { data: { expectedUpdatedAt: review.updatedAt, expectedFeedbackHash: review.feedbackHash, score: 0 } }));
    }
    const before = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: parentId }, include: { testItemAttempts: true } });
    const first = before.testItemAttempts.find(item => item.testItemId === children[0].id)!;
    const recovered = before.testItemAttempts.find(item => item.testItemId === children[1].id)!;
    // Historical submission with a missing explicit reference, and a recovered answer with no runner artifact.
    await prisma.testItemAttempt.update({ where: { id: first.id }, data: { pluginAttemptRef: null } });
    const recoveredState = (recovered.result as { state: { executionId: string; sourceCode: string } }).state;
    await prisma.testItemAttempt.update({ where: { id: recovered.id }, data: { pluginAttemptRef: null, result: { state: { sourceCode: recoveredState.sourceCode } } } });
    await prisma.$executeRaw`DELETE FROM "PluginCodingExerciseExecution" WHERE id=${recoveredState.executionId} AND "activityId"=${children[1].activityId}`;
    const evidence = () => prisma.$queryRaw`SELECT id,md5(row_to_json(e)::text) AS fingerprint FROM "PluginCodingExerciseExecution" e WHERE "activityId" IN (${children[0].activityId},${children[1].activityId}) ORDER BY id`;
    const originalEvidence = await evidence();
    const reviewPath = (childId: string, attemptId = parentId) => `/api/courses/${data.courseId}/gradebook/attempts/${attemptId}/test-items/${childId}/review`;
    expect((await student.get(reviewPath(children[0].id))).status()).toBe(403);
    expect((await teacherApi.get(reviewPath("foreign-child"))).status()).toBe(404);
    const stale = (await responseJson<{ review: TestItemTeacherReview }>(await teacherApi.get(reviewPath(children[0].id)))).review;

    await page.goto(`/courses/${data.courseId}/gradebook/activities/${created.activity.id}`);
    await page.getByRole("button", { name: "Review and grade all", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Review and grade", exact: true });
    const selectProgram = (number: number) => dialog.getByRole("button", { name: `Activity ${number}: Program ${number}`, exact: true }).click();
    await dialog.getByRole("textbox", { name: "Summary", exact: true }).fill("First reviewed answer.");
    await selectProgram(2);
    const confirmation = page.getByRole("dialog", { name: "Please confirm" });
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(confirmation).toBeHidden();
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue("First reviewed answer.");
    await dialog.getByRole("textbox", { name: "Strengths", exact: true }).fill("Clear expression.");
    await dialog.getByRole("textbox", { name: "Improvements", exact: true }).fill("Consider edge cases.");
    await dialog.getByLabel("Score (%)", { exact: true }).fill("60");
    await dialog.getByRole("textbox", { name: "Criterion feedback", exact: true }).fill("Partial rubric credit.");
    await expect(dialog.getByLabel("Final grade (out of 10)", { exact: true })).toHaveValue("6");
    await dialog.getByRole("button", { name: "Save review", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Save review", exact: true })).toBeDisabled();
    expect(await prisma.grade.count({ where: { selectedAttemptId: parentId } })).toBe(0);
    expect((await teacherApi.patch(reviewPath(children[0].id), { data: { expectedUpdatedAt: stale.updatedAt, expectedFeedbackHash: stale.feedbackHash, score: 0 } })).status()).toBe(409);

    await selectProgram(2);
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue("");
    await expect(dialog.locator("pre").filter({ hasText: "print(2)" })).toBeVisible();
    await dialog.getByRole("textbox", { name: "Summary", exact: true }).fill("Recovered answer reviewed.");
    await dialog.getByLabel("Score (%)", { exact: true }).fill("80");
    await dialog.getByRole("textbox", { name: "Criterion feedback", exact: true }).fill("Clear reasoning.");
    await expect(dialog.getByLabel("Final grade (out of 20)", { exact: true })).toHaveValue("16");
    await dialog.getByLabel("Final grade (out of 20)", { exact: true }).fill("18");
    await dialog.getByRole("button", { name: "Save review", exact: true }).click();
    await expect.poll(async () => (await prisma.grade.findFirst({ where: { selectedAttemptId: parentId } }))?.normalizedScore).toBe(16);
    await dialog.getByLabel("Score (%)", { exact: true }).fill("20");
    await expect(dialog.getByLabel("Final grade (out of 20)", { exact: true })).toHaveValue("18");
    await dialog.getByRole("button", { name: "Save review", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Save review", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Review and grade all", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue("First reviewed answer.");
    await expect(dialog.getByRole("textbox", { name: "Strengths", exact: true })).toHaveValue("Clear expression.");
    await expect(dialog.getByRole("textbox", { name: "Criterion feedback", exact: true })).toHaveValue("Partial rubric credit.");
    await page.getByRole("button", { name: "Next student", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue("");
    await dialog.getByRole("textbox", { name: "Summary", exact: true }).fill("Unsaved peer draft.");
    await page.getByRole("button", { name: "Previous student", exact: true }).click();
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue("Unsaved peer draft.");
    await page.getByRole("button", { name: "Previous student", exact: true }).click();
    await confirmation.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue("First reviewed answer.");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    expect(await evidence()).toEqual(originalEvidence);
    const after = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: parentId }, include: { testItemAttempts: true, gradebookItem: true } });
    expect(after.startedAt).toEqual(before.startedAt); expect(after.submittedAt).toEqual(before.submittedAt);
    expect(after.gradebookItem.gradesReleased).toBe(false);
    expect((after.testItemAttempts.find(item => item.id === first.id)!.result as { state: unknown }).state).toEqual((first.result as { state: unknown }).state);
    expect(await prisma.courseAuditEvent.count({ where: { courseId: data.courseId, eventType: "test_item_reviewed", targetId: { in: [first.id, recovered.id] } } })).toBe(3);
    const modelEvaluations = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginCodingExerciseAiEvaluation" WHERE "coreAttemptId"=${parentId}`;
    expect(Number(modelEvaluations[0].count)).toBe(0);
    await page.getByRole("button", { name: "Review and grade all", exact: true }).click();
    await dialog.getByLabel("Test total", { exact: true }).fill("19");
    await dialog.getByRole("textbox", { name: "Feedback", exact: true }).fill("Overall teacher judgment.");
    await dialog.getByRole("button", { name: "Save Test total", exact: true }).click();
    const parentGrade = () => prisma.grade.findUniqueOrThrow({ where: {
      gradebookItemId_participantId: { gradebookItemId: before.gradebookItemId, participantId: before.participantId }
    } });
    await expect.poll(async () => (await parentGrade()).normalizedScore).toBe(19);
    await dialog.getByLabel("Score (%)", { exact: true }).fill("40");
    await dialog.getByRole("button", { name: "Save review", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Save review", exact: true })).toBeDisabled();
    const overridden = await parentGrade();
    expect(overridden).toMatchObject({ normalizedScore: 19, source: "override" });
    const finalSummary = "First reviewed answer. Updated comments.";
    await dialog.getByRole("textbox", { name: "Summary", exact: true }).fill(finalSummary);
    await dialog.getByRole("button", { name: "Save review", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Save review", exact: true })).toBeDisabled();
    const narrativeOnly = await parentGrade();
    expect(narrativeOnly.gradedAt).toEqual(overridden.gradedAt);
    expect(narrativeOnly).toMatchObject({ normalizedScore: 19, source: "override" });
    expect(JSON.stringify(narrativeOnly.normalizedResult)).toContain(finalSummary);
    expect(JSON.stringify(narrativeOnly.normalizedResult)).toContain("Overall teacher judgment.");
    expect(await evidence()).toEqual(originalEvidence);
    await page.getByRole("button", { name: "Dismiss notification" }).evaluateAll(buttons => buttons.forEach(button => (button as HTMLButtonElement).click()));
    await dialog.evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: "tmp/test-review-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await selectProgram(2);
    await expect(dialog.getByLabel("Final grade (out of 20)", { exact: true })).toHaveValue("18");
    await page.screenshot({ path: "tmp/test-review-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    const gradesPath = `/api/courses/${data.courseId}/groups/${data.groupId}/grades`;
    expect(await (await student.get(gradesPath)).text()).not.toContain("First reviewed answer.");
    const releasePath = `/api/courses/${data.courseId}/gradebook/items/${before.gradebookItemId}/release`;
    await responseJson(await teacherApi.patch(releasePath, { data: { released: true } }));
    expect(await (await student.get(gradesPath)).text()).toContain("First reviewed answer.");
    await responseJson(await teacherApi.patch(releasePath, { data: { released: false } }));

    await submit("second");
    const historical = (await responseJson<{ review: TestItemTeacherReview }>(await teacherApi.get(reviewPath(children[0].id)))).review;
    expect(historical.readOnly).toBe(true);
    expect((await teacherApi.patch(reviewPath(children[0].id), { data: { expectedUpdatedAt: historical.updatedAt, expectedFeedbackHash: historical.feedbackHash, score: 0 } })).status()).toBe(409);
    await page.reload();
    await page.getByRole("button", { name: "Review and grade all", exact: true }).click();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue(finalSummary);
    await expect(dialog.getByRole("textbox", { name: "Summary", exact: true })).toHaveAttribute("readonly", "");
    await expect(dialog.getByRole("button", { name: "Save review", exact: true })).toHaveCount(0);
  } finally {
    await student.dispose(); await admin.dispose(); await peer?.dispose();
    if (peerId) await prisma.user.deleteMany({ where: { id: peerId } });
  }
});
