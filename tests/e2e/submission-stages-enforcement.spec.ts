import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";
import { prisma } from "@cognelo/db";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";

for (const team of [false, true]) test(`file-stage clock survives reload/removal and recovers ${team ? "team" : "individual"} saved work at expiry`, async ({ bankCourse: data, teacherApi: api }) => {
  const learner = await createAuthenticatedApi("student");
  try {
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "File stage clock", config: {} });
    const base = `/api/courses/${data.courseId}/activities/${id}/coding-homework-grader`, endpoint = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`, settingsUrl = `/api/courses/${data.courseId}/activities/${id}/assign-all-groups`;
    const authored = await responseJson<{ assignment: object; requirements: { requirements: object } }>(await api.get(`${base}/authoring`));
    await responseJson(await api.put(`${base}/authoring`, { data: { assignment: { ...authored.assignment, settings: { questionGenerationEnabled: false } }, requirements: { ...authored.requirements.requirements, requiredFiles: [{ path: "missing.h" }] } } }));
    const settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsUrl))).settings;
    let groupingId: string | null = null;
    if (team) {
      const participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, email: credentialsFor("student").email } });
      groupingId = (await responseJson<{ grouping: { id: string } }>(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/groupings`, { data: { title: "Timer teams", teams: [{ title: "Timer team", participantIds: [participant.id] }] } }))).grouping.id;
    }
    await responseJson(await api.post(settingsUrl, { data: { ...settings.general, teamworkEnabled: team, submissionStages: { files: { deadline: null, timeLimitMinutes: 1 } }, groupAssignments: settings.groups.map(group => ({ ...group, assigned: true, teamGroupingId: groupingId, allowIndividualSubmission: false })) } }));
    await responseJson(await api.put(`${base}/workflow-settings`, { data: { enabled: true } }));
    type State = { preparationStartedAt: string | null; submissionClosesAt: string | null; teamwork?: { contextKey: string }; submission: null | { id: string; status: string; automaticHandIn: boolean; incompleteAcknowledged: boolean } };
    const read = async () => responseJson<State>(await learner.get(`${endpoint}/workspace`));
    let state = await read(); expect(state.preparationStartedAt).toBeNull(); expect(state.submissionClosesAt).toBeNull();
    const scope = state.teamwork ? { contextKey: state.teamwork.contextKey } : {}, upload = (revision: number) => learner.post(`${endpoint}/preparation`, { data: { ...scope, kind: "file", path: "main.c", expectedRevision: revision, base64: Buffer.from("int main(void) { return 0; }").toString("base64") } });
    await responseJson(await upload(0)); state = await read(); const started = state.preparationStartedAt; expect(started).toBeTruthy(); expect(Date.parse(state.submissionClosesAt!) - Date.parse(started!)).toBe(60_000);
    await responseJson(await learner.delete(`${endpoint}/preparation`, { data: { ...scope, all: true, expectedRevision: 1 } })); await responseJson(await upload(2)); expect((await read()).preparationStartedAt).toBe(started);
    const clockStart = new Date(Date.now() - 120_000), savedAt = new Date(Date.now() - 90_000);
    if (team) await prisma.$executeRaw`UPDATE "PluginCodingHomeworkWorkspace" SET "preparationStartedAt"=${clockStart},"updatedAt"=${savedAt} WHERE "activityId"=${id}`;
    else await prisma.$executeRaw`UPDATE "PluginCodingHomeworkDraft" SET "preparationStartedAt"=${clockStart},"updatedAt"=${savedAt} WHERE "activityId"=${id}`;
    expect((await upload(3)).status()).toBe(409);
    state = await read(); expect(state.submission).toMatchObject({ status: "ready_for_grading", automaticHandIn: true, incompleteAcknowledged: true });
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(1);
    await responseJson(await api.delete(`${base}/manage-submissions`, { data: { submissionId: state.submission!.id, reason: "Restart preparation stage" } }));
    state = await read(); expect(state.preparationStartedAt).toBeNull(); expect(state.submission).toBeNull();
  } finally { await learner.dispose(); }
});
