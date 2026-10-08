import { prisma } from "@cognelo/db";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";

test.describe.serial("teacher Student view", () => {
  let data: ActivitySuiteData | undefined;
  let activityId = "";
  let title = "";

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
    title = `E2E Student view MCQ ${data.token}`;
    activityId = await createCourseActivity(data, {
      activityTypeKey: "mcq",
      description: "Answer as the class while demonstrating the activity.",
      title,
      config: {
        aiGenerationInstructions: "",
        aiQuestionCount: 1,
        defaultCodeLanguage: "none",
        randomizeChoices: false,
        source: "## Preview safety\nDoes Student view create a learner attempt?\n\n- [ ] Yes\n- [x] No"
      }
    });
    const api = await createAuthenticatedApi("teacher");
    try {
      await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, {
        data: {
          activityId,
          availableFrom: null,
          availableUntil: null,
          config: {},
          contentPlacement: { isVisible: true, metadata: { e2e: true }, parentId: null, position: 0, titleSnapshot: title },
          metadata: { assessmentMode: "formative" },
          position: 0
        }
      }));
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => removeActivitySuite(data));

  test("opens the selected group in a new window and evaluates without academic persistence", async ({ teacherPage }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await teacherPage.goto(`/courses/${data.courseId}?tab=content&view=group&groupId=${data.groupId}`);
    const openStudentView = teacherPage.getByRole("link", { name: "Student view", exact: true });
    await expect(openStudentView).toBeVisible();
    const [preview] = await Promise.all([teacherPage.waitForEvent("popup"), openStudentView.click()]);

    await expect(preview.getByText(`Student view — ${data.groupTitle}`, { exact: true })).toBeVisible();
    await expect(preview.getByText("Work completed here is temporary and is not saved to any student record.", { exact: true })).toBeVisible();
    await expect(preview.getByRole("tab", { name: "Grades", exact: true })).toHaveCount(0);
    await preview.getByRole("link", { name: title, exact: true }).click();
    await expect(preview.getByRole("heading", { name: title, exact: true }).first()).toBeVisible();

    const before = await academicRecordCounts(data.courseId, data.groupId, activityId);
    await preview.getByLabel("No", { exact: true }).check();
    await preview.getByRole("button", { name: "Check answers", exact: true }).click();
    await expect(preview.getByText("+1", { exact: true })).toBeVisible();
    expect(await academicRecordCounts(data.courseId, data.groupId, activityId)).toEqual(before);

    await preview.getByRole("button", { name: "Reset preview", exact: true }).click();
    await expect(preview.getByLabel("No", { exact: true })).not.toBeChecked();
  });
});

async function academicRecordCounts(courseId: string, groupId: string, activityId: string) {
  const [attempts, drafts, grades] = await Promise.all([
    prisma.activityAttempt.count({ where: { courseId, groupId, activityId } }),
    prisma.activityResponseDraft.count({ where: { groupActivity: { groupId, activityId } } }),
    prisma.grade.count({ where: { gradebookItem: { courseId, groupId, activityId } } })
  ]);
  return { attempts, drafts, grades };
}
