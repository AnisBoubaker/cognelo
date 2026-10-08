import { readFile } from "node:fs/promises";
import { prisma } from "@cognelo/db";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";

test.describe.serial("teacher Student view", () => {
  let data: ActivitySuiteData | undefined;
  let activityId = "";
  let parsonsActivityId = "";
  let title = "";
  let parsonsTitle = "";

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
    parsonsTitle = `E2E Student view Parsons ${data.token}`;
    parsonsActivityId = await createCourseActivity(data, {
      activityTypeKey: "parsons-problem",
      description: "Rebuild the demonstration program without recording a learner attempt.",
      title: parsonsTitle,
      config: {
        groups: [],
        language: "python",
        precedenceRules: [],
        prompt: "Put the two output statements in order.",
        solution: "print('first')\nprint('second')",
        stripIndentation: false
      }
    });
    const api = await createAuthenticatedApi("teacher");
    try {
      for (const [position, activity] of [
        { id: activityId, title },
        { id: parsonsActivityId, title: parsonsTitle }
      ].entries()) {
        await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, {
          data: {
            activityId: activity.id,
            availableFrom: null,
            availableUntil: null,
            config: {},
            contentPlacement: { isVisible: true, metadata: { e2e: true }, parentId: null, position, titleSnapshot: activity.title },
            metadata: { assessmentMode: "formative" },
            position
          }
        }));
      }
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => removeActivitySuite(data));

  test("opens the selected group in a new window and evaluates without academic persistence", async ({ teacherPage }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    let workspaceRequestCount = 0;
    teacherPage.context().on("request", (request) => {
      if (request.url().endsWith(`/api/courses/${data?.courseId}/groups/${data?.groupId}/student-preview`)) {
        workspaceRequestCount += 1;
      }
    });
    await teacherPage.goto(`/courses/${data.courseId}?tab=content&view=group&groupId=${data.groupId}`);
    const openStudentView = teacherPage.getByRole("link", { name: "Student view", exact: true });
    await expect(openStudentView).toBeVisible();
    const [preview] = await Promise.all([teacherPage.waitForEvent("popup"), openStudentView.click()]);

    await expect(preview.getByText(`Student view — ${data.groupTitle}`, { exact: true })).toBeVisible();
    await expect(preview.getByText("Work completed here is temporary and is not saved to any student record.", { exact: true })).toBeVisible();
    await expect(preview.getByRole("tab", { name: "Grades", exact: true })).toHaveCount(0);
    const settledWorkspaceRequestCount = workspaceRequestCount;
    await teacherPage.bringToFront();
    await preview.bringToFront();
    await preview.waitForTimeout(1_000);
    expect(workspaceRequestCount).toBe(settledWorkspaceRequestCount);
    await preview.getByRole("link", { name: title, exact: true }).click();
    await expect(preview.getByRole("heading", { name: title, exact: true }).first()).toBeVisible();
    const settledActivityWorkspaceRequestCount = workspaceRequestCount;
    await teacherPage.bringToFront();
    await preview.bringToFront();
    await preview.waitForTimeout(1_000);
    expect(workspaceRequestCount).toBe(settledActivityWorkspaceRequestCount);

    const before = await academicRecordCounts(data.courseId, data.groupId, activityId);
    await preview.getByLabel("No", { exact: true }).check();
    await preview.getByRole("button", { name: "Check answers", exact: true }).click();
    await expect(preview.getByText("+1", { exact: true })).toBeVisible();
    expect(await academicRecordCounts(data.courseId, data.groupId, activityId)).toEqual(before);

    await preview.getByRole("button", { name: "Reset preview", exact: true }).click();
    await expect(preview.getByLabel("No", { exact: true })).not.toBeChecked();
  });

  test("runs a Parsons problem without a partial-registry startup failure", async ({ teacherPage }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const before = await academicRecordCounts(data.courseId, data.groupId, parsonsActivityId);
    await teacherPage.goto(`/courses/${data.courseId}/groups/${data.groupId}/student-view`);
    await teacherPage.getByRole("link", { name: parsonsTitle, exact: true }).click();
    await expect(teacherPage.getByRole("heading", { name: "Rebuild the solution", exact: true })).toBeVisible();
    await teacherPage.getByRole("button", { name: "Check answer", exact: true }).click();
    await expect(teacherPage.getByText(/correct|misplaced/i).first()).toBeVisible();

    const api = await createAuthenticatedApi("teacher");
    try {
      const response = await api.post(
        `/api/courses/${data.courseId}/groups/${data.groupId}/student-preview/activities/${parsonsActivityId}/actions/evaluate`,
        { data: {} }
      );
      expect(response.ok(), await response.text()).toBe(true);
    } finally {
      await api.dispose();
    }
    expect(await academicRecordCounts(data.courseId, data.groupId, parsonsActivityId)).toEqual(before);
  });

  test("shows the learner content presentation and downloads course files", async ({ teacherPage }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The activity suite was not provisioned.");
    const fileTitle = `E2E Student view handout ${data.token}`;
    const fileContents = `Student view file ${data.token}\n`;

    await teacherPage.goto(`/courses/${data.courseId}?tab=content`);
    await teacherPage.getByRole("button", { name: "Content tree actions" }).click();
    await teacherPage.getByRole("menuitem", { name: "New activity", exact: true }).click();
    const picker = teacherPage.getByRole("dialog", { name: "Choose course element" });
    await picker.getByRole("tab", { name: "Material", exact: true }).click();
    await picker.getByRole("button", { name: /^File(?:\s|$)/ }).click();
    const settings = teacherPage.getByRole("dialog").filter({ has: teacherPage.getByRole("button", { name: "Save material" }) });
    await settings.getByLabel("Title", { exact: true }).fill(fileTitle);
    await settings.getByLabel("File", { exact: true }).setInputFiles({
      name: `student-view-${data.token}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(fileContents)
    });
    await settings.getByRole("button", { name: "Save material" }).click();
    await expect(settings).toBeHidden();

    await teacherPage.goto(`/courses/${data.courseId}?tab=content&view=group&groupId=${data.groupId}`);
    const [preview] = await Promise.all([
      teacherPage.waitForEvent("popup"),
      teacherPage.getByRole("link", { name: "Student view", exact: true }).click()
    ]);
    await expect(preview.getByRole("heading", { name: `${data.courseTitle}: ${data.groupTitle}`, exact: true })).toBeVisible();
    const downloadPromise = preview.waitForEvent("download");
    await preview.getByRole("link", { name: fileTitle, exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`student-view-${data.token}.txt`);
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("The Student view file download did not expose a local path.");
    expect(await readFile(downloadPath, "utf8")).toBe(fileContents);
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
