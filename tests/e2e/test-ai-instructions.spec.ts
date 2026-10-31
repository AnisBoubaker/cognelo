import { prisma } from "@cognelo/db";
import { expect, test, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { responseJson } from "./fixtures/activity-suite";
import { createAuthenticatedApi } from "./fixtures/auth";
import type { TestAiGradingInstructions } from "@cognelo/contracts";

for (const scope of ["course", "bank"] as const) {
  test(`replaces AI grading instructions only on eligible Test children (${scope})`, async ({ bankCourse: data, teacherApi, teacherPage: page }, testInfo) => {
    const owner = scope === "course" ? `/api/courses/${data.courseId}` : `/api/activity-banks/${data.activityBankId}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`${owner}/tests`, { data: {
      title: `Shared AI instructions ${data.token}`, lifecycle: "draft", settings: { allowResume: true }
    } }));
    const parentId = created.activity.id;
    const base = `${owner}/activities/${parentId}/test`;
    const items: Array<{ id: string; activity: { id: string } }> = [];
    for (const [index, activityTypeKey] of ["coding-exercise", "coding-exercise", "mcq", "coding-exercise"].entries()) {
      const { item } = await responseJson<{ item: { id: string; activity: { id: string } } }>(await teacherApi.post(`${base}/items`, { data: {
        source: "local", activityTypeKey, title: `Child ${index + 1}`, pointsPossible: 10,
        config: activityTypeKey === "mcq" ? { source: ORIGINAL_SOURCE, aiFeedbackEnabled: true, aiFeedbackInstructions: "Feedback-only policy" }
          : { language: "python", prompt: "Print the number one.", starterCode: "", sampleTests: [] }
      } }));
      items.push(item);
    }
    const privatePath = (index: number) => `${owner}/activities/${items[index].activity.id}/coding-exercises/hidden-tests`;
    const readPrivate = async (index: number) => (await responseJson<{ referenceSolution: { sourceCode: string; privateConfig: Record<string, unknown> } }>(await teacherApi.get(privatePath(index)))).referenceSolution;
    const grading = { enabled: true, gradingEnabled: true, instructions: "Original grading policy", testWeightPercent: 0, aiWeightPercent: 100,
      criteria: [{ id: "quality", title: "Quality", description: "Evaluate correctness.", weightPercent: 100 }] };
    await responseJson(await teacherApi.put(privatePath(0), { data: { tests: [], referenceSolution: "print(1)",
      privateConfig: { rubricGenerationGuidance: "Preserve rubric guidance", templateSource: "{{ STUDENT_CODE }}", aiFeedback: grading } } }));
    await responseJson(await teacherApi.put(privatePath(3), { data: { tests: [], referenceSolution: "print(4)", privateConfig: { aiFeedback: { instructions: "Removed child policy" } } } }));
    // Removed/archived children stay in historical storage but are never replacement targets.
    await responseJson(await teacherApi.delete(`${base}/items/${items[3].id}`));
    let publishedVersion: string | null = null;
    if (scope === "bank") {
      await responseJson(await teacherApi.patch(base, { data: { lifecycle: "published" } }));
      publishedVersion = (await prisma.bankActivity.findUniqueOrThrow({ where: { id: parentId } })).currentVersionId;
    }
    const before = await readPrivate(0);
    const mcqBefore = scope === "course"
      ? await prisma.activity.findUniqueOrThrow({ where: { id: items[2].activity.id } })
      : await prisma.bankActivity.findUniqueOrThrow({ where: { id: items[2].activity.id } });
    const endpoint = `${base}/ai-grading-instructions`;
    const student = await createAuthenticatedApi("student");
    try {
      expect((await student.get(endpoint)).status()).toBe(403);
      expect((await student.put(endpoint, { data: { instructions: "Forbidden", expectedRevision: "invalid" } })).status()).toBe(403);
    } finally { await student.dispose(); }
    const snapshot = await responseJson<TestAiGradingInstructions>(await teacherApi.get(endpoint));
    expect(snapshot.items.map(item => item.activityId)).toEqual(items.slice(0, 2).map(item => item.activity.id));
    await page.goto(`${owner}/activities/${parentId}`.replace("/api", ""));
    const action = page.getByRole("button", { name: "Replace AI grading instructions", exact: true });
    await action.click();
    const dialog = page.getByRole("dialog", { name: "Replace AI grading instructions", exact: true });
    await expect(dialog.getByText("Child 1", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Child 2", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Child 3", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Child 4", { exact: true })).toHaveCount(0);
    const field = dialog.getByRole("textbox", { name: "AI grading instructions", exact: true });
    await field.fill("Cancelled instructions");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await readPrivate(0)).toEqual(before);
    await action.click();
    const replacement = 'Grade reasoning first.\nAccept equivalent approaches and avoid double penalties. "Quoted text"';
    await field.fill(replacement);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("bulk-instructions-mobile.png") });
    await dialog.getByRole("button", { name: "Replace instructions", exact: true }).click();
    await expect(dialog).toBeHidden();
    const first = await readPrivate(0);
    expect(first).toMatchObject({ sourceCode: before.sourceCode, privateConfig: {
      ...before.privateConfig, aiFeedback: { ...grading, instructions: replacement }
    } });
    expect(first.privateConfig).toEqual({ ...before.privateConfig,
      aiFeedback: { ...(before.privateConfig.aiFeedback as Record<string, unknown>), instructions: replacement }
    });
    const second = await readPrivate(1);
    expect(second.privateConfig).toMatchObject({ aiFeedback: { instructions: replacement, enabled: false, gradingEnabled: false } });
    const removed = await readPrivate(3);
    expect((removed.privateConfig.aiFeedback as { instructions: string }).instructions).toBe("Removed child policy");
    const mcqAfter = scope === "course"
      ? await prisma.activity.findUniqueOrThrow({ where: { id: items[2].activity.id } })
      : await prisma.bankActivity.findUniqueOrThrow({ where: { id: items[2].activity.id } });
    expect(mcqAfter).toEqual(mcqBefore);
    expect((await teacherApi.put(endpoint, { data: { instructions: "Stale replacement", expectedRevision: snapshot.revision } })).status()).toBe(409);
    expect((await readPrivate(0)).privateConfig).toEqual(first.privateConfig);
    expect((await readPrivate(1)).privateConfig).toEqual(second.privateConfig);
    await page.reload();
    await action.click();
    await expect(field).toHaveValue(replacement);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const updated = await responseJson<TestAiGradingInstructions>(await teacherApi.get(endpoint));
    expect((await teacherApi.put(endpoint, { data: { instructions: " ", expectedRevision: updated.revision } })).status()).toBe(400);
    expect((await teacherApi.put(endpoint, { data: { instructions: replacement, expectedRevision: updated.revision } })).ok()).toBe(true);
    if (scope === "course") {
      expect(await prisma.courseAuditEvent.count({ where: { courseId: data.courseId, targetId: parentId, eventType: "test_ai_grading_instructions_replaced" } })).toBeGreaterThan(0);
      expect(await prisma.activityAttempt.count({ where: { activityId: parentId } })).toBe(0);
    } else {
      expect((await prisma.bankActivity.findUniqueOrThrow({ where: { id: parentId } })).lifecycle).toBe("draft");
      await responseJson(await teacherApi.patch(base, { data: { lifecycle: "published" } }));
      const republished = await prisma.bankActivity.findUniqueOrThrow({ where: { id: parentId } });
      expect(republished.lifecycle).toBe("published");
      expect(republished.currentVersionId).not.toBe(publishedVersion);
      expect((await readPrivate(0)).privateConfig).toEqual(first.privateConfig);
    }
  });
}
