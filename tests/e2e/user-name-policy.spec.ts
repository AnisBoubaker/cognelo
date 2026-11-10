import { prisma } from "@cognelo/db";
import type { UserProfilePolicy } from "@cognelo/contracts";
import { API_BASE_URL, WEB_BASE_URL, createAuthenticatedApi, createAuthenticatedApiWithCredentials, expect, loginWithCredentialsThroughUi, test } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";

test("admin can lock names while users keep password access, and unlock names again", async ({ adminPage, browser }, testInfo) => {
  test.setTimeout(120_000);
  const admin = await createAuthenticatedApi("admin");
  const original = await responseJson<UserProfilePolicy>(await admin.get("/api/settings/users"));
  const email = `e2e-name-policy-${Date.now()}@example.invalid`, password = "InitialPassword123!", nextPassword = "ReplacementPassword456!";
  let userId = "";
  const context = await browser.newContext({ baseURL: WEB_BASE_URL, locale: "en-CA" });
  try {
    await responseJson(await admin.put("/api/settings/users", { data: { allowUserNameChanges: true } }));
    const created = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", {
      data: { email, password, firstName: "Original", lastName: "Student", roles: ["student"] }
    }));
    userId = created.user.id;
    await responseJson(await admin.put(`/api/users/${userId}/email-verification`));
    const page = await context.newPage();
    await loginWithCredentialsThroughUi(page, { email, password });
    await page.goto("/settings/profile");
    await expect(page.getByLabel("First name", { exact: true })).toBeEditable();
    await page.getByLabel("First name", { exact: true }).fill("Stale draft");

    await adminPage.goto("/settings/users");
    const policy = adminPage.getByRole("region", { name: "Name changes", exact: true });
    const toggle = policy.getByRole("switch", { name: "Allow users to change their first and last names" });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await policy.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await policy.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminPage.getByRole("status").filter({ hasText: "Name-change setting saved." })).toBeVisible();
    await adminPage.reload();
    await expect(toggle).not.toBeChecked();

    // An already-open form cannot bypass the new server policy.
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Only an administrator can change" })).toBeVisible();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Original");
    await expect(page.getByLabel("First name", { exact: true })).not.toBeEditable();
    await page.reload();
    await expect(page.getByLabel("First name", { exact: true })).not.toBeEditable();
    await expect(page.getByLabel("Last name", { exact: true })).not.toBeEditable();
    await expect(page.getByRole("button", { name: "Save profile", exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("locked-names-password-available.png") });

    const learner = await createAuthenticatedApiWithCredentials({ email, password });
    try {
      expect((await learner.put("/api/settings/users", { data: { allowUserNameChanges: true } })).status()).toBe(403);
      expect((await learner.patch("/api/users/me", { data: { firstName: "Bypass", lastName: "Attempt" } })).status()).toBe(403);
      expect((await admin.put("/api/settings/users", { data: { allowUserNameChanges: "false" } })).status()).toBe(400);
    } finally { await learner.dispose(); }

    // Administrative editing remains available while the policy is disabled.
    await adminPage.getByLabel("Email", { exact: true }).fill(email);
    await adminPage.getByRole("button", { name: "Apply filters", exact: true }).click();
    const row = adminPage.locator(".table-row-users").filter({ hasText: email });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    const editor = adminPage.getByRole("dialog", { name: "Edit user", exact: true });
    await editor.getByLabel("First name", { exact: true }).fill("Corrected");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(row).toContainText("Corrected Student");
    await page.reload();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Corrected");

    await page.getByLabel("Current password", { exact: true }).fill(password);
    await page.getByLabel("New password", { exact: true }).fill(nextPassword);
    await page.getByLabel("Confirm new password", { exact: true }).fill(nextPassword);
    await page.getByRole("button", { name: "Change password", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Password changed." })).toBeVisible();
    const replacement = await createAuthenticatedApiWithCredentials({ email, password: nextPassword });
    await replacement.dispose();
    // The password-changing browser also keeps its renewed session.
    await page.reload();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Corrected");

    await toggle.check();
    await policy.getByRole("button", { name: "Save", exact: true }).click();
    await expect(policy.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel("First name", { exact: true })).toBeEditable();
    await page.getByLabel("First name", { exact: true }).fill("Chosen");
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Profile saved." })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Chosen");

    await responseJson(await admin.put("/api/settings/users", { data: { allowUserNameChanges: false } }));
    await adminPage.goto("/settings/profile");
    await expect(adminPage.getByLabel("First name", { exact: true })).toBeEditable();
    await expect(adminPage.getByRole("button", { name: "Save profile", exact: true })).toBeVisible();
  } finally {
    await context.close();
    await responseJson(await admin.put("/api/settings/users", { data: original }));
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await admin.dispose();
  }
});

test("policy loading failure leaves password editing available and name fields protected", async ({ studentPage: page }) => {
  await page.route(`${API_BASE_URL}/api/settings/users`, route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Policy temporarily unavailable." } })
  }));
  await page.goto("/settings/profile");
  await expect(page.getByRole("alert").filter({ hasText: "Policy temporarily unavailable." })).toBeVisible();
  await expect(page.getByLabel("First name", { exact: true })).not.toBeEditable();
  await expect(page.getByLabel("Current password", { exact: true })).toBeEditable();
  await expect(page.getByLabel("New password", { exact: true })).toBeEditable();
});
