import { test, expect } from "@playwright/test";

// Simulate only this browser's responses; never stop the shared database or API.
for (const scenario of [
  { name: "database outage", code: "SYS-002", guidance: "PostgreSQL", kind: "database" },
  { name: "network failure", code: "SYS-007", guidance: "Cannot reach the API", kind: "network" },
  { name: "invalid server timestamp", code: "SYS-008", guidance: "invalid response", kind: "timestamp" },
  { name: "missing timezone", code: "SYS-008", guidance: "invalid response", kind: "timezone" },
  { name: "invalid timezone", code: "SYS-008", guidance: "invalid response", kind: "invalidZone" }
]) {
  test(`startup reports ${scenario.name} and Retry restores the login page`, async ({ page }, testInfo) => {
    let failing = true;
    await page.route("**/api/application-time", async route => {
      if (route.request().method() !== "GET" || !failing) return route.continue();
      if (scenario.kind === "network") return route.abort("connectionrefused");
      await route.fulfill({
        status: scenario.kind === "database" ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(scenario.kind === "database"
          ? { error: { code: "INTERNAL_ERROR", systemCode: scenario.code, message: "private database diagnostic" } }
          : { timeZone: scenario.kind === "timezone" ? undefined : scenario.kind === "invalidZone" ? "Invalid/Zone" : "UTC", serverNow: scenario.kind === "timestamp" ? "invalid" : new Date().toISOString() })
      });
    });
    await page.goto("/login");
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText(`System error (${scenario.code}).`);
    await expect(alert).not.toContainText("private database diagnostic");
    if (!process.env.E2E_SYSTEM_ERRORS_PRODUCTION) await expect(alert).toContainText(scenario.guidance);
    else await expect(alert).toHaveText(`System error (${scenario.code}).`);
    await expect(page.getByLabel("Email", { exact: true })).toBeHidden();
    if (scenario.kind === "database") await page.screenshot({ path: testInfo.outputPath("database-startup-error.png") });
    failing = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(alert).toHaveCount(0);
  });
}

test("later synchronization failures preserve the mounted login form and its draft", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("Email", { exact: true });
  await email.fill("draft@example.test");
  await page.route("**/api/application-time", route => route.request().method() === "GET" ? route.abort("connectionrefused") : route.continue());
  const failed = page.waitForEvent("requestfailed", request => request.url().endsWith("/api/application-time"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await failed;
  await expect(email).toHaveValue("draft@example.test");
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
});

test("sign-in service failures display their system code instead of invalid credentials", async ({ page }) => {
  await page.route("**/api/auth/login", route => route.request().method() === "POST" ? route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ error: { code: "INTERNAL_ERROR", systemCode: "SYS-002", message: "private database diagnostic" } })
  }) : route.continue());
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  const alert = page.getByRole("alert").filter({ hasText: "System error (SYS-002)." });
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText("private database diagnostic");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("test@example.test");
});
