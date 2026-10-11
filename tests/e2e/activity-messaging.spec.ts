import { expect, test } from "./fixtures/auth";
import { prisma } from "@cognelo/db";
import { provisionLearningFlow, removeLearningFlow, type LearningFlowData } from "./fixtures/learning-flow";

test.describe("attempt-scoped activity messaging", () => {
  let data: LearningFlowData | undefined;

  test.beforeAll(async () => {
    data = await provisionLearningFlow();
    await prisma.courseGroupActivity.updateMany({
      where: { activityId: data.activityId, groupId: data.groupId },
      data: {
        metadata: {
          assessmentMode: "summative",
          timeLimitMinutes: 30
        }
      }
    });
  });

  test.afterAll(async () => {
    await removeLearningFlow(data);
  });

  test("broadcasts to the active attempt, records reads, and starts the next attempt empty", async ({
    studentPage,
    teacherPage
  }) => {
    test.setTimeout(60_000);
    if (!data) throw new Error("Activity-messaging data was not provisioned.");

    await studentPage.goto(
      `/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`
    );
    await expect(studentPage.getByRole("heading", { name: data.activityTitle })).toBeVisible();
    await studentPage.getByRole("button", { name: "Start timed attempt" }).click();
    const liveControls = studentPage.locator("#activity-live-controls");
    await expect(liveControls.getByRole("timer")).toBeVisible();
    await expect(studentPage.getByRole("button", { name: "Open activity messages" })).toBeVisible();
    await expect(liveControls.getByRole("button", { name: "Open activity messages" })).toBeVisible();

    await teacherPage.goto(
      `/courses/${data.courseId}/gradebook/activities/${data.activityId}?groupId=${data.groupId}`
    );
    await teacherPage.getByRole("button", { name: "Message students" }).click();
    const teacherDialog = teacherPage.getByRole("dialog", { name: "Broadcast a message" });
    await expect(teacherDialog.getByText("1 active learner attempt(s)")).toBeVisible();
    await teacherDialog.getByLabel("Message", { exact: true }).fill("Please reread question 2 before submitting.");
    await teacherDialog.getByRole("button", { name: "Send broadcast" }).click();
    await expect(teacherDialog.getByText("Please reread question 2 before submitting.")).toBeVisible();

    const unreadTrigger = studentPage.getByRole("button", { name: "Open activity messages (1 unread)" });
    await expect(unreadTrigger).toBeVisible({ timeout: 15_000 });
    await expect(unreadTrigger.locator(".activity-messenger-unread-dot")).toBeVisible();
    await unreadTrigger.click();
    const learnerDialog = studentPage.getByRole("dialog", { name: "Activity messages" });
    await expect(learnerDialog.getByText("Attempt 1", { exact: true })).toBeVisible();
    await expect(learnerDialog.getByText("Please reread question 2 before submitting.")).toBeVisible();
    await expect(teacherDialog.getByText("Delivered to 1 · Read by 1")).toBeVisible({ timeout: 15_000 });

    await learnerDialog.getByRole("button", { name: "Close" }).click();
    await studentPage.getByLabel("Four", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Submit answers?" })
      .getByRole("button", { name: "Submit answers" })
      .click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));

    await studentPage.getByRole("link", { name: data.activityTitle, exact: true }).click();
    await studentPage.getByRole("button", { name: "Start timed attempt" }).click();
    await studentPage.getByRole("button", { name: "Open activity messages" }).click();
    const nextAttemptDialog = studentPage.getByRole("dialog", { name: "Activity messages" });
    await expect(nextAttemptDialog.getByText("Attempt 2", { exact: true })).toBeVisible();
    await expect(nextAttemptDialog.getByText("No messages have been sent for this attempt yet.")).toBeVisible();
    await expect(nextAttemptDialog.getByText("Please reread question 2 before submitting.")).toHaveCount(0);
  });
});
