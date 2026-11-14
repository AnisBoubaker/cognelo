import { prisma } from "@cognelo/db";
import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";

test("a graded coding submission stays Done for empty, starter and unchanged drafts, but recognizes real new work", async ({ bankCourse: data, teacherApi: api, teacherPage: teacher }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const starter = "# Write your answer here\n";
    const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: "Completed coding progress", config: { language: "python", prompt: "Write a program.", starterCode: starter, sampleTests: [] } });
    await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    const assignment = await prisma.courseGroupActivity.findUniqueOrThrow({ where: { groupId_activityId: { groupId: data.groupId, activityId: id } } });
    const item = await prisma.gradebookItem.findUniqueOrThrow({ where: { groupActivityId: assignment.id } });
    const participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, email: credentialsFor("student").email } });
    const submittedSourceCode = "print('submitted')\n";
    const base = { courseId: data.courseId, groupId: data.groupId, groupActivityId: assignment.id, activityId: id, gradebookItemId: item.id, participantId: participant.id, userId: participant.userId, pluginKey: "coding-exercises", pluginVersion: "e2e", assessmentMode: "summative" };
    await prisma.activityAttempt.create({ data: { ...base, attemptNumber: 1, lifecycle: "graded", startedAt: new Date(Date.now()-120_000), submittedAt: new Date(Date.now()-60_000), gradedAt: new Date(), metadata: { submittedSourceCode } } });
    await responseJson(await api.patch(`/api/courses/${data.courseId}/gradebook/items/${item.id}/participants/${participant.id}/override`, { data: { score: 80, maxScore: 100, reason: "Reviewed", expectedGradeUpdatedAt: null } }));
    const draft = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}/draft`;
    const report = `/courses/${data.courseId}/gradebook/activities/${id}`;
    const progress = teacher.locator(".table-row-gradebook-detail").filter({ hasText: participant.email }).locator(".gradebook-progress-column");
    for (const sourceCode of ["", " \n\t", starter, submittedSourceCode]) {
      await responseJson(await student.put(draft, { data: { state: { sourceCode } } }));
      await teacher.goto(report);
      await expect(progress).toContainText("Done");
      await expect(teacher.locator(".gradebook-grade-cell")).toContainText("80 / 100");
    }
    await responseJson(await student.put(draft, { data: { state: { sourceCode: "print('new work')\n" } } }));
    await teacher.reload(); await expect(progress).toContainText("In progress");
    await expect(teacher.locator(".gradebook-grade-cell")).toContainText("80 / 100");
    await responseJson(await student.put(draft, { data: { state: { sourceCode: "" } } }));
    await prisma.activityAttempt.create({ data: { ...base, attemptNumber: 2, lifecycle: "started" } });
    await teacher.reload(); await expect(progress).toContainText("Attempt 2 in progress");
  } finally { await student.dispose(); }
});

test("opening an empty coding editor creates no draft until a student edits", async ({ bankCourse: data, teacherApi: api, studentPage: student }) => {
  const id = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title: "Empty editor baseline", config: { language: "python", prompt: "Write a program.", starterCode: "", sampleTests: [] } });
  await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
  const assignment = await prisma.courseGroupActivity.findUniqueOrThrow({ where: { groupId_activityId: { groupId: data.groupId, activityId: id } } });
  await student.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`);
  const editor = student.locator(".monaco-editor textarea.inputarea").first();
  await expect(editor).toBeEditable();
  expect(await prisma.activityResponseDraft.count({ where: { groupActivityId: assignment.id } })).toBe(0);
  await editor.focus(); await student.keyboard.insertText("x");
  await expect.poll(async () => (await prisma.activityResponseDraft.findFirst({ where: { groupActivityId: assignment.id }, select: { state: true } }))?.state).toEqual({ sourceCode: "x" });
});
