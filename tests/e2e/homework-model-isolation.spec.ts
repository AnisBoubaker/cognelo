import { prisma } from "@cognelo/db";
import { generateAiAgentText, getCourseTeacherQuestionAuthoringAiAgentConnection } from "@cognelo/core";
import { test, expect } from "./fixtures/bank-course";
import { credentialsFor } from "./fixtures/auth";
import { provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";
import { homeworkModelFixture } from "./fixtures/homework-model";

test("AI fixtures keep shared preferences and other course models isolated throughout their lifetime", async ({ bankCourse: data, teacherApi }) => {
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("teacher").email } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("admin").email } });
  const user = { id: teacher.id, email: teacher.email, name: teacher.name, firstName: teacher.firstName, lastName: teacher.lastName, roles: ["teacher" as const] };
  const control = await provisionActivitySuite();
  const resolve = async (courseId: string) => {
    try { const connection = await getCourseTeacherQuestionAuthoringAiAgentConnection(user, courseId); return { id: connection.id, model: connection.model }; }
    catch (error) { return { code: (error as { code: string }).code }; }
  };
  const controlBefore = await resolve(control.courseId);
  let first: Awaited<ReturnType<typeof homeworkModelFixture>> | undefined;
  let second: Awaited<ReturnType<typeof homeworkModelFixture>> | undefined;
  const sharedPreferences = async () => {
    const rows = await prisma.user.findMany({ where: { id: { in: [teacher.id, admin.id] } }, select: { id: true, metadata: true }, orderBy: { id: "asc" } });
    return rows.map(row => ({ id: row.id, preferences: (row.metadata as { aiPreferences?: unknown } | null)?.aiPreferences ?? null }));
  };
  const before = await sharedPreferences();
  try {
    first = await homeworkModelFixture(data, { questionText: () => "Fixture A: explain the return value of the supplied synthetic function." });
    expect(await sharedPreferences()).toEqual(before);
    expect(await resolve(control.courseId)).toEqual(controlBefore);
    const visible = await responseJson<{ connections: Array<{ id: string }> }>(await teacherApi.get("/api/ai-agents"));
    expect(visible.connections.map(connection => connection.id)).not.toContain(first.connection.id);
    expect((await teacherApi.patch("/api/ai-agents/preferences", { data: { questionAuthoringAiAgentConnectionId: first.connection.id } })).status()).toBe(404);
    second = await homeworkModelFixture(control, { questionText: () => "Fixture B: explain the return value of the supplied synthetic function." });
    const connectionA = await getCourseTeacherQuestionAuthoringAiAgentConnection(user, data.courseId);
    const connectionB = await getCourseTeacherQuestionAuthoringAiAgentConnection(user, control.courseId);
    expect(connectionA.id).toBe(first.connection.id); expect(connectionB.id).toBe(second.connection.id);
    expect(connectionA.ownerId).not.toBe(connectionB.ownerId);
    const request = { systemPrompt: "Synthetic fixture isolation check.", userPrompt: JSON.stringify({ submittedCode: "int fixture(void) { return 1; }" }) };
    const [answerA, answerB] = await Promise.all([generateAiAgentText(connectionA, request), generateAiAgentText(connectionB, request)]);
    expect(JSON.parse(answerA).questionText).toMatch(/^Fixture A:/); expect(JSON.parse(answerB).questionText).toMatch(/^Fixture B:/);
    expect(first.requests).toHaveLength(1); expect(second.requests).toHaveLength(1);
    await second.close(); second = undefined;
    expect(await resolve(control.courseId)).toEqual(controlBefore);
    expect((await resolve(data.courseId)).id).toBe(first.connection.id);
    await first.close(); first = undefined;
    expect(await sharedPreferences()).toEqual(before);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: data.courseId } })).createdById).toBe(teacher.id);
  } finally {
    await second?.close(); await first?.close(); await removeActivitySuite(control);
  }
});
