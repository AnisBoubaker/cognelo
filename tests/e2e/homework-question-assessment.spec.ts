import { prisma } from "@cognelo/db";
import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";
import { openActivityReportActions } from "./fixtures/gradebook-ui";
import { defaultHomeworkGrading } from "../../packages/plugin-activities/plugin-coding-homework-grader/src/rubric";

const criterion = { id: "understanding", title: "Understanding", description: "Assess demonstrated understanding.", weightPercent: 100 };
function policy(questionPoints = 30) {
  return { ...defaultHomeworkGrading(), enabled: true, codeWeightPercent: 100 - questionPoints, questionsWeightPercent: questionPoints,
    code: { criteria: [criterion], instructions: "Assess project quality." }, questions: { criteria: [criterion], instructions: "Assess this specific answer." },
    questionWarning: { enabled: true, thresholdPercent: 65, mode: "mean" as "mean" | "any" } };
}
async function prepare(data: ActivitySuiteData, api: APIRequestContext, model: Awaited<ReturnType<typeof homeworkModelFixture>>, student: APIRequestContext, points = 30) {
  const course = `/api/courses/${data.courseId}`;
  const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Challenge-answer review", config: {} });
  const base = `${course}/activities/${id}/coding-homework-grader`;
  const current = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${base}/authoring`));
  await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...current.assignment, questionCount: 2, promptMarkdown: "Implement add one.", settings: { grading: policy(points) } }, requirements: {} } }));
  await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
  await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { selected: [] } }));
  await responseJson(await model.api.post(`${base}/prepare-references`, { data: {} }));
  await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
  await prisma.course.update({ where: { id: data.courseId }, data: { metadata: { aiSettings: { automaticFeedbackEnabled: true, assessmentFeedbackAiAgentConnectionId: model.connection.id } } } });
  const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
  await submitAnswers(student, endpoint, points);
  const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: id, lifecycle: "submitted" } });
  return { course, id, base, attempt, endpoint };
}
async function submitAnswers(student: APIRequestContext, endpoint: string, points = 30) {
  await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int a){return a+1;}").toString("base64") } }));
  await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
  await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await student.get(`${endpoint}/workspace`))).submission.status, { timeout: 30_000 }).toBe("challenge_ready");
  const workspace = await responseJson<{ submission: { id: string } }>(await student.get(`${endpoint}/workspace`));
  const answering = await responseJson<{ questions: Array<{ id: string }> }>(await student.post(`${endpoint}/answering`, { data: { submissionId: workspace.submission.id } }));
  await responseJson(await student.post(`${endpoint}/challenge-answers`, { data: { submissionId: workspace.submission.id, answers: answering.questions.map((question, index) => ({ questionId: question.id, answer: points === 0 || index === 0 ? "weak explanation" : "It adds one to the argument." })) } }));
}

test("a student's challenge-answer action assesses only that student and leaves another eligible student untouched", async ({ bankCourse: data, teacherApi: api, browser }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student");
  let peer: APIRequestContext | undefined, peerId: string | undefined;
  try {
    const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } });
    const email = `answer-peer-${data.token}@example.test`;
    const account = await prisma.user.create({ data: { email, passwordHash: seed.passwordHash, firstName: "Other", lastName: "Student", isActive: true, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } });
    peerId = account.id;
    await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email, role: "student" } }));
    peer = await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("student").password });
    const { course, id, attempt, endpoint } = await prepare(data, api, model, student, 0);
    const page = await model.page(browser);
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    const peerRow = page.locator(".table-row-gradebook-detail").filter({ hasText: email });
    await peerRow.getByRole("button", { name: /^Actions for / }).click();
    await expect(page.getByRole("menuitem", { name: "Assess challenge answers with AI", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await submitAnswers(peer, endpoint, 0);
    await page.reload();
    const studentRow = page.locator(".table-row-gradebook-detail").filter({ hasText: credentialsFor("student").email });
    const studentName = await studentRow.locator("strong").first().innerText();
    const openAction = async () => {
      await studentRow.getByRole("button", { name: /^Actions for / }).click();
      await page.getByRole("menuitem", { name: "Assess challenge answers with AI", exact: true }).click();
      return page.getByRole("dialog", { name: "Assess challenge answers with AI", exact: true });
    };
    const cancelled = await openAction();
    await expect(cancelled).toContainText(studentName);
    await expect(cancelled).toContainText("only this student's");
    await cancelled.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(model.requests.filter(request => request.systemPrompt?.includes("You assess programming homework"))).toHaveLength(0);
    const confirmation = await openAction();
    const creation = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith(`/activities/${id}/ai-grading-runs`));
    await confirmation.getByRole("button", { name: "Confirm", exact: true }).click();
    expect((await creation).postDataJSON()).toEqual({ actionId: "challenge-answers", attemptIds: [attempt.id] });
    await expect(studentRow.getByRole("button", { name: "Possible unauthorized assistance", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(peerRow.getByRole("button", { name: "Possible unauthorized assistance", exact: true })).toHaveCount(0);
    expect(model.requests.filter(request => request.systemPrompt?.includes("You assess programming homework"))).toHaveLength(2);
    const peerAttempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId: id, userId: peerId } });
    const peerReview = (await responseJson<{ review: { feedback: { questionsScore: number | null } } }>(await api.get(`${course}/gradebook/attempts/${peerAttempt.id}/ai-feedback`))).review;
    expect(peerReview.feedback.questionsScore).toBeNull();
    expect(await prisma.grade.count({ where: { gradebookItemId: attempt.gradebookItemId } })).toBe(0);
  } finally { await student.dispose(); await peer?.dispose(); if (peerId) await prisma.user.deleteMany({ where: { id: peerId } }); await model.close(); }
});

test("challenge-only class assessment preserves code, updates answer grades, and shows a core warning icon under either threshold rule", async ({ bankCourse: data, teacherApi: api, browser }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student");
  try {
    const { course, id, base, attempt } = await prepare(data, api, model, student);
    const page = await model.page(browser);
    await page.goto(`/courses/${data.courseId}/activities/${id}`);
    await page.getByRole("tab", { name: "Grading", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Warn about low challenge-answer scores", exact: true })).toBeChecked();
    await page.getByLabel("Warning threshold (%)", { exact: true }).fill("60");
    await page.getByRole("combobox", { name: "Trigger warning when", exact: true }).selectOption("any");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(async () => (await responseJson<{ assignment: { settings: { grading: ReturnType<typeof policy> } } }>(await api.get(`${base}/authoring`))).assignment.settings.grading.questionWarning).toEqual({ enabled: true, thresholdPercent: 60, mode: "any" });
    const reviewPath = `${course}/gradebook/attempts/${attempt.id}/ai-feedback`;
    const draft = (await responseJson<{ review: { feedback: { code: { criteria: Array<{ scorePercent: number | null; feedback: string }> } } } }>(await api.get(reviewPath))).review.feedback;
    draft.code.criteria[0].scorePercent = 90; draft.code.criteria[0].feedback = "Preserve this teacher code assessment.";
    await responseJson(await api.patch(reviewPath, { data: { feedback: draft, expectedFeedbackHash: null } }));
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    await openActivityReportActions(page);
    await page.getByRole("menuitem", { name: "Assess challenge answers with AI", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Assess challenge answers with AI", exact: true });
    await confirmation.getByRole("button", { name: "Confirm", exact: true }).click();
    const flag = page.getByRole("button", { name: "Possible unauthorized assistance", exact: true });
    await expect(flag).toBeVisible({ timeout: 30_000 });
    await flag.focus();
    await expect(page.getByRole("tooltip")).toContainText("question scores (1: 40%) are below 60%");
    await page.screenshot({ path: test.info().outputPath("evaluation-flag-desktop.png"), fullPage: true });
    await page.keyboard.press("Escape");
    const saved = (await responseJson<{ review: { feedback: { codeScore: number; questionsScore: number; combinedScore: number; code: { criteria: Array<{ feedback: string }> } } } }>(await api.get(reviewPath))).review.feedback;
    expect(saved).toMatchObject({ codeScore: 90, questionsScore: 60, combinedScore: 81 });
    expect(saved.code.criteria[0].feedback).toBe("Preserve this teacher code assessment.");
    const assessments = model.requests.filter(request => request.systemPrompt?.includes("You assess programming homework"));
    expect(assessments).toHaveLength(2);
    expect(assessments.every(request => JSON.parse(request.userPrompt!).evidence.answer !== undefined)).toBe(true);
    const current = (await responseJson<{ assignment: Record<string, unknown> & { settings: Record<string, unknown> } }>(await api.get(`${base}/authoring`))).assignment;
    const meanPolicy = { ...policy(), questionWarning: { enabled: true, thresholdPercent: 60, mode: "mean" } };
    await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...current, settings: { ...current.settings, grading: meanPolicy } }, requirements: {} } }));
    await page.reload(); await expect(flag).toHaveCount(0);
    await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...current, settings: { ...current.settings, grading: { ...meanPolicy, questionWarning: { ...meanPolicy.questionWarning, thresholdPercent: 65 } } } }, requirements: {} } }));
    await page.reload(); await expect(flag).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 }); await flag.click();
    await expect(page.getByRole("tooltip")).toContainText("average 60% is below 65%");
    await page.screenshot({ path: test.info().outputPath("evaluation-flag-mobile.png"), fullPage: true });
    const bounds = await page.getByRole("tooltip").boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
    await page.keyboard.press("Escape");
    await responseJson(await api.patch(`${course}/gradebook/items/${attempt.gradebookItemId}/release`, { data: { released: true } }));
    const learner = JSON.stringify(await responseJson(await student.get(`${course}/groups/${data.groupId}/grades`)));
    expect(learner).not.toContain("evaluationFlags"); expect(learner).not.toContain("possible_unauthorized_assistance");
    expect((await student.post(`${course}/gradebook/activities/${id}/ai-grading-runs`, { data: { actionId: "challenge-answers", attemptIds: [attempt.id] } })).status()).toBe(403);
  } finally { await student.dispose(); await model.close(); }
});

test("core warnings are visible before a grade exists and final overrides survive answer reassessment", async ({ bankCourse: data, teacherApi: api, browser }) => {
  test.setTimeout(120_000);
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student");
  try {
    const { course, id, attempt } = await prepare(data, api, model, student, 0);
    const runs = `${course}/gradebook/activities/${id}/ai-grading-runs`;
    expect((await model.api.post(runs, { data: { actionId: "unknown", attemptIds: [attempt.id] } })).status()).toBe(409);
    let firstAssessment = true;
    const assess = async () => {
      const { run } = await responseJson<{ run: { id: string } }>(await model.api.post(runs, { data: { actionId: "challenge-answers", attemptIds: [attempt.id] } }));
      const path = `${course}/gradebook/ai-grading-runs/${run.id}`;
      await responseJson(await model.api.post(`${path}/attempts/${attempt.id}`));
      if (firstAssessment) {
        const staged = await responseJson<{ gradebook: { rows: Array<{ evaluationFlags?: unknown[] }> } }>(await api.get(`${course}/gradebook?activityId=${id}`));
        expect(staged.gradebook.rows[0].evaluationFlags ?? []).toEqual([]);
      }
      await responseJson(await model.api.patch(path, { data: { action: "finish" } }));
      firstAssessment = false;
    };
    await assess();
    expect(await prisma.grade.count({ where: { selectedAttemptId: attempt.id } })).toBe(0);
    const page = await model.page(browser);
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    const flag = page.getByRole("button", { name: "Possible unauthorized assistance", exact: true });
    await expect(flag).toBeVisible();
    const cell = flag.locator("xpath=ancestor::*[contains(@class, 'gradebook-grade-cell')]");
    await expect(cell.locator("strong")).toHaveText("-");
    const flags = await responseJson<{ gradebook: { rows: Array<{ evaluationFlags: unknown[]; score: number | null }> } }>(await api.get(`${course}/gradebook?activityId=${id}`));
    expect(flags.gradebook.rows[0].score).toBeNull(); expect(flags.gradebook.rows[0].evaluationFlags).toHaveLength(1);
    const reviewPath = `${course}/gradebook/attempts/${attempt.id}/ai-feedback`;
    const review = (await responseJson<{ review: { feedback: { questions: Array<{ criteria: Array<{ scorePercent: number }> }>; feedbackHash: string } } }>(await api.get(reviewPath))).review;
    for (const question of review.feedback.questions) question.criteria[0].scorePercent = 90;
    await responseJson(await api.patch(reviewPath, { data: { feedback: review.feedback, expectedFeedbackHash: review.feedback.feedbackHash } }));
    await page.reload(); await expect(flag).toHaveCount(0);
    expect(await prisma.grade.count({ where: { selectedAttemptId: attempt.id } })).toBe(0);
    await assess();
    await responseJson(await api.patch(`${course}/gradebook/items/${attempt.gradebookItemId}/participants/${attempt.participantId}/override`, { data: { score: 95, maxScore: 100, reason: "Teacher final decision", expectedGradeUpdatedAt: null } }));
    await assess();
    const grade = await prisma.grade.findFirstOrThrow({ where: { participantId: attempt.participantId, gradebookItemId: attempt.gradebookItemId } });
    expect(grade.normalizedScore).toBe(95); expect(grade.source).toBe("override");
  } finally { await student.dispose(); await model.close(); }
});
