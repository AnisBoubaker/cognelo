import { openHomeworkEditorSection } from "./fixtures/homework-editor";
import { prisma } from "@cognelo/db";
import type { StudentGroupingDto } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor } from "./fixtures/auth";

test("file-only homework completes without AI, embeddings or SEB and keeps incomplete/cancellation/deadline rules", async ({ bankCourse: data, teacherApi: api, teacherPage, studentPage: page }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const course = `/api/courses/${data.courseId}`;
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "File-only homework", config: {} });
    const base = `${course}/activities/${id}/coding-homework-grader`;
    const current = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${base}/authoring`));
    const assignment = { ...current.assignment, questionCount: 5, generationInstructions: "Retain these instructions.", settings: { ...(current.assignment.settings as object), questionGenerationEnabled: false } };
    const requirements = { requiredFiles: [{ path: "main.c" }, { path: "missing.h" }] };
    await responseJson(await api.put(`${base}/authoring`, { data: { assignment, requirements } }));
    await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative", requireSafeExamBrowser: true, timeLimitMinutes: 1 }, gradebookSettings: { pointsPossible: 100, maxAttempts: 1, attemptLimitMode: "max_attempts" } } }));
    await responseJson(await api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int main(void) { return 0; }").toString("base64") } }));
    expect((await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1 } })).status()).toBe(409);
    const first = await responseJson<{ submission: { id: string; status: string; questionCount: number; coreAttemptId: string } }>(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1, acknowledgeIncomplete: true } }));
    expect(first.submission).toMatchObject({ status: "ready_for_grading", questionCount: 0, questionGenerationEnabled: false, started: false });
    expect(await prisma.activityAttempt.findUniqueOrThrow({ where: { id: first.submission.coreAttemptId } })).toMatchObject({ lifecycle: "submitted", durationSeconds: 0 });
    expect((await responseJson<typeof first>(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1, acknowledgeIncomplete: true } }))).submission.id).toBe(first.submission.id);
    expect(await prisma.backgroundJob.count({ where: { payload: { path: ["activityId"], equals: id } } })).toBe(0);
    const [questions] = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "PluginCodingHomeworkChallengeQuestion" q JOIN "PluginCodingHomeworkSubmission" s ON s.id=q."submissionId" WHERE s."activityId"=${id}`;
    expect(Number(questions.count)).toBe(0);
    expect((await api.put(`${base}/authoring`, { data: { assignment: { ...assignment, settings: { questionGenerationEnabled: true } }, requirements } })).status()).toBe(409);
    expect((await api.post(`${base}/manage-submissions`, { data: { action: "reset-challenges", submissionId: first.submission.id, reason: "No challenges exist" } })).status()).toBe(409);
    await page.goto(endpoint.replace(/^\/api/, "").replace(/\/coding-homework-grader$/, ""));
    await expect(page.getByRole("heading", { name: "Submitted work", exact: true })).toBeVisible();
    await expect(page.getByText("Your work has been submitted for teacher grading.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Answer challenge questions", exact: true })).toHaveCount(0);
    await teacherPage.goto(`/courses/${data.courseId}/gradebook/activities/${id}`);
    await teacherPage.getByRole("button", { name: /^Actions for / }).click();
    await teacherPage.getByRole("menuitem", { name: "Review and grade", exact: true }).click();
    const review = teacherPage.getByRole("dialog", { name: "Review and grade", exact: true });
    await expect(review.getByRole("tab", { name: "Submitted files", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(review.getByRole("tab", { name: "Questions and answers", exact: true })).toHaveCount(0);
    await expect(review.locator(".homework-submitted-file-content")).toContainText("int main");
    await review.locator(".review-chat-toolbar").getByRole("button", { name: "Close", exact: true }).click();
    await teacherPage.goto(`/courses/${data.courseId}/activities/${id}`); await openHomeworkEditorSection(teacherPage, "Question Generation");
    await expect(teacherPage.getByRole("switch", { name: "Generate challenge questions", exact: true })).toBeDisabled();
    await responseJson(await api.delete(`${base}/manage-submissions`, { data: { submissionId: first.submission.id, reason: "Permit another hand-in" } }));
    await teacherPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(teacherPage.getByRole("switch", { name: "Generate challenge questions", exact: true })).toBeEnabled();
    expect(await prisma.activityAttempt.findUniqueOrThrow({ where: { id: first.submission.coreAttemptId } })).toMatchObject({ lifecycle: "deleted" });
    const deadline = new Date(Date.now() - 1000).toISOString();
    // Only disposable fixture timestamps are moved, simulating a draft saved before its cutoff.
    await prisma.$executeRaw`UPDATE "PluginCodingHomeworkDraft" SET "updatedAt"=${new Date(Date.now()-20_000)} WHERE "activityId"=${id}`;
    await prisma.$executeRaw`UPDATE "PluginCodingHomeworkSubmission" SET "updatedAt"=${new Date(Date.now()-20_000)},metadata=metadata #- '{cancellation}' WHERE id=${first.submission.id}`;
    await responseJson(await api.put(`${base}/workflow-settings`, { data: { submissionPolicy: { deadline, allowLate: false, lateLimitMinutes: null } } }));
    const recovered = await responseJson<typeof first>(await student.get(`${endpoint}/workspace`));
    expect(recovered.submission).toMatchObject({ status: "ready_for_grading", questionCount: 0, automaticHandIn: true, incompleteAcknowledged: true });
    expect(recovered.submission.id).not.toBe(first.submission.id);
    const retained = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${base}/authoring`));
    expect(retained.assignment).toMatchObject({ questionCount: 5, generationInstructions: "Retain these instructions.", settings: { questionGenerationEnabled: false } });
  } finally { await student.dispose(); }
});

test("file-only team work immediately completes every member and late joiner with individual grades", async ({ bankCourse: data, teacherApi: api }) => {
  const student = await createAuthenticatedApi("student"), users: string[] = [];
  const peers = [];
  try {
    const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } });
    const participants = [(await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, userId: seed.id } })).id];
    const course = `/api/courses/${data.courseId}`;
    for (let i=0;i<2;i++) {
      const email = `file-only-${data.token}-${i}@example.test`;
      const user = await prisma.user.create({ data: { email, passwordHash: seed.passwordHash, isActive: true, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } }); users.push(user.id);
      const { participant } = await responseJson<{ participant: { id: string } }>(await api.post(`${course}/groups/${data.groupId}/participants`, { data: { email, role: "student" } }));
      participants.push(participant.id); peers.push(await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("student").password }));
    }
    const groupingPath = `${course}/groups/${data.groupId}/groupings`;
    let { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(groupingPath, { data: { title: "File-only teams", teams: [{ title: "Team", participantIds: participants.slice(0,2) }] } }));
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "File-only team work", config: {} });
    const base = `${course}/activities/${id}/coding-homework-grader`;
    const authored = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${base}/authoring`));
    await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...authored.assignment, settings: { questionGenerationEnabled: false } }, requirements: {} } }));
    await responseJson(await api.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" }, gradebookSettings: { maxAttempts: 1, attemptLimitMode: "max_attempts" } } }));
    const settingsPath = `${course}/activities/${id}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsPath));
    await responseJson(await api.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", teamworkEnabled: true, groupAssignments: settings.groups.map(group => ({ ...group, teamGroupingId: grouping.id, allowIndividualSubmission: false })) } }));
    await responseJson(await api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    const endpoint = `${course}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
    const state = async (client=student) => responseJson<{ teamwork: { contextKey: string }; submission: { id: string; status: string; coreAttemptId: string } | null }>(await client.get(`${endpoint}/workspace`));
    const progress = async () => (await responseJson<{ progress: Array<{ participantId: string; state: string }> }>(await api.get(`${course}/gradebook?view=in-progress-attempts&includeProgress=1&activityId=${id}`))).progress;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { kind: "file", path: "main.c", expectedRevision: 0, contextKey: (await state()).teamwork.contextKey, base64: Buffer.from("int main(void) {return 0;}").toString("base64") } }));
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { expectedRevision: 1, contextKey: (await state()).teamwork.contextKey } }));
    for (const client of [student,peers[0]]) expect((await state(client)).submission?.status).toBe("ready_for_grading");
    expect(await progress()).toEqual(expect.arrayContaining(participants.slice(0,2).map(participantId => expect.objectContaining({ participantId, state: "done" }))));
    ({ grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.patch(`${groupingPath}/${grouping.id}`, { data: { ...grouping, teams: grouping.teams.map(team => ({ ...team, participantIds: participants })) } })));
    expect((await state(peers[1])).submission?.status).toBe("ready_for_grading");
    expect((await progress()).every(person => person.state === "done")).toBe(true);
    expect(await prisma.activityAttempt.count({ where: { activityId: id, lifecycle: "submitted" } })).toBe(3);
    const original = (await state()).submission!;
    const graded = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: original.coreAttemptId } });
    await responseJson(await api.patch(`${course}/gradebook/items/${graded.gradebookItemId}/participants/${graded.participantId}/override`, { data: { score: 75, maxScore: 100, reason: "Reviewed shared code", expectedGradeUpdatedAt: null } }));
    ({ grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.patch(`${groupingPath}/${grouping.id}`, { data: { ...grouping, teams: grouping.teams.map(team => ({ ...team, participantIds: participants.slice(1) })) } })));
    expect((await state()).submission).toBeNull();
    expect(await progress()).toEqual(expect.arrayContaining([expect.objectContaining({ participantId: participants[0], state: "not_started" })]));
    expect(await prisma.grade.count({ where: { gradebookItemId: graded.gradebookItemId, participantId: graded.participantId } })).toBe(0);
    ({ grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.patch(`${groupingPath}/${grouping.id}`, { data: { ...grouping, teams: grouping.teams.map(team => ({ ...team, participantIds: participants })) } })));
    expect((await state()).submission).toMatchObject({ status: "ready_for_grading" });
    expect((await state()).submission!.id).not.toBe(original.id);
    expect(await prisma.activityAttempt.count({ where: { activityId: id, lifecycle: "submitted" } })).toBe(3);
    expect(await prisma.backgroundJob.count({ where: { payload: { path: ["activityId"], equals: id } } })).toBe(0);
    await responseJson(await api.delete(`${base}/manage-submissions`, { data: { submissionId: (await state()).submission!.id, reason: "Reopen shared work" } }));
    for (const client of [student,...peers]) expect((await state(client)).submission).toBeNull();
    expect((await progress()).every(person => person.state === "in_progress")).toBe(true);
    expect(await prisma.activityAttempt.count({ where: { activityId: id, lifecycle: "deleted" } })).toBe(4);
  } finally { await student.dispose(); for (const peer of peers) await peer.dispose(); await prisma.user.deleteMany({ where: { id: { in: users } } }); }
});
