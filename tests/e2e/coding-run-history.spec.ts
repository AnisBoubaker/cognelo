import { expect, test, createAuthenticatedApi } from "./fixtures/auth";
import { assignCourseTest, createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson } from "./fixtures/activity-suite";

for (const mode of ["standalone", "Test question"] as const) {
  test(`shows the latest programming run and reveals older runs in a ${mode}`, async ({ studentPage: page }, testInfo) => {
    test.setTimeout(120_000);
    const data = await provisionActivitySuite();
    const teacher = await createAuthenticatedApi("teacher");
    const config = { language: "python", prompt: "Echo the input.", starterCode: "print(input())", sampleTests: [] };
    const title = `Run history ${mode} ${data.token}`;
    try {
      let activityId: string;
      let codingActivityId: string;
      if (mode === "standalone") {
        activityId = await createCourseActivity(data, { activityTypeKey: "coding-exercise", title, config });
        codingActivityId = activityId;
      } else {
        const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacher.post(`/api/courses/${data.courseId}/tests`, {
          data: { title, lifecycle: "published", contentPlacement: { isVisible: true } }
        }));
        activityId = created.activity.id;
        const { item } = await responseJson<{ item: { activityId: string } }>(await teacher.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, {
          data: { source: "local", activityTypeKey: "coding-exercise", title: "Echo", config }
        }));
        codingActivityId = item.activityId;
      }
      await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${codingActivityId}/coding-exercises/hidden-tests`, {
        data: { tests: [], referenceSolution: "print(input())", privateConfig: { templateSource: "{{ STUDENT_CODE }}" } }
      }));
      await assignCourseTest(data, activityId, title);
      await page.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`);
      if (mode === "Test question") {
        await page.getByRole("button", { name: "Start Test", exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Start Test", exact: true }).click();
      }

      const history = page.locator(".coding-exercise-run-history");
      const run = page.getByRole("button", { name: "Run test", exact: true });
      const input = page.getByRole("textbox", { name: "Input (one value per line)", exact: true });
      await expect(run).toBeEnabled();
      await expect(history).toHaveCount(0);
      for (const value of ["First execution", "Second execution"]) {
        await input.fill(value);
        await run.click();
        await expect(page.getByLabel("Test output", { exact: true })).toContainText(value, { timeout: 60_000 });
        await expect(history.locator("section")).toHaveCount(1);
        await expect(history.getByText(value, { exact: true }).first()).toBeVisible();
        if (value === "First execution") await expect(history.getByRole("button")).toHaveCount(0);
      }
      await expect(history.getByText("First execution", { exact: true })).toHaveCount(0);

      for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        const reveal = history.getByRole("button", { name: "Show all previous runs (1)", exact: true });
        await expect(reveal).toHaveAttribute("aria-expanded", "false");
        const latestBounds = await history.locator("section").first().boundingBox();
        const revealBounds = await reveal.boundingBox();
        expect(revealBounds!.y).toBeGreaterThanOrEqual(latestBounds!.y + latestBounds!.height);
        await reveal.focus();
        await page.keyboard.press("Enter");
        await expect(history.locator("section")).toHaveCount(2);
        await expect(history.getByText("First execution", { exact: true }).first()).toBeVisible();
        await history.screenshot({ path: testInfo.outputPath(`history-${viewport.name}.png`) });
        await history.getByRole("button", { name: "Hide previous runs", exact: true }).click();
        await expect(history.locator("section")).toHaveCount(1);
      }

      await history.getByRole("button", { name: "Show all previous runs (1)", exact: true }).click();
      await input.fill("Newest execution");
      await run.click();
      await expect(page.getByLabel("Test output", { exact: true })).toContainText("Newest execution", { timeout: 60_000 });
      await expect(history.locator("section")).toHaveCount(1);
      await expect(history.getByRole("button", { name: "Show all previous runs (2)", exact: true })).toHaveAttribute("aria-expanded", "false");
      if (mode === "standalone") {
        await page.reload();
        await expect(history.getByText("Newest execution", { exact: true }).first()).toBeVisible();
        await expect(history.locator("section")).toHaveCount(1);
      }
      await history.getByRole("button", { name: "Show all previous runs (2)", exact: true }).click();
      await expect(history.locator("section")).toHaveCount(3);
    } finally {
      await teacher.dispose();
      await removeActivitySuite(data);
    }
  });
}
