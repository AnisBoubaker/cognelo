import type { APIRequestContext } from "@playwright/test";
import { prisma } from "@cognelo/db";
import { expect, test, createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";

const maximumTemplate = "def maximum(a, b):\n    if {{ BLANK:condition }}:\n        return a\n    return {{ BLANK:fallback }}";
const maximumReferences = { condition: "a >= b", fallback: "b" };
const conflict = { condition: "a > b", fallback: "b if b > a else 0" };
const maximumTests = [[5, 5], [4, 1], [1, 4]].map(([a, b], index) => ({ id: `max-${index}`, name: `Case ${index + 1}`,
  stdin: "", expectedOutput: String(Math.max(a, b)), testCode: `print(maximum(${a}, ${b}))`, isEnabled: true, weight: 1 }));

async function setup(data: ActivitySuiteData, teacher: APIRequestContext, input: {
  title: string; template: string; answers: Record<string, string>; tests: typeof maximumTests; language?: string;
}) {
  const config = { language: input.language ?? "python", prompt: "Complete the code.", responseMode: "blanks",
    blankTemplate: input.template, sampleTests: [] };
  const activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: input.title, config });
  const referenceSolution = input.template.replace(/\{\{ BLANK:([\w-]+) \}\}/g, (_, id: string) => input.answers[id]);
  const privateConfig = { templateSource: "{{ STUDENT_CODE }}\n\n{{ TEST_CODE }}", blankReferenceAnswers: input.answers };
  const privatePath = `/api/courses/${data.courseId}/activities/${activityId}/coding-exercises/hidden-tests`;
  await responseJson(await teacher.put(privatePath, { data: { referenceSolution, privateConfig, tests: input.tests } }));
  await assignCourseTest(data, activityId, input.title, 5);
  return { activityId, config, referenceSolution, privateConfig, privatePath,
    assigned: `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}` };
}
async function submit(student: APIRequestContext, assigned: string, template: string, blankAnswers: Record<string, string>) {
  return responseJson<{ execution: { id: string; sourceCode: string } }>(await student.post(`${assigned}/coding-exercises/submit`, {
    data: { sourceCode: "forged source must be ignored", blankTemplate: template, blankAnswers }
  }));
}
async function summary(executionId: string) {
  const [execution] = await prisma.$queryRaw<Array<{ sourceCode: string; stdout: string | null; stderr: string | null; compileOutput: string | null; resultSummary: Record<string, unknown> }>>`
    SELECT "sourceCode",stdout,stderr,"compileOutput","resultSummary" FROM "PluginCodingExerciseExecution" WHERE id=${executionId}`;
  return execution;
}

test("grades missing and syntax-invalid Python blanks independently without changing submitted code", async () => {
  test.setTimeout(180_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const template = "def compute():\n    a = {{ BLANK:a }}\n    b = {{ BLANK:b }}\n    c = {{ BLANK:c }}\n    d = {{ BLANK:d }}\n    e = {{ BLANK:e }}\n    return a + b + c + d + e";
    const answers = { a: "1", b: "2", c: "3", d: "4", e: "5" };
    const activity = await setup(data, teacher, { title: `Partial Python ${data.token}`, template, answers,
      tests: [{ ...maximumTests[0], expectedOutput: "15", testCode: "print(compute())" }] });
    const missing = await submit(student, activity.assigned, template, { ...answers, e: "" });
    const missingResult = await summary(missing.execution.id);
    expect(missingResult.resultSummary).toMatchObject({ earnedWeight: 4, totalWeight: 5, reviewRequired: false,
      blankGrading: { method: "combined", correct: 4, answered: 4, combinedPassed: true } });
    expect(missingResult.sourceCode).toContain("    e = \n");
    const invalid = await submit(student, activity.assigned, template, { ...answers, b: ")" });
    const invalidResult = await summary(invalid.execution.id);
    expect(invalidResult.resultSummary).toMatchObject({ earnedWeight: 4, totalWeight: 5,
      blankGrading: { method: "isolated", syntaxPassed: false, correct: 4 } });
    expect(invalidResult.sourceCode).toContain("    b = )\n");
    expect(invalidResult.stdout).toBeNull(); expect(invalidResult.stderr).toBeNull(); expect(invalidResult.compileOutput).toBeNull();
    const grades = await prisma.grade.findMany({ where: { gradebookItem: { activityId: activity.activityId } } });
    expect(grades[0].normalizedScore / grades[0].normalizedMaxScore).toBe(0.8);
    const blank = await submit(student, activity.assigned, template, {});
    expect((await summary(blank.execution.id)).resultSummary).toMatchObject({ earnedWeight: 0, totalWeight: 5 });
    expect(await prisma.activityGradingReview.count({ where: { attempt: { activityId: activity.activityId } } })).toBe(0);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("grades a C compilation failure with partial credit", async () => {
  test.setTimeout(120_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const template = "int value(void) { int a = {{ BLANK:a }}; int b = {{ BLANK:b }}; return a + b; }";
    const activity = await setup(data, teacher, { title: `Partial C ${data.token}`, language: "c", template, answers: { a: "2", b: "3" },
      tests: [{ ...maximumTests[0], expectedOutput: "5", testCode: '#include <stdio.h>\nint main(void) { printf("%d\\n", value()); return 0; }' }] });
    const result = await submit(student, activity.assigned, template, { a: "2", b: ")" });
    expect((await summary(result.execution.id)).resultSummary).toMatchObject({ earnedWeight: 1, totalWeight: 2, reviewRequired: false,
      blankGrading: { method: "isolated", syntaxPassed: false, correct: 1 } });
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("flags an interacting response for shared teacher review and resolves it through a final grade", async ({ teacherPage: page }, testInfo) => {
  test.setTimeout(180_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const activity = await setup(data, teacher, { title: `Review blanks ${data.token}`, template: maximumTemplate, answers: maximumReferences, tests: maximumTests });
    const result = await submit(student, activity.assigned, maximumTemplate, conflict);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: activity.activityId } });
    expect((await summary(result.execution.id)).resultSummary).toMatchObject({ reviewRequired: true, accepted: null,
      blankGrading: { method: "isolated", correct: 2, total: 2, combinedPassed: false } });
    expect(await prisma.grade.count({ where: { gradebookItemId: attempt.gradebookItemId } })).toBe(0);
    expect(await prisma.activityGradingReview.findFirst({ where: { attemptId: attempt.id } })).toMatchObject({ status: "required", pluginKey: "coding-exercises" });
    const release = `/api/courses/${data.courseId}/gradebook/items/${attempt.gradebookItemId}/release`;
    expect((await teacher.patch(release, { data: { released: true } })).status()).toBe(409);
    const review = await responseJson<{ review: { gradingReviewRevision: string; gradingReviews: unknown[] } }>(await teacher.get(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/ai-feedback`));
    expect(review.review.gradingReviews).toHaveLength(1);
    expect(JSON.stringify(review)).not.toContain("evidenceRef");
    const override = `/api/courses/${data.courseId}/gradebook/items/${attempt.gradebookItemId}/participants/${attempt.participantId}/override`;
    expect((await teacher.patch(override, { data: { score: 8, expectedGradeUpdatedAt: null } })).status()).toBe(409);
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${activity.activityId}`);
    const row = page.locator(".table-row-gradebook-detail:not(.table-head)").first();
    await expect(row.getByText("Needs teacher review", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Review and grade", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Needs teacher review", { exact: true })).toBeVisible();
    await expect(dialog.getByText("2 of 2 blanks correct", { exact: true })).toBeVisible();
    await dialog.screenshot({ path: testInfo.outputPath("required-review.png") });
    await dialog.getByRole("spinbutton", { name: /^Final grade/ }).fill("8");
    await dialog.getByRole("button", { name: "Save review", exact: true }).click();
    await expect.poll(async () => (await prisma.activityGradingReview.findFirstOrThrow({ where: { attemptId: attempt.id } })).status).toBe("resolved");
    await expect(dialog.getByText("Needs teacher review", { exact: true })).toHaveCount(0);
    await responseJson(await teacher.patch(release, { data: { released: true } }));
    expect((await prisma.grade.findFirstOrThrow({ where: { gradebookItemId: attempt.gradebookItemId } })).normalizedScore).toBe(8);
    expect(await prisma.courseAuditEvent.count({ where: { courseId: data.courseId, eventType: "grading_review_resolved" } })).toBe(1);
    expect((await summary(result.execution.id)).sourceCode).toContain("b if b > a else 0");
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("regrading can request review while retaining the old grade and blocking release", async () => {
  test.setTimeout(180_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const activity = await setup(data, teacher, { title: `Review rerun ${data.token}`, template: maximumTemplate, answers: maximumReferences, tests: maximumTests.slice(1) });
    await submit(student, activity.assigned, maximumTemplate, conflict);
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: activity.activityId } });
    const original = await prisma.grade.findFirstOrThrow({ where: { gradebookItemId: attempt.gradebookItemId } });
    await responseJson(await teacher.put(activity.privatePath, { data: { referenceSolution: activity.referenceSolution, privateConfig: activity.privateConfig, tests: maximumTests } }));
    const rerun = await responseJson<{ deferred: string }>(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/regrade`, { data: {} }));
    expect(rerun.deferred).toContain("every isolated blank passed");
    const { gradebook } = await responseJson<{ gradebook: { rows: Array<{ status: string; gradingReviews: unknown[] }> } }>(await teacher.get(`/api/courses/${data.courseId}/gradebook?activityId=${activity.activityId}`));
    expect(gradebook.rows[0]).toMatchObject({ status: "needs_grading" });
    expect(gradebook.rows[0].gradingReviews).toHaveLength(1);
    expect(await prisma.grade.findUnique({ where: { id: original.id } })).toMatchObject({ normalizedScore: original.normalizedScore, updatedAt: original.updatedAt });
    expect(await prisma.activityGradingReview.count({ where: { attemptId: attempt.id, status: "required" } })).toBe(1);
    expect((await teacher.patch(`/api/courses/${data.courseId}/gradebook/items/${attempt.gradebookItemId}/release`, { data: { released: true } })).status()).toBe(409);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("keeps borrowed teacher answers and their output private in formative feedback", async () => {
  test.setTimeout(120_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const secret = `PRIVATE_TEACHER_${data.token}`;
    const template = "def message():\n    return {{ BLANK:text }} * {{ BLANK:count }}";
    const activity = await setup(data, teacher, { title: `Private blanks ${data.token}`, template, answers: { text: JSON.stringify(secret), count: "1" },
      tests: [{ ...maximumTests[0], expectedOutput: secret, testCode: "print(message())" }] });
    const assignment = await prisma.courseGroupActivity.findFirstOrThrow({ where: { activityId: activity.activityId, groupId: data.groupId } });
    await responseJson(await teacher.patch(`/api/courses/${data.courseId}/groups/${data.groupId}/activities/${assignment.id}`, { data: { confirmSummativeToFormative: true, metadata: { assessmentMode: "formative" } } }));
    const submitted = await submit(student, activity.assigned, template, { text: "", count: "1" });
    expect(JSON.stringify(submitted)).not.toContain(secret);
    expect((await summary(submitted.execution.id)).resultSummary).toMatchObject({ earnedWeight: 1, totalWeight: 2 });
    const history = await responseJson(await student.get(`${activity.assigned}/coding-exercises/history`));
    expect(JSON.stringify(history)).not.toContain(secret);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});

test("Test questions request shared review and an explicit item grade resolves it", async () => {
  test.setTimeout(180_000);
  const data = await provisionActivitySuite(), teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacher.post(`/api/courses/${data.courseId}/tests`, {
      data: { title: `Review Test ${data.token}`, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true } }
    }));
    const activityId = created.activity.id;
    const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacher.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
      source: "local", activityTypeKey: "coding-exercise", title: "Maximum blanks", pointsPossible: 10,
      config: { language: "python", responseMode: "blanks", blankTemplate: maximumTemplate, sampleTests: [] }
    } }));
    const referenceSolution = maximumTemplate.replace(/\{\{ BLANK:([\w-]+) \}\}/g, (_, id: string) => maximumReferences[id as keyof typeof maximumReferences]);
    await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`, { data: {
      referenceSolution, tests: maximumTests, privateConfig: { templateSource: "{{ STUDENT_CODE }}\n{{ TEST_CODE }}", blankReferenceAnswers: maximumReferences }
    } }));
    await assignCourseTest(data, activityId, "Review Test", 2);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const { runtime } = await responseJson<{ runtime: { attempt: { id: string } } }>(await student.post(`${assigned}/test`, { data: { sessionId: data.token } }));
    const parentAttemptId = runtime.attempt.id;
    await responseJson(await student.put(`${assigned}/test/items/${item.id}`, { data: { parentAttemptId, sessionId: data.token,
      state: { sourceCode: "ignored", blankTemplate: maximumTemplate, blankAnswers: conflict } } }));
    await responseJson(await student.post(`${assigned}/test/submit`, { data: { parentAttemptId, sessionId: data.token } }));
    expect(await prisma.activityGradingReview.count({ where: { attemptId: parentAttemptId, status: "required", testItemAttemptId: { not: null } } })).toBe(1);
    const child = await prisma.testItemAttempt.findFirstOrThrow({ where: { parentAttemptId } });
    expect(child.rawScore).toBeNull();
    const parent = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: parentAttemptId } });
    expect(await prisma.grade.count({ where: { gradebookItemId: parent.gradebookItemId } })).toBe(0);
    const path = `/api/courses/${data.courseId}/gradebook/attempts/${parentAttemptId}/test-items/${item.id}/review`;
    const { review } = await responseJson<{ review: { updatedAt: string; feedbackHash: string | null; gradingReviews: unknown[] } }>(await teacher.get(path));
    expect(review.gradingReviews).toHaveLength(1);
    await responseJson(await teacher.patch(path, { data: { expectedUpdatedAt: review.updatedAt, expectedFeedbackHash: review.feedbackHash, score: 8 } }));
    expect(await prisma.activityGradingReview.count({ where: { attemptId: parentAttemptId, status: "required" } })).toBe(0);
    const grade = await prisma.grade.findFirstOrThrow({ where: { gradebookItemId: parent.gradebookItemId } });
    expect(grade.normalizedScore / grade.normalizedMaxScore).toBe(0.8);
    // Reopening withdraws prior grading decisions and resubmission can grade a corrected program normally.
    await responseJson(await teacher.post(`/api/courses/${data.courseId}/gradebook/attempts/${parentAttemptId}/reopen`, { data: {} }));
    await responseJson(await student.post(`${assigned}/test`, { data: { sessionId: data.token } }));
    await responseJson(await student.put(`${assigned}/test/items/${item.id}`, { data: { parentAttemptId, sessionId: data.token,
      state: { sourceCode: "ignored", blankTemplate: maximumTemplate, blankAnswers: maximumReferences } } }));
    await responseJson(await student.post(`${assigned}/test/submit`, { data: { parentAttemptId, sessionId: data.token } }));
    const corrected = await prisma.grade.findUniqueOrThrow({ where: { id: grade.id } });
    expect(corrected.normalizedScore).toBe(corrected.normalizedMaxScore);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});
