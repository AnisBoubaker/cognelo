import { API_BASE_URL, createAuthenticatedApi } from "./fixtures/auth";
import { expect, test } from "./fixtures/bank-course";
import { assignCourseTest, createCourseActivity, responseJson } from "./fixtures/activity-suite";

test.describe("installed plugin composition", () => {
  test("serves plugin metadata to the course UI and mounts the coding renderer", async ({ bankCourse: data, teacherPage: page, studentPage }) => {
    const response = await page.request.get(`${API_BASE_URL}/api/activity-types`);
    expect(response.ok()).toBe(true);
    const payload = await response.json() as {
      registeredDefinitions: Array<{ key: string; icon?: string }>;
    };
    expect(Object.fromEntries(payload.registeredDefinitions.map(({ key, icon }) => [key, icon]))).toMatchObject({
      "coding-exercise": "code",
      "coding-homework-grader": "file-code",
      mcq: "checklist",
      "parsons-problem": "tornado",
      test: "clipboard-check",
      "web-design-coding-exercise": "browser-code"
    });

    const { courseId, groupId } = data;
    const codingTitle = `Composition programming ${data.token}`;
    const codingId = await createCourseActivity(data, {
      activityTypeKey: "coding-exercise", title: codingTitle,
      config: { language: "python", prompt: "Print a greeting.", starterCode: "", sampleTests: [] }
    });
    await assignCourseTest(data, codingId, codingTitle);
    const parsonsTitle = `Composition Parsons ${data.token}`;
    const webTitle = `Composition Web Design ${data.token}`;
    await createCourseActivity(data, { activityTypeKey: "parsons-problem", title: parsonsTitle, config: {} });
    await createCourseActivity(data, { activityTypeKey: "web-design-coding-exercise", title: webTitle, config: {} });
    await page.goto(`/courses/${courseId}?tab=content`);
    const expectedIcons = [
      [data.title, "checklist"], [codingTitle, "code"], [parsonsTitle, "tornado"], [webTitle, "browser"]
    ] as const;
    for (const [title, iconClass] of expectedIcons) {
      const row = page.locator(".table-row-content-tree").filter({ hasText: title });
      await expect(row).toBeVisible();
      await expect(row.locator(`svg.tabler-icon-${iconClass}`)).toBeVisible();
      await expect(row.locator("svg.tabler-icon-square")).toHaveCount(0);
    }

    await page.goto(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${codingId}`
    );
    await expect(page.getByRole("tab", { name: "Class overview", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Edit activity", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Coding exercise authoring" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity view unavailable" })).toHaveCount(0);

    const student = await createAuthenticatedApi("student");
    const assigned = `/courses/${courseId}/groups/${groupId}/activities/assigned/${codingId}`;
    try {
      await responseJson(await student.post(`/api${assigned}/coding-exercises/submit`, { data: { sourceCode: "print('hello')" } }));
    } finally { await student.dispose(); }
    await studentPage.goto(assigned);
    await expect(studentPage.getByRole("heading", { name: codingTitle, exact: true })).toBeVisible();
    await expect(studentPage.getByRole("tab", { name: "Previous submissions" })).toBeVisible();
    await expect(studentPage.locator(".coding-exercise-attempt-accordion")).toBeVisible();
    await expect(studentPage.getByRole("heading", { name: "Activity view unavailable" })).toHaveCount(0);
  });
});
