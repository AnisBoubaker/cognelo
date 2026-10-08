import { expect, loginThroughUi, test } from "./fixtures/auth";

test.describe("authentication", () => {
  test("redirects anonymous users from protected pages", async ({ page }) => {
    await page.goto("/courses");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("exposes the first-time account activation flow", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "First-time access" }).click();
    await expect(page.getByRole("heading", { name: "Activate your account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Activate account" })).toBeVisible();
  });

  test("signs in and signs out through the user interface", async ({ page }) => {
    await loginThroughUi(page, "teacher");
    await expect(page).toHaveURL(/\/subjects$/);
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("keeps the current page open when a session check temporarily fails", async ({ teacherPage: page }) => {
    await page.goto("/subjects");
    await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();

    await page.route("**/api/users/me", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Temporary failure." } })
      });
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    await expect(page.getByRole("status")).toContainText("Your activity remains open");
    await expect(page).toHaveURL(/\/subjects$/);
    await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();

    await page.unroute("**/api/users/me");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("status")).toBeHidden();
  });

  test("redirects to sign in after a confirmed unauthorized session check", async ({ teacherPage: page }) => {
    await page.goto("/subjects");
    await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();

    await page.route("**/api/users/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } })
      });
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    await expect(page).toHaveURL(/\/login\?returnTo=/);
  });

  test("renews a valid session on focus without reloading course content or gradebook", async ({ teacherPage: page }) => {
    const courseId = "seed-course-programming-101";
    const courseDataRequests: string[] = [];
    const trackCourseData = (request: import("@playwright/test").Request) => {
      const url = new URL(request.url());
      if (
        url.pathname === `/api/courses/${courseId}/content` ||
        url.pathname === `/api/courses/${courseId}/gradebook`
      ) {
        courseDataRequests.push(url.toString());
      }
    };

    await page.goto(`/courses/${courseId}?tab=content`);
    await expect(page.getByRole("tabpanel", { name: "Content" })).toBeVisible();
    page.on("request", trackCourseData);

    const contentSessionCheck = page.waitForResponse((response) =>
      response.ok() && new URL(response.url()).pathname === "/api/users/me"
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await contentSessionCheck;
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    expect(courseDataRequests).toEqual([]);

    const initialGradebookLoad = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok() &&
        url.pathname === `/api/courses/${courseId}/gradebook` &&
        url.searchParams.get("view") === "summary";
    });
    await page.getByRole("tab", { name: "Gradebook" }).click();
    await initialGradebookLoad;
    await expect(page.getByRole("tabpanel", { name: "Gradebook" })).toBeVisible();
    courseDataRequests.length = 0;

    const gradebookSessionCheck = page.waitForResponse((response) =>
      response.ok() && new URL(response.url()).pathname === "/api/users/me"
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await gradebookSessionCheck;
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    expect(courseDataRequests).toEqual([]);

    page.off("request", trackCourseData);
  });
});
