import { expect, test } from "./fixtures/bank-course";
import { createAuthenticatedApi } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import type { CodingExerciseReferenceSolution } from "../../apps/web/src/lib/api";

for (const scope of ["course", "bank"] as const) {
  test(`rubric guidance persists independently of generation and grading instructions (${scope})`, async ({
    bankCourse: data, teacherApi, teacherPage: page
  }, testInfo) => {
    test.setTimeout(120_000);
    const config = { language: "python", prompt: "Print the numbers from one to ten.", starterCode: "", sampleTests: [] };
    const title = `Rubric guidance ${scope}`;
    const activityId = scope === "course"
      ? await createCourseActivity(data, { activityTypeKey: "coding-exercise", title, config })
      : (await responseJson<{ activity: { id: string } }>(await teacherApi.post(`/api/activity-banks/${data.activityBankId}/activities`, {
        data: { activityTypeKey: "coding-exercise", title, config }
      }))).activity.id;
    const path = scope === "course" ? `/api/courses/${data.courseId}/activities/${activityId}` : `/api/activity-banks/${data.activityBankId}/activities/${activityId}`;
    const guidancePath = `${path}/coding-exercises/rubric-guidance`;
    const referencePath = `${path}/coding-exercises/hidden-tests`;
    const referenceSolution = "for n in range(1, 11): print(n)";
    const gradingInstructions = "Give feedback using this existing grading instruction.";
    const originalCriteria = scope === "bank" ? [] : [{ id: "original", title: "Original criterion", description: "Existing rubric", weightPercent: 100 }];
    const initialConfirmLabel = originalCriteria.length ? "Replace rubric" : "Generate rubric automatically";
    await responseJson(await teacherApi.put(referencePath, { data: {
      tests: [], sampleTests: [], referenceSolution,
      privateConfig: { templateSource: "{{ STUDENT_CODE }}", aiFeedback: { instructions: gradingInstructions, criteria: originalCriteria } }
    } }));
    const readReference = async () => (await responseJson<{ referenceSolution: CodingExerciseReferenceSolution }>(await teacherApi.get(referencePath))).referenceSolution;
    await page.route("**/api/ai-agents", (route) => route.fulfill({ json: {
      connections: [{ id: "rubric-generation-test", isEnabled: true }],
      preferences: { questionAuthoringAiAgentConnectionId: "rubric-generation-test" }
    } }));
    const requests: Array<{ guidance: string }> = [];
    let generationFails = true;
    await page.route(`**${path}/coding-exercises/generate-rubric`, (route) => {
      requests.push(route.request().postDataJSON());
      return generationFails
        ? route.fulfill({ status: 503, json: { error: { code: "GENERATION_UNAVAILABLE", message: "Test generation is unavailable." } } })
        : route.fulfill({ json: { attempts: 1, criteria: [{ id: "generated", title: "Generated criterion", description: "Evaluate the requested reasoning.", weightPercent: 100 }] } });
    });
    async function openGeneration() {
      await page.getByRole("tab", { name: "Grading", exact: true }).click();
      await page.getByRole("button", { name: "Generate rubric automatically", exact: true }).click();
    }
    const dialog = page.getByRole("dialog", { name: "Generate rubric automatically", exact: true });
    const guidance = dialog.getByLabel("Guidance for the AI (optional)", { exact: true });
    await page.goto(path.replace("/api", ""));
    await openGeneration();
    await expect(guidance).toHaveValue("");
    if (originalCriteria.length) await expect(dialog).toContainText("replace all current rubric criteria");
    else await expect(dialog.getByText("Generating a rubric will replace all current rubric criteria.")).toHaveCount(0);
    await guidance.fill("Discard this guidance.");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await readReference()).privateConfig.rubricGenerationGuidance).toBeUndefined();
    expect(requests).toHaveLength(0);

    await openGeneration();
    await expect(guidance).toHaveValue("");
    const firstGuidance = "Focus on algorithmic reasoning; avoid style-only criteria.";
    await guidance.fill(firstGuidance);
    if (scope === "course") {
      await page.route(`**${guidancePath}`, (route) => route.fulfill({ status: 503, json: {
        error: { code: "SAVE_UNAVAILABLE", message: "Test guidance save failed." }
      } }));
      await dialog.getByRole("button", { name: initialConfirmLabel, exact: true }).click();
      await expect(page.getByText("Test guidance save failed.", { exact: true })).toBeVisible();
      await expect(guidance).toHaveValue(firstGuidance);
      expect(requests).toHaveLength(0);
      expect((await readReference()).privateConfig.rubricGenerationGuidance).toBeUndefined();
      await page.unroute(`**${guidancePath}`);
    }
    await page.screenshot({ path: testInfo.outputPath("rubric-guidance.png") });
    await dialog.getByRole("button", { name: initialConfirmLabel, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Test generation is unavailable.", { exact: true })).toBeVisible();
    expect(requests[0].guidance).toBe(firstGuidance);
    expect(await readReference()).toMatchObject({ sourceCode: referenceSolution, privateConfig: {
      rubricGenerationGuidance: firstGuidance, aiFeedback: { instructions: gradingInstructions, criteria: originalCriteria }
    } });

    await page.reload();
    await openGeneration();
    await expect(guidance).toHaveValue(firstGuidance);
    generationFails = false;
    const revisedGuidance = "Also consider edge cases and justify each criterion.";
    await guidance.fill(revisedGuidance);
    await dialog.getByRole("button", { name: initialConfirmLabel, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Rubric generated.", { exact: true })).toBeVisible();
    expect(requests[1].guidance).toBe(revisedGuidance);
    // Generation is still a draft: saving the preference must not replace the rubric.
    expect((await readReference()).privateConfig.aiFeedback.criteria).toEqual(originalCriteria);
    await page.getByRole("button", { name: "Save coding exercise", exact: true }).click();
    await expect(page.getByText("Coding exercise saved.", { exact: true })).toBeVisible();
    await page.reload();
    await openGeneration();
    await expect(guidance).toHaveValue(revisedGuidance);
    expect((await readReference()).privateConfig.aiFeedback).toMatchObject({ instructions: gradingInstructions, criteria: [expect.objectContaining({ title: "Generated criterion" })] });

    generationFails = true;
    await guidance.fill("");
    await dialog.getByRole("button", { name: "Replace rubric", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await readReference()).privateConfig.rubricGenerationGuidance).toBe("");
    await page.reload();
    await openGeneration();
    await expect(guidance).toHaveValue("");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    const student = await createAuthenticatedApi("student");
    try {
      expect((await student.put(guidancePath, { data: { guidance: "Not authorized" } })).status()).toBe(403);
      expect((await readReference()).privateConfig.rubricGenerationGuidance).toBe("");
    } finally { await student.dispose(); }
  });
}
