import { access } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@cognelo/db";
import { unzipSync, zipSync, strToU8 } from "fflate";
import type { APIRequestContext } from "@playwright/test";
import type { StudentGroupingDto } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";

type Workspace = { teamwork: { contextKey: string; draftRevision: number; teamName: string | null; canSubmit: boolean }; submission: null | { id: string; status: string; coreAttemptId: string | null } };
type Questions = { submissionId: string; questions: Array<{ id: string; questionText: string; studentAnswer: string | null }> };

for (const separate of [false, true]) test(`team homework: ${separate ? "individual" : "common"} questions, shared files and membership lifecycle`, async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  test.setTimeout(240_000);
  const model = await homeworkModelFixture(data), student = await createAuthenticatedApi("student");
  const clients: APIRequestContext[] = [student], users: string[] = []; let activityId: string | undefined;
  try {
    const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } });
    const participants = [(await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, userId: seed.id } })).id];
    for (let i = 0; i < 2; i++) {
      const email = `team-${data.token}-${i}@example.test`;
      const user = await prisma.user.create({ data: { email, firstName: "Teammate", lastName: String(i), passwordHash: seed.passwordHash, isActive: true, mustChangePassword: false, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } }); users.push(user.id);
      const { participant } = await responseJson<{ participant: { id: string } }>(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email, role: "student" } }));
      participants.push(participant.id); clients.push(await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("student").password }));
    }
    const groupingPath = `/api/courses/${data.courseId}/groups/${data.groupId}/groupings`;
    let { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacherApi.post(groupingPath, { data: { title: "Homework teams", visibleToStudents: true, teams: [{ title: "Blue", participantIds: participants.slice(0, 2) }, { title: "Green", participantIds: [] }] } }));
    const blue = grouping.teams.find(team => team.title === "Blue")!.id;
    const move = async (blueMembers: string[], greenMembers: string[]) => {
      ({ grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacherApi.patch(`${groupingPath}/${grouping.id}`, { data: { ...grouping, teams: grouping.teams.map(team => ({ ...team, participantIds: team.id === blue ? blueMembers : greenMembers })) } })));
    };
    activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Team homework", config: {} });
    const teacherPath = `/api/courses/${data.courseId}/activities/${activityId}/coding-homework-grader`;
    const current = await responseJson<{ assignment: Record<string, unknown> }>(await teacherApi.get(`${teacherPath}/authoring`));
    await responseJson(await teacherApi.put(`${teacherPath}/authoring`, { data: { assignment: { ...current.assignment, questionCount: 3, settings: { ...(current.assignment.settings as object), separateTeamQuestions: separate } }, requirements: { requiredFiles: [{ path: "src/main.c" }] } } }));
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId, metadata: { assessmentMode: "summative", timeLimitMinutes: 10 }, gradebookSettings: { maxAttempts: 1, attemptLimitMode: "max_attempts", pointsPossible: 100 } } }));
    const settingsPath = `/api/courses/${data.courseId}/activities/${activityId}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath));
    const assignmentData = { ...settings.general, assessmentMode: "summative", teamworkEnabled: true, groupAssignments: settings.groups.map(group => ({ ...group, teamGroupingId: grouping.id, allowIndividualSubmission: false })) };
    await responseJson(await teacherApi.post(settingsPath, { data: assignmentData }));
    await responseJson(await teacherApi.put(`${teacherPath}/workflow-settings`, { data: { selected: [] } }));
    await responseJson(await teacherApi.post(`${teacherPath}/prepare-references`, { data: {} }));
    await responseJson(await teacherApi.put(`${teacherPath}/workflow-settings`, { data: { enabled: true } }));
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const endpoint = `${assigned}/coding-homework-grader`;
    const state = async (client = student) => responseJson<Workspace>(await client.get(`${endpoint}/workspace`));
    const preparation = async (client = student) => responseJson<{ draft: { revision: number; files: Array<{ path: string }> } }>(await client.get(`${endpoint}/preparation`));
    const waitReady = async (client: APIRequestContext) => expect.poll(async () => (await state(client)).submission?.status, { timeout: 45_000 }).toBe("challenge_ready");
    const unteamed = await state(clients[2]); expect(unteamed.teamwork.canSubmit).toBe(false);
    expect((await clients[2].post(`${endpoint}/hand-in`, { data: { expectedRevision: 0, contextKey: unteamed.teamwork.contextKey } })).status()).toBe(403);
    // One real shared draft; ZIP preserves folders, stale revisions cannot overwrite a teammate.
    const code = "int add(int x, int y) { return x + y; }";
    const originalContext = (await state()).teamwork.contextKey;
    await responseJson(await student.post(`${endpoint}/preparation`, { data: { contextKey: (await state()).teamwork.contextKey, kind: "zip", fileName: "work.zip", expectedRevision: 0, base64: Buffer.from(zipSync({ "src/main.c": strToU8(code), "notes.h": strToU8("// temporary") })).toString("base64") } }));
    expect((await preparation(clients[1])).draft.files.map(file => file.path).sort()).toEqual(["notes.h", "src/main.c"]);
    expect((await clients[1].post(`${endpoint}/preparation`, { data: { contextKey: (await state(clients[1])).teamwork.contextKey, kind: "file", path: "notes.h", base64: "YQ==", expectedRevision: 0, replace: true } })).status()).toBe(409);
    await responseJson(await clients[1].delete(`${endpoint}/preparation`, { data: { contextKey: (await state(clients[1])).teamwork.contextKey, path: "notes.h", expectedRevision: 1 } }));
    await page.goto(assigned.replace(/^\/api/, ""));
    await expect(page.getByRole("tab", { name: /src\/main.c/ })).toBeVisible();
    await expect(page.getByText("Blue", { exact: false }).first()).toBeVisible();
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { contextKey: (await state()).teamwork.contextKey, expectedRevision: 2 } }));
    await waitReady(student); await waitReady(clients[1]);
    const first = (await state(student)).submission!, second = (await state(clients[1])).submission!;
    expect(first.id).not.toBe(second.id); expect(model.starts.length).toBe(separate ? 6 : 3);
    expect((await clients[1].delete(`${endpoint}/preparation`, { data: { contextKey: (await state(clients[1])).teamwork.contextKey, all: true, expectedRevision: 2 } })).status()).toBe(409);
    const download = await clients[1].get(`${endpoint}/submitted-download?submissionId=${second.id}`); expect(download.ok()).toBe(true);
    const zip = unzipSync(await download.body()); expect(Buffer.from(zip["src/main.c"]).toString()).toBe(code);
    expect(await responseJson(await clients[1].post(`${endpoint}/submitted-check`, { data: { submissionId: second.id } }))).toMatchObject({ readiness: { canSubmit: true } });
    expect((await clients[2].get(`${endpoint}/submitted-download?submissionId=${first.id}`)).status()).toBe(404);
    const locked = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacherApi.get(settingsPath))).settings;
    expect(locked.general.teamworkLocked).toBe(true);
    expect((await teacherApi.post(settingsPath, { data: { ...assignmentData, teamworkEnabled: false } })).status()).toBe(409);
    const edited = await responseJson<{ assignment: Record<string, unknown> }>(await teacherApi.get(`${teacherPath}/authoring`));
    expect((await teacherApi.put(`${teacherPath}/authoring`, { data: { assignment: { ...edited.assignment, settings: { ...(edited.assignment.settings as object), separateTeamQuestions: !separate } }, requirements: { requiredFiles: [{ path: "src/main.c" }] } } })).status()).toBe(409);
    const answers = await responseJson<Questions>(await student.post(`${endpoint}/answering`, { data: { submissionId: (await state()).submission!.id } }));
    const teammateAnswers = await responseJson<Questions>(await clients[1].post(`${endpoint}/answering`, { data: { submissionId: second.id } }));
    if (!separate) expect(answers.questions.map(question => question.questionText)).toEqual(teammateAnswers.questions.map(question => question.questionText));
    expect(answers.questions.map(question => question.id)).not.toEqual(teammateAnswers.questions.map(question => question.id));
    await responseJson(await student.put(`${endpoint}/challenge-answers`, { data: { submissionId: first.id, answers: [{ questionId: answers.questions[0].id, answer: "Private answer from first member." }] } }));
    expect(JSON.stringify(await responseJson(await clients[1].get(`${endpoint}/answering`)))).not.toContain("Private answer");
    expect((await clients[1].put(`${endpoint}/challenge-answers`, { data: { submissionId: first.id, answers: [] } })).status()).toBe(403);
    await responseJson(await student.post(`${endpoint}/challenge-answers`, { data: { submissionId: first.id, answers: [] } }));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId, userId: seed.id, lifecycle: "submitted" } });
    await responseJson(await teacherApi.patch(`/api/courses/${data.courseId}/gradebook/items/${attempt.gradebookItemId}/participants/${attempt.participantId}/override`, { data: { score: 80, maxScore: 100, reason: "Team lifecycle test", expectedGradeUpdatedAt: null } }));
    // A late joiner receives own answering participation; common mode makes no new AI calls.
    await move(participants, []); await waitReady(clients[2]);
    expect(model.starts.length).toBe(separate ? 9 : 3);
    // Moving the graded student revokes all previous access and the active grade.
    await move(participants.slice(1), [participants[0]]);
    expect((await state()).submission).toBeNull(); expect((await preparation()).draft.files).toEqual([]);
    expect((await student.post(`${endpoint}/preparation`, { data: { contextKey: originalContext, expectedRevision: 0, kind: "file", path: "main.c", base64: Buffer.from(code).toString("base64") } })).status()).toBe(409);
    expect((await preparation()).draft.files).toEqual([]);
    expect(await prisma.grade.count({ where: { gradebookItemId: attempt.gradebookItemId, participantId: attempt.participantId } })).toBe(0);
    expect((await student.get(`${endpoint}/submitted-download?submissionId=${first.id}`)).status()).toBe(404);
    expect([403, 409]).toContain((await student.put(`${endpoint}/challenge-answers`, { data: { submissionId: first.id, answers: [] } })).status());
    // Reset only the second member. The third keeps the same questions and the files remain frozen.
    const thirdId = (await state(clients[2])).submission!.id;
    await responseJson(await teacherApi.post(`${teacherPath}/manage-submissions`, { data: { action: "reset-challenges", submissionId: second.id, reason: "Reset one student's answers." } }));
    await waitReady(clients[1]); expect((await state(clients[1])).submission!.id).not.toBe(second.id); expect((await state(clients[2])).submission!.id).toBe(thirdId);
    // Returning starts fresh individual answering, not the original answer/grade.
    await move(participants, []); await waitReady(student);
    expect((await state()).submission!.id).not.toBe(first.id);
    const fresh = await responseJson<Questions>(await student.post(`${endpoint}/answering`, { data: { submissionId: (await state()).submission!.id } }));
    expect(fresh.questions.every(question => !question.studentAnswer)).toBe(true);
    // Whole-team cancellation reopens all three students.
    await responseJson(await teacherApi.delete(`${teacherPath}/manage-submissions`, { data: { submissionId: fresh.submissionId, reason: "Reopen the shared code." } }));
    for (const client of clients) expect((await state(client)).submission).toBeNull();
    const revision = (await preparation()).draft.revision;
    await responseJson(await student.post(`${endpoint}/hand-in`, { data: { contextKey: (await state()).teamwork.contextKey, expectedRevision: revision } })); await waitReady(student);
    const [stored] = await prisma.$queryRaw<Array<{ workspaceId: string; sharedSourceId: string }>>`SELECT "workspaceId","sharedSourceId" FROM "PluginCodingHomeworkSubmission" WHERE id=${(await state()).submission!.id}`;
    await move([], participants);
    expect((await preparation()).draft.files).toEqual([]);
    expect(await prisma.$queryRaw`SELECT id FROM "PluginCodingHomeworkWorkspace" WHERE id=${stored.workspaceId}`).toEqual([]);
    expect(await prisma.$queryRaw`SELECT id FROM "PluginCodingHomeworkSubmission" WHERE "workspaceId"=${stored.workspaceId}`).toEqual([]);
    await expect.poll(() => access(path.join(process.cwd(), "storage/coding-homework-grader/submissions", stored.sharedSourceId)).then(() => true, () => false)).toBe(false);
    const events = await prisma.$queryRaw<Array<{ operation: string; actorUserId: string }>>`SELECT operation,"actorUserId" FROM "PluginCodingHomeworkWorkspaceEvent" WHERE "activityId"=${activityId}`;
    expect(events.some(event => event.operation === "file_added" && event.actorUserId === seed.id)).toBe(true);
    expect(events.some(event => event.operation === "file_deleted" && event.actorUserId === users[0])).toBe(true);
    expect(events.some(event => event.operation === "empty_workspace_erased")).toBe(true);
    await page.reload(); await expect(page.getByRole("heading", { name: "Prepare your work", exact: true })).toBeVisible();
  } finally {
    if (activityId) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: activityId } } });
    await Promise.all(clients.map(client => client.dispose()));
    await prisma.user.deleteMany({ where: { id: { in: users } } }); await model.close();
  }
});
