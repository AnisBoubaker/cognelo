import { prisma } from "@cognelo/db";
import { expect, test } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";
import { API_BASE_URL, createAuthenticatedApi } from "./fixtures/auth";
import type { CourseTestAttemptReview, TestItemTeacherReview } from "../../apps/web/src/lib/api";

// API-only integration: no page, browser, model, or learner-code execution is requested.
test("Save all atomically saves rubric edits and Test totals without freezing later calculation", async ({ bankCourse: data, teacherApi }) => {
  test.setTimeout(120_000);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(API_BASE_URL).hostname);
  const student = await createAuthenticatedApi("student");
  try {
    const base = `/api/courses/${data.courseId}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string; title: string } } }>(await teacherApi.post(`${base}/tests`, {
      data: { title: `Save all ${data.token}`, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true } }
    }));
    const children: Array<{ id: string; activityId: string }> = [];
    for (const points of [10, 30]) {
      const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacherApi.post(`${base}/activities/${created.activity.id}/test/items`, {
        data: { source: "local", activityTypeKey: "coding-exercise", title: `Question ${points}`, pointsPossible: points,
          config: { language: "python", prompt: "Print the number one.", starterCode: "", sampleTests: [] } }
      }));
      children.push(item);
      await responseJson(await teacherApi.put(`${base}/activities/${item.activityId}/coding-exercises/hidden-tests`, { data: {
        tests: [], referenceSolution: "print(1)", privateConfig: { templateSource: "{{ STUDENT_CODE }}", aiFeedback: {
          enabled: false, gradingEnabled: true, testWeightPercent: 0, aiWeightPercent: 100,
          criteria: [{ id: "quality", title: "Quality", description: "Assess the submitted logic.", weightPercent: 100 }]
        } }
      } }));
    }
    await assignCourseTest(data, created.activity.id, created.activity.title);
    const assigned = `${base}/groups/${data.groupId}/activities/assigned/${created.activity.id}`;
    const { runtime } = await responseJson<{ runtime: { attempt: { id: string } } }>(await student.post(`${assigned}/test`, { data: { sessionId: "save-all" } }));
    const parentId = runtime.attempt.id;
    for (const child of children) await responseJson(await student.put(`${assigned}/test/items/${child.id}`, {
      data: { parentAttemptId: parentId, sessionId: "save-all", state: { sourceCode: "print(1)" } }
    }));
    await responseJson(await student.post(`${assigned}/test/submit`, { data: { parentAttemptId: parentId, sessionId: "save-all" } }));
    const path = `${base}/gradebook/attempts/${parentId}/test-review`;
    const load = async () => (await responseJson<{ review: CourseTestAttemptReview }>(await teacherApi.get(path))).review;
    const childReview = async (id: string) => (await responseJson<{ review: TestItemTeacherReview }>(await teacherApi.get(`${base}/gradebook/attempts/${parentId}/test-items/${id}/review`))).review;
    const patch = (review: TestItemTeacherReview, score: number) => ({ testItemId: review.testItemId,
      expectedUpdatedAt: review.updatedAt, expectedFeedbackHash: review.feedbackHash,
      feedback: { summary: `Reviewed ${score}`, strengths: [], improvements: [],
        criteria: [{ id: "quality", scorePercent: score, feedback: `Score ${score}` }] } });
    const before = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: parentId }, include: { testItemAttempts: true } });
    const executionEvidence = () => prisma.$queryRaw`SELECT id,md5(row_to_json(e)::text) fingerprint FROM "PluginCodingExerciseExecution" e
      WHERE "activityId" IN (${children[0].activityId},${children[1].activityId}) ORDER BY id`;
    const executions = await executionEvidence();
    let current = await load();
    const initial = await Promise.all(children.map(item => childReview(item.id)));
    expect((await student.patch(path, { data: { expectedUpdatedAt: current.updatedAt, expectedGradeUpdatedAt: current.gradeUpdatedAt,
      items: initial.map(item => patch(item, 50)) } })).status()).toBe(403);
    await responseJson(await teacherApi.patch(path, { data: { expectedUpdatedAt: current.updatedAt, expectedGradeUpdatedAt: current.gradeUpdatedAt,
      items: initial.map(item => patch(item, 50)), feedbackText: "Overall feedback", total: { mode: "calculated" } } }));
    current = await load();
    expect(current.grade).toMatchObject({ score: 10, maxScore: 20 });
    expect(current.items.map(item => item.itemAttempt.normalizedScore)).toEqual([5, 15]);
    expect(current.feedbackText).toBe("Overall feedback");

    // A stale second question must roll back the first question and its audit too.
    const baseline = await prisma.testItemAttempt.findMany({ where: { parentAttemptId: parentId }, orderBy: { id: "asc" } });
    const auditCount = await prisma.courseAuditEvent.count({ where: { courseId: data.courseId } });
    const loaded = await Promise.all(children.map(item => childReview(item.id)));
    const stale = [patch(loaded[0], 80), { ...patch(loaded[1], 80), expectedFeedbackHash: "stale" }];
    expect((await teacherApi.patch(path, { data: { expectedUpdatedAt: current.updatedAt, expectedGradeUpdatedAt: current.gradeUpdatedAt, items: stale } })).status()).toBe(409);
    expect(await prisma.testItemAttempt.findMany({ where: { parentAttemptId: parentId }, orderBy: { id: "asc" } })).toEqual(baseline);
    expect(await prisma.courseAuditEvent.count({ where: { courseId: data.courseId } })).toBe(auditCount);

    await responseJson(await teacherApi.patch(path, { data: { expectedUpdatedAt: current.updatedAt, expectedGradeUpdatedAt: current.gradeUpdatedAt,
      items: [], total: { mode: "override", score: 12 } } }));
    current = await load(); expect(current.grade).toMatchObject({ score: 12, source: "override" });
    const second = await childReview(children[1].id);
    await responseJson(await teacherApi.patch(path, { data: { expectedUpdatedAt: current.updatedAt, expectedGradeUpdatedAt: current.gradeUpdatedAt,
      items: [patch(second, 100)], total: { mode: "calculated" } } }));
    current = await load(); expect(current.grade).toMatchObject({ score: 17.5, source: "regrade" });
    expect(current.feedbackText).toBe("Overall feedback");

    const grade = await prisma.grade.findUniqueOrThrow({ where: { gradebookItemId_participantId: {
      gradebookItemId: before.gradebookItemId, participantId: before.participantId
    } } });
    await responseJson(await teacherApi.patch(path, { data: { expectedUpdatedAt: current.updatedAt, expectedGradeUpdatedAt: current.gradeUpdatedAt,
      items: [], feedbackText: "Updated overall feedback" } }));
    const narrative = await prisma.grade.findUniqueOrThrow({ where: { id: grade.id } });
    expect(narrative.gradedAt).toEqual(grade.gradedAt);
    expect(narrative.normalizedScore).toBe(17.5);
    expect(narrative.source).toBe("regrade");
    expect(JSON.stringify(narrative.normalizedResult)).toContain("Updated overall feedback");
    current = await load();
    const first = await childReview(children[0].id);
    await responseJson(await teacherApi.patch(path, { data: { expectedUpdatedAt: current.updatedAt, expectedGradeUpdatedAt: current.gradeUpdatedAt,
      items: [{ testItemId: first.testItemId, expectedUpdatedAt: first.updatedAt, expectedFeedbackHash: first.feedbackHash, score: 2 }] } }));
    current = await load(); expect(current.grade?.score).toBe(16);
    const overridden = await childReview(children[0].id); expect(overridden.manuallyGraded).toBe(true);
    await responseJson(await teacherApi.patch(path, { data: { expectedUpdatedAt: current.updatedAt, expectedGradeUpdatedAt: current.gradeUpdatedAt,
      items: [{ ...patch(overridden, 80), useRubricScore: true }], total: { mode: "calculated" } } }));
    current = await load(); expect(current.grade?.score).toBe(19);
    expect((await childReview(children[0].id)).manuallyGraded).toBe(false);
    expect(current.feedbackText).toBe("Updated overall feedback");
    const gradesPath = `${base}/groups/${data.groupId}/grades`;
    expect(await (await student.get(gradesPath)).text()).not.toContain("Updated overall feedback");
    expect(await (await student.get(`${assigned}/test?view=previous`)).text()).not.toContain("Updated overall feedback");
    await responseJson(await teacherApi.patch(`${base}/gradebook/items/${before.gradebookItemId}/release`, { data: { released: true } }));
    expect(await (await student.get(gradesPath)).text()).toContain("Updated overall feedback");
    await responseJson(await teacherApi.patch(`${base}/gradebook/items/${before.gradebookItemId}/release`, { data: { released: false } }));
    expect(await executionEvidence()).toEqual(executions);
    const after = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: parentId }, include: { testItemAttempts: true } });
    expect(after.startedAt).toEqual(before.startedAt); expect(after.submittedAt).toEqual(before.submittedAt);
    for (const child of after.testItemAttempts) expect((child.result as { state: unknown }).state)
      .toEqual((before.testItemAttempts.find(previous => previous.id === child.id)!.result as { state: unknown }).state);
  } finally { await student.dispose(); }
});
