import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";
import type { CourseActivityAssignmentSettings } from "../../apps/web/src/lib/api";
import { provisionLearningFlow, removeLearningFlow, type LearningFlowData } from "./fixtures/learning-flow";

test.describe("attempt-scoped activity messaging", () => {
  let data: LearningFlowData | undefined;

  test.beforeAll(async () => {
    data = await provisionLearningFlow();
    const api = await createAuthenticatedApi("teacher");
    try {
      const path = `/api/courses/${data.courseId}/activities/${data.activityId}/assign-all-groups`;
      const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await api.get(path));
      await responseJson(await api.post(path, { data: { ...settings.general, assessmentMode: "summative", timeLimitMinutes: 30, messagingEnabled: true, groupAssignments: settings.groups } }));
    } finally { await api.dispose(); }
  });

  test.afterAll(async () => {
    await removeLearningFlow(data);
  });

  test("broadcasts to students, records reads, and retains messages across attempts", async ({
    studentPage,
    teacherPage
  }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("Activity-messaging data was not provisioned.");

    await studentPage.goto(
      `/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`
    );
    await expect(studentPage.getByRole("heading", { name: data.activityTitle })).toBeVisible();
    await studentPage.getByRole("button", { name: "Start timed attempt" }).click();
    const liveControls = studentPage.locator("#activity-live-controls");
    const timer = liveControls.getByRole("timer");
    const messenger = liveControls.getByRole("button", { name: "Open activity messages" });
    await expect(timer).toBeVisible();
    await expect(studentPage.getByRole("button", { name: "Open activity messages" })).toBeVisible({ timeout: 30_000 });
    await expect(messenger).toBeVisible();
    await expect(liveControls.locator(".activity-messenger-label")).toBeHidden();
    const [timerBox, messengerBox, liveControlStyles] = await Promise.all([
      timer.boundingBox(),
      messenger.boundingBox(),
      liveControls.evaluate((container) => {
        const timerElement = container.querySelector<HTMLElement>(".test-countdown");
        const messengerElement = container.querySelector<HTMLElement>(".activity-messenger-trigger");
        if (!timerElement || !messengerElement) return null;
        const timerStyle = getComputedStyle(timerElement);
        const messengerStyle = getComputedStyle(messengerElement);
        return {
          containerBackground: getComputedStyle(container).backgroundColor,
          timerRadius: timerStyle.borderTopRightRadius,
          timerZIndex: timerStyle.zIndex,
          messengerRadius: messengerStyle.borderTopLeftRadius
        };
      })
    ]);
    expect(timerBox).not.toBeNull();
    expect(messengerBox).not.toBeNull();
    expect((timerBox?.x ?? 0) + (timerBox?.width ?? 0)).toBeGreaterThan(messengerBox?.x ?? Number.MAX_SAFE_INTEGER);
    expect(liveControlStyles).toEqual({
      containerBackground: "rgb(46, 141, 225)",
      timerRadius: "999px",
      timerZIndex: "1",
      messengerRadius: "999px"
    });

    await teacherPage.goto(
      `/courses/${data.courseId}/gradebook/activities/${data.activityId}?groupId=${data.groupId}`
    );
    await teacherPage.getByRole("button", { name: "Message students" }).click();
    const teacherDialog = teacherPage.getByRole("dialog", { name: "Activity messages" });
    await expect(teacherDialog.getByText(/1 active learner attempt\(s\)/)).toBeVisible();
    await teacherDialog.getByLabel("Message", { exact: true }).fill("Please reread question 2 before submitting.");
    await teacherDialog.getByRole("button", { name: "Send broadcast" }).click();
    await expect(teacherDialog.getByText("Please reread question 2 before submitting.")).toBeVisible();

    const unreadTrigger = studentPage.getByRole("button", { name: "Open activity messages (1 unread)" });
    await expect(unreadTrigger).toBeVisible({ timeout: 30_000 });
    await expect(unreadTrigger.locator(".activity-messenger-unread-dot")).toBeVisible();
    await unreadTrigger.click();
    const learnerDialog = studentPage.getByRole("dialog", { name: "Activity messages" });
    await expect(learnerDialog.locator(".activity-chat-context").getByText("Attempt 1", { exact: true })).toBeVisible();
    await expect(learnerDialog.getByText("Please reread question 2 before submitting.")).toBeVisible();
    await expect(teacherDialog.getByText("Delivered to 1 · Read by 1")).toBeVisible({ timeout: 30_000 });

    await learnerDialog.getByRole("button", { name: "Close" }).click();
    await studentPage.getByLabel("Four", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Submit answers?" })
      .getByRole("button", { name: "Submit answers" })
      .click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));

    await studentPage.getByRole("link", { name: data.activityTitle, exact: true }).click();
    await studentPage.getByRole("button", { name: "Start timed attempt" }).click();
    await expect(studentPage.getByRole("button", { name: "Open activity messages" })).toBeVisible({ timeout: 30_000 });
    await studentPage.getByRole("button", { name: "Open activity messages" }).click();
    const nextAttemptDialog = studentPage.getByRole("dialog", { name: "Activity messages" });
    await expect(nextAttemptDialog.locator(".activity-chat-context").getByText("Attempt 2", { exact: true })).toBeVisible();
    await expect(nextAttemptDialog.getByText("Please reread question 2 before submitting.")).toBeVisible();
  });
});
