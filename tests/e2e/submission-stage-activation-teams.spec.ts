import { prisma } from "@cognelo/db";
import type { StudentGroupingDto } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor } from "./fixtures/auth";
import { homeworkModelFixture } from "./fixtures/homework-model";

for (const separate of [false, true]) test(`a newly activated member releases a waiting team's ${separate ? "individual" : "common"} questions`, async ({ bankCourse: data, teacherApi: api }) => {
  test.setTimeout(120_000);
  const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("student").email } });
  const email = `waiting-team-${data.token}@example.test`, model = await homeworkModelFixture(data);
  const user = await prisma.user.create({ data: { email, firstName: "Waiting", lastName: "Teammate", passwordHash: seed.passwordHash, isActive: true, mustChangePassword: false, emailVerifiedAt: new Date(), roles: { create: { role: { connect: { key: "student" } } } } } });
  const first = await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("student").password }), joining = await createAuthenticatedApi("student");
  let id: string | undefined;
  try {
    const course = `/api/courses/${data.courseId}`, group = `${course}/groups/${data.groupId}`;
    const { participant } = await responseJson<{ participant: { id: string } }>(await api.post(`${group}/participants`, { data: { email, role: "student" } }));
    const joiningParticipant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, userId: seed.id } });
    const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(`${group}/groupings`, { data: { title: "Waiting teams", teams: [{ title: "Blue", participantIds: [participant.id] }] } }));
    id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Waiting team activation", config: {} });
    const author = `${course}/activities/${id}/coding-homework-grader`, settingsPath = `${course}/activities/${id}/assign-all-groups`, endpoint = `${group}/activities/assigned/${id}/coding-homework-grader`;
    const authored = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${author}/authoring`));
    await responseJson(await api.put(`${author}/authoring`, { data: { assignment: { ...authored.assignment, questionCount: 1, settings: { separateTeamQuestions: separate } }, requirements: { requiredFiles: [{ path: "main.c" }] } } }));
    let settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsPath))).settings;
    await responseJson(await api.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", teamworkEnabled: true, submissionStages: { files: { enabled: true }, questions: { enabled: false } }, groupAssignments: settings.groups.map(group => ({ ...group, assigned: true, teamGroupingId: grouping.id, allowIndividualSubmission: false })) } }));
    const state = async (client = first) => responseJson<{ questionsStageEnabled: boolean; teamwork: { contextKey: string }; submission: { id: string; status: string } }>(await client.get(`${endpoint}/workspace`));
    await responseJson(await first.post(`${endpoint}/preparation`, { data: { contextKey: (await state()).teamwork.contextKey, kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int add(int a, int b) { return a + b; }").toString("base64") } }));
    await responseJson(await first.post(`${endpoint}/hand-in`, { data: { contextKey: (await state()).teamwork.contextKey, expectedRevision: 1 } }));
    expect(model.starts).toHaveLength(0);
    await responseJson(await api.put(`${author}/workflow-settings`, { data: { selected: [] } })); await responseJson(await api.post(`${author}/prepare-references`, { data: {} }));
    settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsPath))).settings;
    await responseJson(await api.post(settingsPath, { data: { ...settings.general, groupAssignments: settings.groups.map(group => ({ ...group, exceptions: [{ participantId: joiningParticipant.id, submissionStages: { questions: { enabled: true } } }] })) } }));
    expect(await prisma.backgroundJob.count({ where: { queue: "coding-homework-grader", payload: { path: ["activityId"], equals: id } } })).toBe(0);
    // Only the joining member is activated. Joining itself must release the pending work.
    await responseJson(await api.patch(`${group}/groupings/${grouping.id}`, { data: { ...grouping, teams: grouping.teams.map(team => ({ ...team, participantIds: [participant.id, joiningParticipant.id] })) } }));
    await expect.poll(async () => (await state(joining)).submission.status, { timeout: 30_000 }).toBe("challenge_ready");
    expect(model.starts).toHaveLength(1); expect((await state()).questionsStageEnabled).toBe(false);
    expect((await first.post(`${endpoint}/answering`, { data: { submissionId: (await state()).submission.id } })).status()).toBe(409);
    await responseJson(await joining.post(`${endpoint}/answering`, { data: { submissionId: (await state(joining)).submission.id } }));
    settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsPath))).settings;
    await responseJson(await api.post(settingsPath, { data: { ...settings.general, submissionStages: { ...settings.general.submissionStages, questions: { enabled: true } }, groupAssignments: settings.groups, confirmActiveStudents: true } }));
    await expect.poll(async () => (await state()).submission.status, { timeout: 30_000 }).toBe("challenge_ready");
    expect(model.starts).toHaveLength(separate ? 2 : 1);
  } finally {
    if (id) await prisma.backgroundJob.deleteMany({ where: { payload: { path: ["activityId"], equals: id } } });
    await first.dispose(); await joining.dispose(); await prisma.user.delete({ where: { id: user.id } }); await model.close();
  }
});
