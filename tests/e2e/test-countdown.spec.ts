import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import {
  assignCourseTest,
  openStudentActivity,
  provisionActivitySuite,
  removeActivitySuite,
  responseJson,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

test.describe.serial("timed Test countdown", () => {
  let data: ActivitySuiteData | undefined;
  let testActivityId = "";
  let testTitle = "";

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
    testTitle = `E2E timed Test ${data.token}`;
    const api = await createAuthenticatedApi("teacher");
    try {
      const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(
        await api.post(`/api/courses/${data.courseId}/tests`, {
          data: {
            title: testTitle,
            description: "A disposable timed Test for countdown coverage.",
            lifecycle: "published",
            settings: {
              timeLimitMinutes: 30,
              navigationMode: "free",
              randomizeItems: false,
              allowResume: true
            },
            contentPlacement: {
              parentId: null,
              titleSnapshot: testTitle,
              isVisible: true,
              position: 0,
              metadata: { e2e: true }
            }
          }
        })
      );
      testActivityId = created.activity.id;
      await responseJson(
        await api.post(`/api/courses/${data.courseId}/activities/${testActivityId}/test/items`, {
          data: {
            source: "local",
            activityTypeKey: "mcq",
            title: "Timed addition check",
            description: "Choose the correct value.",
            lifecycle: "published",
            config: {
              source: "## Addition\nWhat is two plus two?\n\n- [x] Four\n- [ ] Five",
              aiGenerationInstructions: "",
              aiQuestionCount: 5,
              defaultCodeLanguage: "none",
              randomizeChoices: false,
              aiFeedbackEnabled: false,
              aiFeedbackInstructions: ""
            },
            pointsPossible: 10,
            isRequired: true
          }
        })
      );
      await assignCourseTest(data, testActivityId, testTitle);
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("stays visible while scrolling, changes urgency, and submits at zero", async ({ studentPage }) => {
    test.setTimeout(60_000);
    if (!data) throw new Error("The timed Test fixture was not provisioned.");

    await studentPage.setViewportSize({ width: 1280, height: 420 });
    await studentPage.clock.install({ time: new Date() });
    await openStudentActivity(studentPage, data, testTitle);
    await studentPage.route(
      `**/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${testActivityId}/test`,
      async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        const response = await route.fetch();
        const body = await response.json() as {
          runtime: {
            timing: {
              expiresAt: string | null;
              remainingSeconds: number | null;
            };
          };
        };
        body.runtime.timing.expiresAt = new Date(Date.now() + 390_000).toISOString();
        body.runtime.timing.remainingSeconds = 390;
        await route.fulfill({ response, json: body });
      }
    );

    await studentPage.getByRole("button", { name: "Start Test" }).click();
    await studentPage.getByRole("dialog", { name: "Start this Test now?" })
      .getByRole("button", { name: "Start Test" })
      .click();

    const timer = studentPage.getByRole("timer");
    const accountSelector = studentPage.getByRole("button", { name: "Open account menu" });
    await expect(timer).toBeVisible();
    await expect(timer).toHaveClass(/test-countdown--normal/);
    expect(await timer.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(13, 27, 71)");
    expect(await timer.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(255, 255, 255)");
    expect(await timer.evaluate((element) => getComputedStyle(element).borderRadius)).toBe("999px");

    const timerBeforeScroll = await timer.boundingBox();
    const accountBounds = await accountSelector.boundingBox();
    if (!timerBeforeScroll || !accountBounds) throw new Error("The Test timer or account selector was not laid out.");
    expect(Math.abs(
      timerBeforeScroll.x + timerBeforeScroll.width - accountBounds.x - accountBounds.width
    )).toBeLessThanOrEqual(2);
    expect(timerBeforeScroll.y).toBeGreaterThan(accountBounds.y + accountBounds.height);
    await studentPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => studentPage.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const timerAfterScroll = await timer.boundingBox();
    if (!timerAfterScroll) throw new Error("The Test timer disappeared while scrolling.");
    expect(Math.abs(timerAfterScroll.y - timerBeforeScroll.y)).toBeLessThanOrEqual(1);

    await studentPage.evaluate(() => window.scrollTo(0, 0));
    await accountSelector.click();
    await expect(timer).toBeHidden();
    await accountSelector.click();
    await expect(timer).toBeVisible();

    await studentPage.getByLabel("Four", { exact: true }).check();
    await studentPage.clock.fastForward(250_000);
    await expect(timer).toHaveClass(/test-countdown--warning/);
    await timer.evaluate((element) => element.getAnimations().forEach((animation) => animation.finish()));
    expect(await timer.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(154, 75, 0)");
    await studentPage.clock.fastForward(81_000);
    await expect(timer).toHaveClass(/test-countdown--critical/);
    await timer.evaluate((element) => element.getAnimations().forEach((animation) => animation.finish()));
    expect(await timer.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(153, 27, 27)");
    await studentPage.clock.fastForward(60_000);

    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    const testRow = studentPage
      .getByText(testTitle, { exact: true })
      .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' table-main ')][1]");
    await expect(testRow.getByText("Submitted", { exact: true })).toBeVisible();
  });
});
