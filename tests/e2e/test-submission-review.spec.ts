import { prisma } from "@cognelo/db";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { assignCourseTest, responseJson } from "./fixtures/activity-suite";

for (const navigationMode of ["free", "sequential"] as const) {
  test(`reviews answers before final submission with ${navigationMode} navigation`, { tag: "@regression" }, async ({ bankCourse: data, teacherApi, studentPage }) => {
    const title = `Submission review ${navigationMode} ${data.token}`;
    const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
      title, lifecycle: "published", settings: { timeLimitMinutes: 30, navigationMode, randomizeItems: false, allowResume: navigationMode === "free" },
      contentPlacement: { parentId: null, titleSnapshot: title, isVisible: true, position: 1, metadata: {} }
    } }));
    const activityId = created.activity.id;
    for (const name of ["First exercise", "Second exercise"]) {
      await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
        source: "local", activityTypeKey: "mcq", title: name, lifecycle: "published",
        config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 10, isRequired: true
      } }));
    }
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
      source: "local", activityTypeKey: "parsons-problem", title: "Arrange the program", lifecycle: "published",
      config: { language: "python", prompt: "Put the lines in order.", solution: "print('first')\nprint('second')", stripIndentation: false, groups: [], precedenceRules: [] }, pointsPossible: 10, isRequired: true
    } }));
    await assignCourseTest(data, activityId, title);
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`);
    await studentPage.getByRole("button", { name: "Start Test", exact: true }).click();
    await studentPage.getByRole("dialog").getByRole("button", { name: "Start Test", exact: true }).click();
    await expect(studentPage.getByRole("button", { name: "Submit the test", exact: true })).toHaveCount(0);
    // A wrong response is answered; correctness must not affect the review.
    await studentPage.getByLabel("Five", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Next activity", exact: true }).click();
    await expect(studentPage.getByRole("heading", { name: "Second exercise", exact: true })).toBeVisible();
    await expect(studentPage.getByRole("button", { name: "Submit the test", exact: true })).toHaveCount(0);
    await studentPage.getByRole("button", { name: "Next activity", exact: true }).click();
    await expect(studentPage.getByRole("heading", { name: "Arrange the program", exact: true })).toBeVisible();
    await expect(studentPage.getByRole("button", { name: "Next activity", exact: true })).toHaveCount(0);
    await studentPage.getByRole("button", { name: "Submit the test", exact: true }).click();
    const review = studentPage.getByRole("region", { name: "Review your answers" });
    await expect(review).toBeVisible();
    await expect(studentPage.getByRole("timer")).toBeVisible();
    await expect(review.getByText("1 of 3 exercises answered", { exact: true })).toBeVisible();
    await expect(review.getByRole("listitem").filter({ hasText: "First exercise" }).getByText("Answered", { exact: true })).toBeVisible();
    await expect(review.getByText("Not answered", { exact: true })).toHaveCount(2);
    await expect(review.getByText(/correct|incorrect|score|points/i)).toHaveCount(0);
    expect((await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } })).lifecycle).toBe("started");
    await review.getByRole("button", { name: "Submit for grading", exact: true }).click();
    const confirmation = studentPage.getByRole("dialog", { name: "Submit the entire Test?" });
    await expect(confirmation.getByText("This submission is final. You will not be able to modify your answers after submitting for grading.")).toBeVisible();
    await confirmation.getByRole("button", { name: "Keep working", exact: true }).click();
    await expect(review).toBeVisible();
    expect((await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } })).lifecycle).toBe("started");
    let releaseRestore!: () => void;
    const restoreGate = new Promise<void>((resolve) => { releaseRestore = resolve; });
    let delayRestore = true;
    await studentPage.route("**/test/items/**", async (route) => {
      if (route.request().method() === "GET" && delayRestore) {
        await restoreGate;
      }
      await route.continue();
    });
    try {
      await review.getByRole("button", { name: "Review Arrange the program", exact: true }).click();
      await expect(studentPage.getByRole("button", { name: "Move block down", exact: true }).first()).toBeDisabled();
    } finally {
      delayRestore = false;
      releaseRestore();
    }
    await studentPage.getByRole("button", { name: "Move block down", exact: true }).first().click();
    await studentPage.getByRole("button", { name: "Submit the test", exact: true }).click();
    await expect(review.getByRole("listitem").filter({ hasText: "Arrange the program" }).getByText("Answered", { exact: true })).toBeVisible();
    await review.getByRole("button", { name: "Back to answers", exact: true }).click();
    await studentPage.getByRole("button", { name: "Reset blocks", exact: true }).click();
    await studentPage.getByRole("button", { name: "Submit the test", exact: true }).click();
    await expect(review.getByRole("listitem").filter({ hasText: "Arrange the program" }).getByText("Not answered", { exact: true })).toBeVisible();
    await review.getByRole("button", { name: "Review Second exercise", exact: true }).click();
    await studentPage.getByLabel("Four", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Previous activity", exact: true }).click();
    await expect(studentPage.getByLabel("Five", { exact: true })).toBeChecked();
    await studentPage.getByRole("button", { name: "Next activity", exact: true }).click();
    await studentPage.getByRole("button", { name: "Next activity", exact: true }).click();
    await studentPage.getByRole("button", { name: "Submit the test", exact: true }).click();
    await expect(review.getByText("2 of 3 exercises answered", { exact: true })).toBeVisible();
    if (navigationMode === "free") {
      const dismiss = studentPage.getByRole("button", { name: "Dismiss notification" });
      if (await dismiss.isVisible()) await dismiss.click();
      await studentPage.screenshot({ path: "tmp/test-submission-review-desktop.png", fullPage: true });
      await studentPage.setViewportSize({ width: 390, height: 844 });
      await expect(review.getByRole("button", { name: "Submit for grading", exact: true })).toBeVisible();
      expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await studentPage.screenshot({ path: "tmp/test-submission-review-mobile.png", fullPage: true });
    }
    await review.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await confirmation.getByRole("button", { name: "Submit for grading", exact: true }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId }, include: { testItemAttempts: true } });
    expect(attempt.lifecycle).toBe("graded");
    expect(attempt.testItemAttempts).toHaveLength(3);
    expect(attempt.testItemAttempts.every((item) => item.lifecycle === "graded")).toBe(true);
    expect(attempt.testItemAttempts.some((item) => {
      const state = (item.result as { state?: { hasAnswer?: boolean } } | null)?.state;
      return state?.hasAnswer === false;
    })).toBe(true);
  });
}

test("teacher Student view reviews and restores temporary answers without creating an attempt", { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage }) => {
  const title = `Preview review ${data.token}`;
  const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
    title, lifecycle: "published", settings: { timeLimitMinutes: null, navigationMode: "free", randomizeItems: false, allowResume: true },
    contentPlacement: { parentId: null, titleSnapshot: title, isVisible: true, position: 1, metadata: {} }
  } }));
  const activityId = created.activity.id;
  await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
    source: "local", activityTypeKey: "mcq", title: "Preview addition", lifecycle: "published",
    config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 10, isRequired: true
  } }));
  await assignCourseTest(data, activityId, title);
  await teacherPage.goto(`/courses/${data.courseId}/groups/${data.groupId}/student-view/activities/${activityId}`);
  await teacherPage.getByRole("button", { name: "Start Test", exact: true }).click();
  await teacherPage.getByRole("dialog").getByRole("button", { name: "Start Test", exact: true }).click();
  await teacherPage.getByLabel("Five", { exact: true }).check();
  await teacherPage.getByRole("button", { name: "Submit the test", exact: true }).click();
  const review = teacherPage.getByRole("region", { name: "Review your answers" });
  await expect(review.getByText("1 of 1 exercises answered", { exact: true })).toBeVisible();
  await review.getByRole("button", { name: "Review Preview addition", exact: true }).click();
  await expect(teacherPage.getByLabel("Five", { exact: true })).toBeChecked();
  await teacherPage.getByRole("button", { name: "Submit the test", exact: true }).click();
  await review.getByRole("button", { name: "Submit for grading", exact: true }).click();
  await teacherPage.getByRole("dialog", { name: "Submit the entire Test?" }).getByRole("button", { name: "Submit for grading", exact: true }).click();
  await expect(teacherPage.getByText("Test submitted.", { exact: true })).toBeVisible();
  expect(await prisma.activityAttempt.count({ where: { activityId } })).toBe(0);
});
