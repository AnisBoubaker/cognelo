import { prisma } from "@cognelo/db";
import { expect, test } from "./fixtures/auth";

const courseId = "seed-course-programming-101";
const activityId = "seed-activity-c-median-feedback";

test.describe("guided batch AI grading", () => {
  test("uses up to three graded templates, preserves the instruction default, and never regrades examples", async ({ teacherPage: page }) => {
    test.setTimeout(120_000);
    const attempts = await prisma.activityAttempt.findMany({
      where: {
        activityId,
        assessmentMode: "summative",
        lifecycle: { in: ["submitted", "graded"] },
        pluginAttemptRef: { not: null }
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, attemptNumber: true, participantId: true }
    });
    const selectedAttempts = [...new Map(attempts.map((attempt) => [attempt.participantId, attempt])).values()];
    if (selectedAttempts.length < 4) throw new Error("The guided AI grading fixture requires four submitted programming attempts.");

    const templates = selectedAttempts.slice(0, 4).map((attempt, index) => ({
      attemptId: attempt.id,
      participantName: `Reviewed template ${index + 1}`,
      attemptNumber: attempt.attemptNumber
    }));
    const selectedTemplateIds = templates.slice(0, 3).map((template) => template.attemptId);
    const assessed: Array<{ attemptId: string; body: Record<string, unknown> }> = [];
    const instructionUpdates: Record<string, unknown>[] = [];
    let releaseFirstAssessment = () => undefined;
    let markFirstAssessmentStarted = () => undefined;
    const firstAssessmentStarted = new Promise<void>((resolve) => {
      markFirstAssessmentStarted = resolve;
    });
    const firstAssessmentGate = new Promise<void>((resolve) => {
      releaseFirstAssessment = resolve;
    });

    await page.route(`**/api/courses/${courseId}/gradebook/activities/${activityId}/ai-grading-batch`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            available: true,
            instructions: "Apply the reviewed examples consistently.",
            templates
          })
        });
        return;
      }
      instructionUpdates.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ updated: true }) });
    });
    let run: { id: string; activityId: string; status: string; stopReason: null; completed: number; total: number;
      students: Array<{ attemptId: string; name: string; status: string; error: null }> } | null = null;
    let runInput: Record<string, unknown> = {};
    await page.route(`**/api/courses/${courseId}/gradebook/activities/${activityId}/ai-grading-runs`, async route => {
      if (route.request().method() === "POST") {
        runInput = route.request().postDataJSON();
        const targets = runInput.attemptIds as string[];
        run = { id: "mock-run", activityId, status: "running", stopReason: null, completed: 0, total: targets.length,
          students: targets.map(attemptId => ({ attemptId, name: attemptId, status: "pending", error: null })) };
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ run: run?.status === "running" ? run : null }) });
    });
    await page.route(`**/api/courses/${courseId}/gradebook/ai-grading-runs/mock-run**`, async route => {
      if (route.request().method() === "POST") {
        const attemptId = new URL(route.request().url()).pathname.split("/").at(-1)!;
        assessed.push({ attemptId, body: { triggerKind: "teacher_batch", instructions: runInput.instructions, templateAttemptIds: runInput.templateAttemptIds } });
        if (assessed.length === 1) { markFirstAssessmentStarted(); await firstAssessmentGate; }
        run!.students.find(student => student.attemptId === attemptId)!.status = "completed";
        run!.completed++;
      } else if (route.request().method() === "PATCH" && route.request().postDataJSON().action === "finish") run!.status = "completed";
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ run }) });
    });

    await page.goto(`/courses/${courseId}/gradebook/activities/${activityId}`);
    await page.getByRole("button", { name: "AI-assess all submissions", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Prepare batch AI grading" });
    const instructions = dialog.getByRole("textbox", { name: "AI instructions", exact: true });
    await expect(instructions).toHaveValue("Apply the reviewed examples consistently.");
    await expect(dialog.getByRole("checkbox", { name: "Update AI instructions in the activity settings", exact: true })).toBeChecked();

    for (const template of templates.slice(0, 3)) {
      await dialog.getByLabel(`${template.participantName} · Attempt ${template.attemptNumber}`).check();
    }
    await expect(dialog.getByText("3 of 3 selected", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel(`${templates[3].participantName} · Attempt ${templates[3].attemptNumber}`)).toBeDisabled();
    await instructions.fill("Use the three reviewed examples and explain every criterion.");
    await dialog.getByRole("button", { name: "Start AI grading", exact: true }).click();

    await firstAssessmentStarted;
    const progress = page.getByRole("dialog", { name: "Assessing submissions" });
    await expect(progress).toBeVisible();
    await expect(progress).toContainText(`0 of ${selectedAttempts.length - selectedTemplateIds.length}`);
    releaseFirstAssessment();

    await expect.poll(() => assessed.length, { timeout: 30_000 }).toBe(selectedAttempts.length - selectedTemplateIds.length);
    await expect(progress).toBeHidden();
    expect(instructionUpdates).toHaveLength(1);
    expect(instructionUpdates[0]).toMatchObject({
      instructions: "Use the three reviewed examples and explain every criterion."
    });
    expect(assessed.map((request) => request.attemptId)).toContain(instructionUpdates[0]?.attemptId);
    expect(assessed.map((request) => request.attemptId)).not.toEqual(expect.arrayContaining(selectedTemplateIds));
    for (const request of assessed) {
      expect(request.body).toMatchObject({
        triggerKind: "teacher_batch",
        instructions: "Use the three reviewed examples and explain every criterion.",
        templateAttemptIds: selectedTemplateIds
      });
    }
  });
});
