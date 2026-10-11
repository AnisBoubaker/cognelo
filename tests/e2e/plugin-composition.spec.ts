import { API_BASE_URL, expect, test } from "./fixtures/auth";

const courseId = "seed-course-programming-101";
const groupId = "seed-group-programming-101-section-a";

test.describe("installed plugin composition", () => {
  test("serves plugin metadata to the course UI and mounts the coding renderer", async ({ teacherPage: page, studentPage }) => {
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

    await page.goto(`/courses/${courseId}?tab=content`);
    const expectedIcons = [
      ["Basic Python multiple choice questions", "checklist"],
      ["Write the body of main with a hidden C helper", "code"],
      ["Loop over a list", "tornado"],
      ["Responsive profile card", "browser"]
    ] as const;
    for (const [title, iconClass] of expectedIcons) {
      const row = page.locator(".table-row-content-tree").filter({ hasText: title });
      await expect(row).toBeVisible();
      await expect(row.locator(`svg.tabler-icon-${iconClass}`)).toBeVisible();
      await expect(row.locator("svg.tabler-icon-square")).toHaveCount(0);
    }

    await page.goto(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/seed-activity-coding-template`
    );
    await expect(page.getByRole("heading", { name: "Coding exercise authoring" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity view unavailable" })).toHaveCount(0);

    await studentPage.goto(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/seed-activity-c-median-feedback`
    );
    await expect(studentPage.getByRole("heading", { name: "C exercise: Median of three integers" })).toBeVisible();
    await expect(studentPage.getByRole("tab", { name: "Previous submissions" })).toBeVisible();
    await expect(studentPage.locator(".coding-exercise-attempt-accordion")).toBeVisible();
    await expect(studentPage.getByRole("heading", { name: "Activity view unavailable" })).toHaveCount(0);
  });
});
