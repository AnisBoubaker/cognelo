import { prisma } from "@cognelo/db";
import type { Page } from "@playwright/test";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import {
  provisionActivitySuite,
  removeActivitySuite,
  responseJson,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

test.describe("AI-assisted activity variations", () => {
  let data: ActivitySuiteData | undefined;
  let sourceActivityId = "";
  let sourceTitle = "";
  let testActivityId = "";
  let testTitle = "";

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
    sourceTitle = `E2E variation source ${data.token}`;
    testTitle = `E2E variation Test ${data.token}`;
    const api = await createAuthenticatedApi("teacher");
    try {
      const { activity } = await responseJson<{ activity: { id: string } }>(
        await api.post(`/api/activity-banks/${data.activityBankId}/activities`, {
          data: {
            activityTypeKey: "mcq",
            title: sourceTitle,
            description: "A published reusable source for deterministic variation UI coverage.",
            lifecycle: "published",
            config: {
              source: "## Source\nWhich number is even?\n\n- [x] 4\n- [ ] 5",
              aiGenerationInstructions: "",
              aiQuestionCount: 1,
              defaultCodeLanguage: "none",
              randomizeChoices: false,
              aiFeedbackEnabled: false,
              aiFeedbackInstructions: ""
            },
            metadata: {},
            position: 0
          }
        })
      );
      sourceActivityId = activity.id;
      const source = await prisma.bankActivity.findUniqueOrThrow({ where: { id: sourceActivityId } });
      if (!source.currentVersionId) throw new Error("The variation source did not publish a version.");

      const { test: bankTest } = await responseJson<{ test: { activity: { id: string } } }>(
        await api.post(`/api/activity-banks/${data.activityBankId}/tests`, {
          data: { title: testTitle, description: "Two independently varied activities.", lifecycle: "draft", settings: {} }
        })
      );
      testActivityId = bankTest.activity.id;
      for (let index = 0; index < 2; index += 1) {
        await responseJson(await api.post(
          `/api/activity-banks/${data.activityBankId}/activities/${testActivityId}/test/items`,
          {
            data: {
              source: "bank",
              bankActivityId: sourceActivityId,
              activityVersionId: source.currentVersionId,
              pointsPossible: 5,
              isRequired: true,
              position: index,
              metadata: {}
            }
          }
        ));
      }
      await responseJson(await api.patch(
        `/api/activity-banks/${data.activityBankId}/activities/${testActivityId}/test`,
        { data: { lifecycle: "published" } }
      ));
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("collects optional instructions and reports real progress and the final activity name", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The variation fixture was not provisioned.");
    await runMockedVariation(page, {
      activityBankId: data.activityBankId,
      activityId: sourceActivityId,
      sourceTitle,
      resultTitle: `E2E generated activity ${data.token}`,
      instructions: "Keep the same difficulty but use a different mathematical relationship.",
      total: 1
    });
    await runMockedVariation(page, {
      activityBankId: data.activityBankId,
      activityId: testActivityId,
      sourceTitle: testTitle,
      resultTitle: `E2E generated Test ${data.token}`,
      instructions: "Vary every child while preserving the assessment structure.",
      total: 2
    });
  });
});

async function runMockedVariation(page: Page, input: {
  activityBankId: string;
  activityId: string;
  sourceTitle: string;
  resultTitle: string;
  instructions: string;
  total: number;
}) {
  const endpoint = `**/api/activity-banks/${input.activityBankId}/activities/${input.activityId}/variation*`;
  const requestBodies: Record<string, unknown>[] = [];
  let pollCount = 0;
  let releaseCompletion = () => undefined;
  const completionGate = new Promise<void>((resolve) => {
    releaseCompletion = resolve;
  });
  await page.route(endpoint, async (route) => {
    const now = new Date().toISOString();
    if (route.request().method() === "POST") {
      requestBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          job: {
            id: `job-${input.activityId}`,
            status: "queued",
            progress: { completed: 0, fraction: 0, stage: "queued", step: "content", total: input.total },
            result: null,
            error: null,
            createdAt: now,
            updatedAt: now
          }
        })
      });
      return;
    }
    pollCount += 1;
    const succeeded = pollCount >= 2;
    if (succeeded) await completionGate;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        job: {
          id: `job-${input.activityId}`,
          status: succeeded ? "succeeded" : "running",
          progress: succeeded
            ? { completed: input.total, fraction: 0, stage: "complete", step: "saving", total: input.total }
            : {
                completed: input.total === 1 ? 0 : 1,
                currentActivityTitle: input.sourceTitle,
                fraction: input.total === 1 ? 0.58 : 0,
                stage: "generating",
                step: "tests",
                total: input.total
              },
          result: succeeded ? { activityId: `generated-${input.activityId}`, title: input.resultTitle } : null,
          error: null,
          createdAt: now,
          updatedAt: now
        }
      })
    });
  });

  await page.goto(`/activity-banks/${input.activityBankId}`);
  await page.getByRole("button", { name: `Actions for ${input.sourceTitle}` }).click();
  await page.getByRole("menuitem", { name: "Create variation", exact: true }).click();
  const authoring = page.getByRole("dialog", { name: "Create an activity variation" });
  await authoring.getByLabel("Optional AI instructions").fill(input.instructions);
  await authoring.getByRole("button", { name: "Create variation", exact: true }).click();

  const progress = page.getByRole("dialog", { name: "Create an activity variation" });
  await expect(progress).toBeVisible();
  await expect(progress).toContainText(input.total === 1 ? "0 of 1 activities" : "1 of 2 activities");
  await expect(progress).toContainText(input.total === 1 ? "58%" : "50%");
  releaseCompletion();
  await expect(progress).toContainText(`The new exercise is "${input.resultTitle}".`);
  await expect(progress.getByRole("progressbar", { name: "Activity variation progress" })).toHaveAttribute("value", "100");
  expect(requestBodies).toEqual([{
    title: `${input.sourceTitle} (variation)`,
    instructions: input.instructions,
    locale: "en"
  }]);
  await progress.getByRole("button", { name: "Close", exact: true }).click();
  await page.unroute(endpoint);
}
