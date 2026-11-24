import { prisma } from "@cognelo/db";
import { expect, test, createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";

test("an untouched blank question submitted inside a Test receives zero without running the private reference", async ({ studentPage: page }) => {
  test.setTimeout(120_000);
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi("teacher"), student = await createAuthenticatedApi("student");
  try {
    const title = `Unanswered blanks ${data.token}`, blankTemplate = "print({{ BLANK:value }})", secret = "9373819";
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacher.post(`/api/courses/${data.courseId}/tests`, {
      data: { title, lifecycle: "published", settings: { allowResume: true }, contentPlacement: { isVisible: true } }
    }));
    const activityId = created.activity.id;
    const { item } = await responseJson<{ item: { id: string; activityId: string } }>(await teacher.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
      source: "local", activityTypeKey: "coding-exercise", title: "Empty answer", pointsPossible: 10,
      config: { language: "python", prompt: "Complete the print expression.", responseMode: "blanks", blankTemplate, sampleTests: [] }
    } }));
    await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`, { data: {
      tests: [{ id: "hidden", name: "Private output", stdin: "", expectedOutput: secret, isEnabled: true, weight: 1 }],
      referenceSolution: `print(${secret})`, privateConfig: { templateSource: "{{ STUDENT_CODE }}", blankReferenceAnswers: { value: secret } }
    } }));
    await assignCourseTest(data, activityId, title);
    const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    expect(JSON.stringify(await responseJson(await student.get(assigned)))).not.toContain(secret);
    await page.goto(assigned.replace("/api", ""));
    await page.getByRole("button", { name: "Start Test", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Start Test", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Blank 1", exact: true })).toHaveValue("");
    await page.getByRole("button", { name: "Submit the test", exact: true }).click();
    await page.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${data.groupId}$`), { timeout: 60_000 });
    const parent = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId }, include: { testItemAttempts: true } });
    const child = parent.testItemAttempts.find(candidate => candidate.testItemId === item.id)!;
    expect(child.rawScore).toBe(0);
    expect(child.pluginAttemptRef).toBeTruthy();
    const [execution] = await prisma.$queryRaw<Array<{ sourceCode: string; judge0Token: string | null; judge0LanguageId: number; stdout: string | null; resultSummary: Record<string, unknown> }>>`
      SELECT "sourceCode", "judge0Token", "judge0LanguageId", stdout, "resultSummary" FROM "PluginCodingExerciseExecution" WHERE id=${child.pluginAttemptRef}`;
    expect(execution).toMatchObject({ sourceCode: "", judge0Token: null, judge0LanguageId: 0, stdout: null,
      resultSummary: { earnedWeight: 0, totalWeight: 1, blankGrading: { method: "empty", answered: 0, correct: 0 } } });
    expect(JSON.stringify(child.result)).not.toContain(secret);
    expect(await prisma.activityGradingReview.count({ where: { attemptId: parent.id, status: "required" } })).toBe(0);
  } finally { await teacher.dispose(); await student.dispose(); await removeActivitySuite(data); }
});
