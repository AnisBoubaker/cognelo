import { expect, test } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";

for (const expired of [false, true]) {
  test(`assigned programming link opens reports before the complete teacher editor (${expired ? "expired" : "active"})`, async ({
    bankCourse: data, teacherApi, teacherPage: page, studentPage
  }, testInfo) => {
    const title = `Tabbed programming editor ${data.token}`;
    const conceptTitle = `Loops ${data.token}`;
    await responseJson(await teacherApi.post(`/api/subjects/${data.subjectId}/concepts`, {
      data: { title: conceptTitle, skills: "Write a loop" }
    }));
    const activityId = await createCourseActivity(data, {
      activityTypeKey: "coding-exercise", title,
      config: { prompt: "Print the numbers from one to ten.", language: "python", starterCode: "# Write your loop here", sampleTests: [] }
    });
    await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, {
      data: {
        activityId, metadata: { assessmentMode: "formative" },
        availableUntil: expired ? new Date(Date.now() - 60_000).toISOString() : null,
        contentPlacement: { isVisible: true, parentId: null }
      }
    }));
    const assignedPath = `/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
    const editorPath = `/courses/${data.courseId}/activities/${activityId}?returnTo=report&origin=content&report=overview&groupId=${data.groupId}`;
    const reportPath = `/courses/${data.courseId}/gradebook/activities/${activityId}?origin=content&report=overview&groupId=${data.groupId}`;

    await page.goto(assignedPath);
    await expect(page).toHaveURL(reportPath);
    await expect(page.getByRole("tab", { name: "Class overview", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Student results", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit activity", exact: true })).toHaveClass(/secondary/);
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Edit activity", exact: true }).click();
    await expect(page).toHaveURL(editorPath);
    await page.reload();
    await expect(page.getByRole("link", { name: "Back to activity overview", exact: true })).toHaveAttribute("href", reportPath);
    await page.getByRole("link", { name: "Back to activity overview", exact: true }).click();
    await expect(page).toHaveURL(reportPath);
    await expect(page.getByRole("tab", { name: "Class overview", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("link", { name: "Edit activity", exact: true }).click();
    await expect(page).toHaveURL(editorPath);
    await expect(page.getByRole("tab", { name: "Activity", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Concepts", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Grading", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Rubric", exact: true })).toBeHidden();
    await expect(page.getByRole("tab", { name: "Test cases", exact: true })).toBeHidden();

    await page.getByRole("tab", { name: "Concepts", exact: true }).click();
    await page.getByRole("checkbox", { name: `Select all learning targets for ${conceptTitle}`, exact: true }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Knowledge concept links saved.", { exact: true })).toBeVisible();
    await page.goto(assignedPath);
    await expect(page).toHaveURL(reportPath);
    await page.getByRole("link", { name: "Edit activity", exact: true }).click();
    await expect(page).toHaveURL(editorPath);
    await page.getByRole("tab", { name: "Concepts (1)", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: `Select all learning targets for ${conceptTitle}`, exact: true })).toBeChecked();

    await page.getByRole("tab", { name: "Grading", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Rubric", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Test cases", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Test cases", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: testInfo.outputPath("teacher-grading-tab.png") });

    if (!expired) {
      await studentPage.goto(assignedPath);
      await expect(studentPage.getByRole("heading", { name: title, level: 1 })).toBeVisible();
      await expect(studentPage.locator(".monaco-editor")).toBeVisible();
      await expect(studentPage).toHaveURL(assignedPath);
      await expect(studentPage.getByRole("tab", { name: /^(Activity|Concepts|Grading)$/ })).toHaveCount(0);
    }
  });
}
