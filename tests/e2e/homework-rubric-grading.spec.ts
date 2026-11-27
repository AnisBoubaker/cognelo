import { prisma } from "@cognelo/db";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import type { StudentGroupingDto } from "@cognelo/contracts";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";

const criterion = { id: "quality", title: "Project quality", description: "Assess the complete submitted project.", weightPercent: 100 };
const policy = (questions = true) => ({ enabled: true, codeWeightPercent: questions ? 70 : 100, questionsWeightPercent: questions ? 30 : 0, testWeightPercent: 0,
  code: { criteria: [criterion], instructions: "Credit demonstrated reasoning and structure." }, questions: { criteria: questions ? [{ ...criterion, id: "understanding", title: "Understanding" }] : [], instructions: "Assess understanding of the actual submitted code." } });

test("homework authoring keeps grading drafts and guidance separate; manual rubric grades release safely", async ({ bankCourse: data, teacherApi: api, teacherPage: page, studentPage }) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student");
  try {
    const course = `/api/courses/${data.courseId}`;
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Rubric homework", config: {} });
    const base = `${course}/activities/${id}/coding-homework-grader`;
    const current = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${base}/authoring`));
    await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...current.assignment, promptMarkdown: "Write a function that adds two integers.", settings: { questionGenerationEnabled: false, grading: policy(false) } }, requirements: {} } }));
    await page.goto(`/courses/${data.courseId}/activities/${id}`);
    await page.getByRole("tab", { name: "Grading", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Use rubric grading", exact: true })).toBeChecked();
    await expect(page.getByLabel("Code rubric points", { exact: true })).toHaveValue("100");
    await expect(page.getByLabel("Question-answer points", { exact: true })).toBeDisabled();
    await page.getByRole("tab", { name: "Tests", exact: true }).click();
    await expect(page.getByText(/Test generation and execution will be added/)).toBeVisible();
    await page.getByRole("tab", { name: "Rubric", exact: true }).click();
    await page.route(`**${base}/generate-rubric`, route => route.fulfill({ json: { criteria: [{ ...criterion, id: "generated", title: "Generated project rubric" }] } }));
    await page.getByRole("button", { name: "Generate rubric", exact: true }).first().click();
    const generation = page.getByRole("dialog", { name: "Generate rubric", exact: true });
    await generation.getByLabel("Rubric-generation directions", { exact: true }).fill("Focus on reasoning.");
    await generation.getByRole("button", { name: "Generate rubric", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Title", exact: true }).first()).toHaveValue("Generated project rubric");
    const retained = await responseJson<{ assignment: { settings: { grading: ReturnType<typeof policy>; gradingRubricGuidance: { code: string } } } }>(await api.get(`${base}/authoring`));
    expect(retained.assignment.settings.grading.code.criteria[0].title).toBe("Project quality");
    expect(retained.assignment.settings.gradingRubricGuidance.code).toBe("Focus on reasoning.");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Title", exact: true }).first()).toHaveValue("Project quality");
    await page.reload(); await page.getByRole("tab", { name: "Grading", exact: true }).click();
    await expect(page.getByLabel("Grading directions", { exact: true }).first()).toHaveValue(policy(false).code.instructions);
    await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    await responseJson(await api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int a,int b){return a+b;}").toString("base64") } }));
    const handIn = await responseJson<{ submission: { coreAttemptId: string } }>(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } }));
    const attempt = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: handIn.submission.coreAttemptId } });
    expect((await api.patch(`${course}/gradebook/items/${attempt.gradebookItemId}/release`, { data: { released: true } })).status()).toBe(409);
    expect((await student.get(`${course}/gradebook/attempts/${attempt.id}/ai-feedback`)).status()).toBe(403);
    await page.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    await page.getByRole("button", { name: /^Actions for / }).click(); await page.getByRole("menuitem", { name: "Review and grade", exact: true }).click();
    const review = page.getByRole("dialog", { name: "Review and grade", exact: true });
    await expect(review.locator(".homework-submitted-file-content")).toContainText("int add");
    await review.getByLabel("Score (%)", { exact: true }).fill("85");
    const longFeedback = "Clear complete implementation.\n\n" + "main.c, add: « return a+b; » demonstrates the required addition.\n".repeat(700);
    await review.getByLabel("Feedback", { exact: true }).fill(longFeedback);
    await expect(review.getByText(/Calculated total: 85 \/ 100/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await review.getByRole("button", { name: "Save review", exact: true }).click();
    await expect.poll(async () => (await prisma.grade.findFirst({ where: { selectedAttemptId: attempt.id } }))?.normalizedScore).toBe(85);
    const saved = await responseJson<{ review: { feedback: { code: { criteria: Array<{ feedback: string }> } } } }>(await api.get(`${course}/gradebook/attempts/${attempt.id}/ai-feedback`));
    expect(saved.review.feedback.code.criteria[0].feedback).toBe(longFeedback);
    await responseJson(await api.patch(`${course}/gradebook/items/${attempt.gradebookItemId}/release`, { data: { released: true } }));
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`);
    await expect(studentPage.getByText(longFeedback, { exact: true })).toBeVisible();
    const grades = await responseJson<unknown>(await student.get(`${course}/groups/${data.groupId}/grades`));
    expect(JSON.stringify(grades)).not.toContain("Credit demonstrated reasoning");
    expect(JSON.stringify(grades)).not.toContain("privateSharedCodeRevision");
  } finally { await student.dispose(); }
});

test("team AI grading shares code, grades answers individually and preserves individual overrides", async ({ bankCourse: data, teacherApi: api }) => {
  test.setTimeout(120_000);
  const longFeedback = "Evidence-based criterion feedback\n\n" + "main.c:1, add: « return a+1; » supports the assessment of this criterion.\n".repeat(200);
  const model = await homeworkModelFixture(data, { rubricFeedback: longFeedback }), student = await createAuthenticatedApi("student");
  let peer: Awaited<ReturnType<typeof createAuthenticatedApiWithCredentials>> | undefined, peerId: string | undefined;
  try {
    const course = `/api/courses/${data.courseId}`;
    const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } });
    const email = `rubric-peer-${data.token}@example.test`;
    const created = await prisma.user.create({ data: { email, passwordHash: seed.passwordHash, isActive: true, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } }); peerId = created.id;
    const { participant } = await responseJson<{ participant: { id: string } }>(await api.post(`${course}/groups/${data.groupId}/participants`, { data: { email, role: "student" } }));
    peer = await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("student").password });
    const own = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, userId: seed.id } });
    const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(`${course}/groups/${data.groupId}/groupings`, { data: { title: "Rubric team", teams: [{ title: "Team", participantIds: [own.id, participant.id] }] } }));
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Shared code individual answers", config: {} });
    const base = `${course}/activities/${id}/coding-homework-grader`;
    const current = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${base}/authoring`));
    await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...current.assignment, questionCount: 2, promptMarkdown: "Implement add one.", settings: { grading: policy() } }, requirements: {} } }));
    await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    const settingsPath = `${course}/activities/${id}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsPath));
    await responseJson(await api.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", teamworkEnabled: true, groupAssignments: settings.groups.map(group => ({ ...group, teamGroupingId: grouping.id, allowIndividualSubmission: false })) } }));
    await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await model.api.post(`${base}/prepare-references`, { data: {} }));
    await responseJson(await model.api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    await prisma.course.update({ where: { id: data.courseId }, data: { metadata: { aiSettings: { automaticFeedbackEnabled: true, assessmentFeedbackAiAgentConnectionId: model.connection.id } } } });
    const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    const state = await responseJson<{ teamwork: { contextKey: string } }>(await student.get(`${endpoint}/workspace`));
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, contextKey: state.teamwork.contextKey, base64: Buffer.from("int add(int a){return a+1;}").toString("base64") } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1, contextKey: state.teamwork.contextKey } }));
    for (const [index, client] of [student, peer].entries()) {
      await expect.poll(async () => (await responseJson<{ submission: { status: string } }>(await client!.get(`${endpoint}/workspace`))).submission.status, { timeout: 30_000 }).toBe("challenge_ready");
      const workspace = await responseJson<{ submission: { id: string } }>(await client!.get(`${endpoint}/workspace`));
      const answering = await responseJson<{ submissionId: string; questions: Array<{ id: string }> }>(await client!.post(`${endpoint}/answering`, { data: { submissionId: workspace.submission.id } }));
      await responseJson(await client!.post(`${endpoint}/challenge-answers`, { data: { submissionId: answering.submissionId, answers: answering.questions.map(question => ({ questionId: question.id, answer: index ? "weak explanation" : "Adds one to the supplied integer." })) } }));
    }
    const attempts = await prisma.activityAttempt.findMany({ where: { activityId: id }, orderBy: { userId: "asc" } });
    const partialAttempt = attempts.find(attempt => attempt.userId === seed.id)!;
    const partialPath = `${course}/gradebook/attempts/${partialAttempt.id}/ai-feedback`;
    const partial = (await responseJson<{ review: { feedback: { code: { criteria: Array<{ scorePercent: number }> }; feedbackHash?: string } } }>(await api.get(partialPath))).review;
    partial.feedback.code.criteria[0].scorePercent = 50;
    await responseJson(await api.patch(partialPath, { data: { feedback: partial.feedback, expectedFeedbackHash: null } }));
    expect((await api.patch(`${course}/gradebook/items/${partialAttempt.gradebookItemId}/release`, { data: { released: true } })).status()).toBe(409);
    const sourceBefore = await prisma.$queryRaw<Array<{ shared: unknown }>>`SELECT metadata->'sharedCodeRubric' AS shared FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${id} AND kind='team_source'`;
    const runs = `${course}/gradebook/activities/${id}/ai-grading-runs`;
    const createRun = async () => (await responseJson<{ run: { id: string } }>(await model.api.post(runs, { data: { attemptIds: attempts.map(attempt => attempt.id) } }))).run.id;
    const discarded = await createRun(), discardedPath = `${course}/gradebook/ai-grading-runs/${discarded}`;
    await responseJson(await model.api.post(`${discardedPath}/attempts/${attempts[0].id}`));
    expect(await prisma.grade.count({ where: { selectedAttemptId: { in: attempts.map(attempt => attempt.id) } } })).toBe(1);
    const history = await responseJson<unknown>(await api.get(`${endpoint}/gradebook-attempts?participantId=${attempts[0].participantId}`));
    expect(JSON.stringify(history)).not.toContain("Evidence-based criterion feedback");
    await responseJson(await model.api.patch(discardedPath, { data: { action: "cancel" } }));
    await responseJson(await model.api.patch(discardedPath, { data: { action: "discard" } }));
    const source = await prisma.$queryRaw<Array<{ shared: unknown }>>`SELECT metadata->'sharedCodeRubric' AS shared FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${id} AND kind='team_source'`;
    expect(source).toEqual(sourceBefore);
    const kept = await createRun(), keptPath = `${course}/gradebook/ai-grading-runs/${kept}`;
    for (const attempt of attempts) await responseJson(await model.api.post(`${keptPath}/attempts/${attempt.id}`));
    expect(await prisma.grade.count({ where: { selectedAttemptId: { in: attempts.map(attempt => attempt.id) } } })).toBe(1);
    await responseJson(await model.api.patch(keptPath, { data: { action: "finish" } }));
    const ownAttempt = attempts.find(attempt => attempt.userId === seed.id)!, peerAttempt = attempts.find(attempt => attempt.userId === peerId)!;
    const grade = (attemptId: string) => prisma.grade.findFirstOrThrow({ where: { participantId: attempts.find(attempt => attempt.id === attemptId)!.participantId, gradebookItemId: attempts.find(attempt => attempt.id === attemptId)!.gradebookItemId } });
    expect((await grade(ownAttempt.id)).normalizedScore).toBe(80);
    expect((await grade(peerAttempt.id)).normalizedScore).toBe(68);
    const storedReviews = await prisma.$queryRaw<Array<{ rubric: { code: { criteria: Array<{ feedback: string }> }; questions: Array<{ criteria: Array<{ feedback: string }> }> } }>>`SELECT rubric FROM "PluginCodingHomeworkReview" WHERE "submissionId"=${ownAttempt.pluginAttemptRef} AND metadata->>'status'='completed'`;
    expect(storedReviews.length).toBeGreaterThan(0);
    expect(storedReviews[0].rubric.code.criteria[0].feedback).toBe(longFeedback);
    expect(storedReviews[0].rubric.questions.every(question => question.criteria[0].feedback === longFeedback)).toBe(true);
    const assessmentPrompts = model.requests.filter(request => request.systemPrompt?.includes("You assess programming homework"));
    expect(assessmentPrompts.length).toBeGreaterThan(0);
    expect(assessmentPrompts.every(request => request.systemPrompt?.includes("give all examples in the submitted evidence"))).toBe(true);
    for (const request of assessmentPrompts) {
      expect(request.systemPrompt).toContain("exact submitted filename including folders and its 1-based line number or inclusive line range");
      expect(JSON.parse(request.userPrompt!).evidence.files).toEqual([{ path: "main.c", numberedText: "1: int add(int a){return a+1;}" }]);
    }
    const peerGrade = await grade(peerAttempt.id);
    await responseJson(await api.patch(`${course}/gradebook/items/${peerGrade.gradebookItemId}/participants/${peerGrade.participantId}/override`, { data: { score: 95, maxScore: 100, reason: "Individual teacher adjustment", expectedGradeUpdatedAt: peerGrade.updatedAt.toISOString() } }));
    const reviewPath = `${course}/gradebook/attempts/${ownAttempt.id}/ai-feedback`;
    const review = (await responseJson<{ review: { feedback: { code: { criteria: Array<{ scorePercent: number }> }; feedbackHash: string } } }>(await api.get(reviewPath))).review;
    review.feedback.code.criteria[0].scorePercent = 60;
    await responseJson(await api.patch(reviewPath, { data: { feedback: review.feedback, expectedFeedbackHash: review.feedback.feedbackHash } }));
    expect((await grade(ownAttempt.id)).normalizedScore).toBe(66);
    expect((await grade(peerAttempt.id)).normalizedScore).toBe(95);
    const peerFeedback = (await responseJson<{ review: { feedback: { codeScore: number; questionsScore: number } } }>(await api.get(`${course}/gradebook/attempts/${peerAttempt.id}/ai-feedback`))).review.feedback;
    expect(peerFeedback).toMatchObject({ codeScore: 60, questionsScore: 40 });
    expect((await api.patch(reviewPath, { data: { feedback: review.feedback, expectedFeedbackHash: review.feedback.feedbackHash } })).status()).toBe(409);
  } finally { await student.dispose(); await peer?.dispose(); if (peerId) await prisma.user.deleteMany({ where: { id: peerId } }); await model.close(); }
});

test("real rubric generation uses private solution and separate guidance without saving criteria", async ({ bankCourse: data }) => {
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student");
  try {
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Generated homework rubric", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${id}/coding-homework-grader`;
    await responseJson(await model.api.put(`${base}/teacher-solution`, { data: { fileName: "main.c", base64: Buffer.from("int add(int a){return a+1;}").toString("base64") } }));
    for (const kind of ["code", "questions"] as const) {
      await responseJson(await model.api.put(`${base}/rubric-guidance`, { data: { kind, guidance: `Focus on ${kind} reasoning.` } }));
      const generated = await responseJson<{ criteria: typeof criterion[] }>(await model.api.post(`${base}/generate-rubric`, { data: { kind, title: "Generated rubric", prompt: "Add one to an integer.", guidance: `Focus on ${kind} reasoning.` } }));
      expect(generated.criteria[0].weightPercent).toBe(100);
    }
    const stored = await responseJson<{ assignment: { settings: Record<string, unknown> } }>(await model.api.get(`${base}/authoring`));
    expect(stored.assignment.settings.grading).toBeUndefined();
    expect(stored.assignment.settings.gradingRubricGuidance).toEqual({ code: "Focus on code reasoning.", questions: "Focus on questions reasoning." });
    const prompts = model.requests.filter(request => request.systemPrompt?.includes("Create a teacher-editable grading rubric"));
    expect(prompts).toHaveLength(2);
    expect(prompts[0].systemPrompt).toContain("entire homework project");
    expect(prompts[1].systemPrompt).toContain("one generic rubric reused");
    expect(prompts[0].userPrompt).toContain("int add");
    expect((await student.post(`${base}/generate-rubric`, { data: { kind: "code", title: "Foreign", prompt: "Foreign", guidance: "" } })).status()).toBe(403);
  } finally { await student.dispose(); await model.close(); }
});

test("cancelled rubric generation retains confirmed guidance and ignores late responses", async ({ bankCourse: data, teacherApi: api, teacherPage: page }) => {
  const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Cancellable homework rubric", config: {} });
  const base = `/api/courses/${data.courseId}/activities/${id}/coding-homework-grader`;
  const current = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${base}/authoring`));
  await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...current.assignment, settings: { questionGenerationEnabled: false, grading: policy(false) } }, requirements: {} } }));
  let release = () => {}, started = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**${base}/generate-rubric`, async route => {
    started = true; await gate;
    await route.fulfill({ json: { criteria: [{ ...criterion, title: "Late cancelled criterion" }] } }).catch(() => {});
  });
  try {
    await page.goto(`/courses/${data.courseId}/activities/${id}`);
    await page.getByRole("tab", { name: "Grading", exact: true }).click();
    await page.getByRole("button", { name: "Generate rubric", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Generate rubric", exact: true });
    await dialog.getByLabel("Rubric-generation directions", { exact: true }).fill("Retain these confirmed directions.");
    await dialog.getByRole("button", { name: "Generate rubric", exact: true }).click();
    await expect.poll(() => started).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    release();
    await expect(page.getByRole("textbox", { name: "Title", exact: true }).first()).toHaveValue("Project quality");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await page.reload(); await page.getByRole("tab", { name: "Grading", exact: true }).click();
    await page.getByRole("button", { name: "Generate rubric", exact: true }).first().click();
    await expect(dialog.getByLabel("Rubric-generation directions", { exact: true })).toHaveValue("Retain these confirmed directions.");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally { release(); }
});
