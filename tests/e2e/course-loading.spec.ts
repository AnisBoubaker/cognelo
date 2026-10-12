import { expect, test } from "./fixtures/bank-course";

test.describe("independent course workspace loading", { tag: "@regression" }, () => {
  test("loads only a gradebook summary on demand and keeps content usable while it is pending", async ({ teacherPage: page, bankCourse: data }) => {
    let releaseGradebook!: () => void;
    const gradebookGate = new Promise<void>((resolve) => { releaseGradebook = resolve; });
    const gradebookRequests: URL[] = [];
    await page.route(`**/api/courses/${data.courseId}/gradebook?*`, async (route) => {
      gradebookRequests.push(new URL(route.request().url()));
      await gradebookGate;
      await route.continue();
    });
    // Also detect an accidental eager request to the full gradebook without query parameters.
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === `/api/courses/${data.courseId}/gradebook` && !url.search) gradebookRequests.push(url);
    });
    try {
      await page.goto(`/courses/${data.courseId}?tab=content`);
      const content = page.getByRole("tabpanel", { name: "Content", exact: true });
      await expect(content.getByRole("link", { name: data.title, exact: true })).toBeVisible();
      expect(gradebookRequests).toHaveLength(0);
      await page.getByRole("tab", { name: "Gradebook", exact: true }).click();
      await expect.poll(() => gradebookRequests.length).toBe(1);
      expect(gradebookRequests[0]!.searchParams.get("view")).toBe("summary");
      const gradebook = page.getByRole("tabpanel", { name: "Gradebook", exact: true });
      await expect(gradebook.getByText("Loading...", { exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Content", exact: true }).click();
      await expect(content.getByRole("link", { name: data.title, exact: true })).toBeVisible();
      await page.getByRole("button", { name: `Actions for ${data.title}` }).click();
      await expect(page.getByRole("menuitem", { name: "Sync with bank" })).toBeVisible();
      await page.keyboard.press("Escape");
      releaseGradebook();
      await page.getByRole("tab", { name: "Gradebook", exact: true }).click();
      await expect(gradebook.getByLabel("Group", { exact: true })).toBeVisible();
      await expect(gradebook.getByText("Loading...", { exact: true })).toBeHidden();
      expect(gradebookRequests.every((url) => url.searchParams.get("view") === "summary")).toBe(true);
    } finally {
      releaseGradebook();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
});
