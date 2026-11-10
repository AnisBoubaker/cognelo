import { prisma } from "@cognelo/db";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";

test("stage activation resolves section and student overrides and guards section-specific mutations", async ({ bankCourse: data, teacherApi: api }) => {
  const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Activation overrides", config: {} });
  const base = `/api/courses/${data.courseId}`, author = `${base}/activities/${id}/coding-homework-grader`;
  const endpoint = `${base}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
  const learner = await createAuthenticatedApi("student");
  try {
    const authored = await responseJson<{ assignment: Record<string, unknown> }>(await api.get(`${author}/authoring`));
    await responseJson(await api.put(`${author}/authoring`, { data: { assignment: { ...authored.assignment, settings: { questionGenerationEnabled: false } }, requirements: {} } }));
    const { assignment } = await responseJson<{ assignment: { id: string; metadata: object } }>(await api.post(`${base}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative", submissionStages: { files: { enabled: true } } } } }));
    expect(await responseJson(await learner.get(`${endpoint}/workspace`))).toMatchObject({ filesStageEnabled: true, questionsStageEnabled: false });
    await responseJson(await api.patch(`${base}/groups/${data.groupId}/activities/${assignment.id}`, { data: { metadata: { ...assignment.metadata, submissionStages: { files: { enabled: false } } } } }));
    expect(await responseJson(await learner.get(`${endpoint}/workspace`))).toMatchObject({ filesStageEnabled: false });
    const [privateState] = await prisma.$queryRaw<Array<{ settings: { submissionsEnabled: boolean } }>>`SELECT settings FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${id}`;
    expect(privateState.settings.submissionsEnabled).toBe(false);

    const settingsPath = `${base}/activities/${id}/assign-all-groups`;
    const read = async () => (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsPath))).settings;
    const participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, email: credentialsFor("student").email } });
    let settings = await read();
    await responseJson(await api.post(settingsPath, { data: { ...settings.general, assessmentMode: "summative", submissionStages: { files: { enabled: false } }, groupAssignments: settings.groups.map(group => ({ ...group, assigned: true, submissionStages: { files: { enabled: true } }, exceptions: [{ participantId: participant.id, submissionStages: { files: { enabled: false } } }] })) } }));
    expect(await responseJson(await learner.get(`${endpoint}/workspace`))).toMatchObject({ filesStageEnabled: false });
    // Removing the student override restores the explicitly activated section.
    settings = await read();
    await responseJson(await api.post(settingsPath, { data: { ...settings.general, groupAssignments: settings.groups.map(group => ({ ...group, exceptions: [] })) } }));
    expect(await responseJson(await learner.get(`${endpoint}/workspace`))).toMatchObject({ filesStageEnabled: true, questionsStageEnabled: false });
    expect((await read()).general.submissionStages?.files?.enabled).toBe(false);
    expect(await prisma.activityAttempt.count({ where: { activityId: id } })).toBe(0);
  } finally { await learner.dispose(); }
});


test("closed unprepared legacy homework stays editable without silently opening a new question stage", async ({ bankCourse: data, teacherApi: api }) => {
  const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Legacy activation upgrade", config: {} });
  const base = `/api/courses/${data.courseId}/activities/${id}`, plugin = `${base}/coding-homework-grader`, settingsPath = `${base}/assign-all-groups`;
  await responseJson(await api.get(`${plugin}/authoring`));
  // Reconstruct a pre-activation record only inside this disposable course.
  await prisma.$executeRaw`UPDATE "Activity" SET metadata=metadata #- '{allGroupsAssignment,submissionStages}' WHERE id=${id}`;
  await prisma.$executeRaw`UPDATE "PluginCodingHomeworkAssignment" SET settings=(settings-'questionsStageEnabled') || '{"submissionsEnabled":false}'::jsonb WHERE "activityId"=${id}`;
  let settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsPath))).settings;
  expect(settings.general.submissionStages).toMatchObject({ files: { enabled: false }, questions: { enabled: true } });
  await responseJson(await api.post(settingsPath, { data: { ...settings.general, groupAssignments: settings.groups } }));
  settings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsPath))).settings;
  const opened = await api.post(settingsPath, { data: { ...settings.general, submissionStages: { ...settings.general.submissionStages, files: { enabled: true } }, groupAssignments: settings.groups } });
  expect(opened.status()).toBe(409); expect(await opened.json()).toMatchObject({ error: { code: "HOMEWORK_EMBEDDINGS_REQUIRED" } });
  await responseJson(await api.post(settingsPath, { data: { ...settings.general, submissionStages: { files: { enabled: true }, questions: { enabled: false } }, groupAssignments: settings.groups } }));
  expect(await responseJson(await api.get(`${plugin}/workflow-settings`))).toMatchObject({ enabled: true, prepared: false });
});
