import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";
import { prisma } from "@cognelo/db";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import type { SubmissionStagePolicies } from "@cognelo/contracts";

test("stage API resolves every calendar configuration and preserves ordinary activity policy", async ({ bankCourse: data, teacherApi: api }) => {
  const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Stage date matrix", config: {} });
  const base = `/api/courses/${data.courseId}/activities/${id}`, stageBase = `${base}/coding-homework-grader`, settingsUrl = `${base}/assign-all-groups`;
  const learner = await createAuthenticatedApi("student"), assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/coding-homework-grader`;
  const read = async () => (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(settingsUrl))).settings;
  const write = async (until: string | null, stages: SubmissionStagePolicies, overrides: SubmissionStagePolicies = {}) => {
    const current = await read();
    return responseJson(await api.post(settingsUrl, { data: { ...current.general, availableUntil: until, submissionStages: stages, groupAssignments: current.groups.map(group => ({ ...group, assigned: true, submissionStages: overrides })) } }));
  };
  try {
    const early = new Date(Date.now() + 3600_000).toISOString(), late = new Date(Date.now() + 7200_000).toISOString();
    for (const [own, overall, expected] of [[null, null, null], [early, null, early], [null, late, late], [early, late, early], [late, early, early], [early, early, early]] as const) {
      await write(overall, { files: { deadline: own }, questions: { deadline: own, timeLimitMinutes: null } });
      const workspace = await responseJson<{ submissionPolicy: { deadline: string | null }; submissionClosesAt: string | null }>(await learner.get(`${assigned}/workspace`));
      expect(workspace.submissionPolicy.deadline).toBe(expected); expect(workspace.submissionClosesAt).toBe(expected);
      const saved = await read(); expect(saved.general.submissionStages?.files?.deadline).toBe(own);
      expect(saved.submissionStages?.map(stage => stage.id)).toEqual(["files", "questions"]);
    }
    // Duration and late policy do not extend the global cutoff.
    await write(early, { files: { deadline: new Date(Date.now() + 1800_000).toISOString(), allowLate: true, lateLimitMinutes: 120 }, questions: { timeLimitMinutes: 5 } });
    expect(await responseJson(await learner.get(`${assigned}/workspace`))).toMatchObject({ submissionClosesAt: early });
    // A section may replace a field; explicit null clears only that field.
    await write(null, { files: { deadline: early, allowLate: false } }, { files: { deadline: null } });
    expect(await responseJson(await learner.get(`${assigned}/workspace`))).toMatchObject({ submissionPolicy: { deadline: null }, submissionClosesAt: null });
    const current = await read(), participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, email: credentialsFor("student").email } });
    await responseJson(await api.post(settingsUrl, { data: { ...current.general, groupAssignments: current.groups.map(group => ({ ...group, assigned: true, exceptions: [{ participantId: participant.id, submissionStages: { files: { deadline: late } } }] })) } }));
    expect(await responseJson(await learner.get(`${assigned}/workspace`))).toMatchObject({ submissionPolicy: { deadline: late } });
    const saved = await read();
    const invalid = await api.post(settingsUrl, { data: { ...saved.general, submissionStages: { invented: { deadline: early } }, groupAssignments: saved.groups } });
    expect(invalid.status()).toBe(400); expect((await read()).general).toEqual(saved.general);
    expect((await learner.post(settingsUrl, { data: { submissionStages: {} } })).status()).toBe(403);
    // Older plugin endpoints now write the core schedule, without mutating private legacy policy.
    await responseJson(await api.put(`${stageBase}/workflow-settings`, { data: { submissionPolicy: { deadline: early, allowLate: false, lateLimitMinutes: null } } }));
    expect((await read()).general.submissionStages?.files?.deadline).toBe(early);
    const [row] = await prisma.$queryRaw<Array<{ settings: Record<string, unknown> }>>`SELECT settings FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${id}`;
    expect(row.settings.submissionPolicy).toBeUndefined();
    const ordinary = await createCourseActivity(data, { activityTypeKey: "mcq", title: "Ordinary cutoff unchanged", config: { source: "## A\n- [x] B\n- [ ] C" } });
    const ordinaryUrl = `/api/courses/${data.courseId}/activities/${ordinary}/assign-all-groups`;
    const ordinarySettings = (await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(ordinaryUrl))).settings;
    expect(ordinarySettings.submissionStages).toEqual([]);
    expect((await api.post(ordinaryUrl, { data: { ...ordinarySettings.general, submissionStages: { files: { deadline: early } }, groupAssignments: ordinarySettings.groups } })).status()).toBe(400);
  } finally { await learner.dispose(); }
});
