import { prisma } from "@cognelo/db";
import {
  WEB_BASE_URL,
  confirmSharedDialog,
  createAuthenticatedApi,
  expect,
  loginWithCredentialsThroughUi,
  test
} from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";

test.describe.serial("account lifecycle", () => {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const initialPassword = "InitialPassword123!";
  const changedPassword = "ChangedPassword456!";
  const resetPassword = "ResetPassword789!";
  const profileEmail = `e2e-profile-${token}@example.invalid`;
  const verificationEmail = `e2e-verify-${token}@example.invalid`;
  const managedEmail = `e2e-managed-${token}@example.invalid`;
  let profileUserId = "";
  let verificationUserId = "";
  let managedUserId = "";

  test.beforeAll(async () => {
    const api = await createAuthenticatedApi("admin");
    try {
      profileUserId = (await createUser(api, profileEmail, initialPassword, "Profile", "Original")).id;
      verificationUserId = (await createUser(api, verificationEmail, initialPassword, "Verify", "Learner")).id;
      managedUserId = (await createUser(api, managedEmail, initialPassword, "Managed", "Learner")).id;
      await prisma.user.updateMany({
        where: { id: { in: [profileUserId, managedUserId] } },
        data: { emailVerifiedAt: new Date(), mustChangePassword: false }
      });
      await prisma.user.update({
        where: { id: verificationUserId },
        data: { emailVerifiedAt: null, mustChangePassword: false }
      });
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [profileUserId, verificationUserId, managedUserId] } } });
  });

  test("updates a profile, changes the password, and signs back in with the replacement", async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL: WEB_BASE_URL, locale: "en-CA" });
    const page = await context.newPage();
    try {
      await loginWithCredentialsThroughUi(page, { email: profileEmail, password: initialPassword });
      await page.goto("/settings/profile");
      await page.getByLabel("First name").fill("Updated");
      await page.getByLabel("Last name").fill("Profile");
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByRole("status")).toContainText("Profile saved.");
      await page.reload();
      await expect(page.getByLabel("First name")).toHaveValue("Updated");
      await expect(page.getByLabel("Last name")).toHaveValue("Profile");

      await page.getByLabel("Current password").fill(initialPassword);
      await page.getByLabel("New password", { exact: true }).fill(changedPassword);
      await page.getByLabel("Confirm new password").fill(changedPassword);
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(page.getByRole("status")).toContainText("Password changed.");

      const replacementContext = await browser.newContext({ baseURL: WEB_BASE_URL, locale: "en-CA" });
      const replacementPage = await replacementContext.newPage();
      try {
        await loginWithCredentialsThroughUi(replacementPage, { email: profileEmail, password: changedPassword });
        await expect(replacementPage).toHaveURL(/\/subjects$/);
      } finally {
        await replacementContext.close();
      }
    } finally {
      await context.close();
    }
  });

  test("requests and accepts an email-verification code before entering the application", async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL: WEB_BASE_URL, locale: "en-CA" });
    const page = await context.newPage();
    const sentRequests: Record<string, unknown>[] = [];
    try {
      await page.route("**/api/auth/email-verification/send", async (route) => {
        sentRequests.push(route.request().postDataJSON() as Record<string, unknown>);
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ required: true, sent: true, retryAfterSeconds: 60, expiresInSeconds: 900 })
        });
      });
      await page.route("**/api/auth/email-verification/verify", async (route) => {
        expect(route.request().postDataJSON()).toEqual({ code: "123456" });
        await prisma.user.update({ where: { id: verificationUserId }, data: { emailVerifiedAt: new Date() } });
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({ verified: true }) });
      });
      await submitLogin(page, verificationEmail, initialPassword);
      await expect(page).toHaveURL(/\/verify-email$/);
      await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
      await expect(page.getByRole("status")).toContainText("verification code");
      expect(sentRequests).toHaveLength(1);
      await page.getByLabel("Verification code").fill("123456");
      await page.getByRole("button", { name: "Verify email" }).click();
      await expect(page).toHaveURL(/\/subjects$/);
    } finally {
      await context.close();
    }
  });

  test("lets an administrator confirm an account and force a password replacement", async ({ adminPage: page }) => {
    await prisma.user.update({ where: { id: managedUserId }, data: { emailVerifiedAt: null, mustChangePassword: false } });
    await page.goto("/settings/users");
    await page.getByLabel("Email").fill(managedEmail);
    await page.getByRole("button", { name: "Apply filters" }).click();
    const row = page.locator(".table-row-users").filter({ hasText: managedEmail });
    await row.getByRole("button", { name: "Confirm account" }).click();
    const confirmation = page.getByRole("dialog", { name: "Confirm account without an email code?" });
    await confirmation.getByRole("button", { name: "Confirm account" }).click();
    await expect(row.getByText("Email confirmation required", { exact: true })).toHaveCount(0);

    await row.getByRole("button", { name: "Reset password" }).click();
    const reset = page.getByRole("dialog", { name: /Reset password for/ });
    await reset.getByLabel("Temporary password", { exact: true }).fill(resetPassword);
    await reset.getByLabel("Confirm temporary password").fill(resetPassword);
    await reset.getByRole("button", { name: "Set temporary password" }).click();
    await expect(row.getByText("Password change required", { exact: true })).toBeVisible();

    const loginContext = await page.context().browser()!.newContext({ baseURL: WEB_BASE_URL, locale: "en-CA" });
    const loginPage = await loginContext.newPage();
    try {
      await submitLogin(loginPage, managedEmail, resetPassword);
      await expect(loginPage).toHaveURL(/\/change-password$/);
      await expect(loginPage.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    } finally {
      await loginContext.close();
    }
  });
});

test.describe.serial("administrator settings integrations", () => {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const connectionName = `E2E model ${token}`;

  test.afterEach(async () => {
    await prisma.aiAgentConnection.deleteMany({ where: { displayName: { contains: token } } });
  });

  test("creates, edits, selects, and deletes an AI model connection", async ({ adminPage: page }) => {
    await page.goto("/settings/ai-agents");
    await page.getByLabel("Display name").fill(connectionName);
    await page.getByLabel("Provider").selectOption("ollama");
    await page.getByLabel("Model").fill("e2e-model");
    await page.getByLabel("Base URL").fill("http://127.0.0.1:11434");
    await page.getByLabel("Scope").selectOption("global");
    await page.getByRole("button", { name: "Save model" }).click();
    const row = page.locator(".ai-agent-row").filter({ hasText: connectionName });
    await expect(row).toBeVisible();

    await page.getByLabel("AI agent for question authoring").selectOption({
      label: `${connectionName} · Ollama · e2e-model · Global`
    });
    await page.getByRole("button", { name: "Save AI preferences" }).click();
    await expect(page.getByRole("status").filter({ hasText: "AI preferences saved." })).toBeVisible();

    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Display name").fill(`${connectionName} updated`);
    await page.getByRole("button", { name: "Save model" }).click();
    const updatedRow = page.locator(".ai-agent-row").filter({ hasText: `${connectionName} updated` });
    await expect(updatedRow).toBeVisible();
    await updatedRow.getByRole("button", { name: "Remove" }).click();
    await confirmSharedDialog(page, "Remove");
    await expect(updatedRow).toHaveCount(0);
  });

  test("saves email settings without retransmitting a retained secret and shows progress for a test email", async ({ adminPage: page }) => {
    test.setTimeout(120_000);
    const initialConfiguration = emailConfiguration({ fromName: "Cognelo", fromEmail: "before@example.invalid" });
    const updatedConfiguration = emailConfiguration({ fromName: "Cognelo E2E", fromEmail: "after@example.invalid" });
    let savedBody: Record<string, unknown> | undefined;
    let markTestStarted = () => undefined;
    let releaseTest = () => undefined;
    const testStarted = new Promise<void>((resolve) => { markTestStarted = resolve; });
    const testGate = new Promise<void>((resolve) => { releaseTest = resolve; });
    await page.route("**/api/settings/email", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configuration: initialConfiguration }) });
        return;
      }
      savedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configuration: updatedConfiguration }) });
    });
    await page.route("**/api/settings/email/test", async (route) => {
      markTestStarted();
      await testGate;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    await page.goto("/settings/email");
    await page.getByLabel("Sender display name").fill("Cognelo E2E");
    await page.getByLabel("Sender email address").fill("after@example.invalid");
    await page.getByRole("button", { name: "Save email settings" }).click();
    expect(savedBody).toMatchObject({
      transport: "smtp",
      fromName: "Cognelo E2E",
      fromEmail: "after@example.invalid",
      smtpUsername: "mailer"
    });
    expect(savedBody?.smtpPassword).toBe("");
    await expect(page.getByText("A secret is already stored", { exact: false })).toBeVisible();

    await page.getByLabel("Test recipient email").fill("recipient@example.invalid");
    await page.getByRole("button", { name: "Send test email" }).click();
    await testStarted;
    const progress = page.getByRole("dialog", { name: "Send a test message" });
    await expect(progress).toBeVisible();
    releaseTest();
    await expect(progress).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Test email sent to recipient@example.invalid." })).toBeVisible();
  });

  test("toggles both plugin families through their shared administrator lifecycle UI", async ({ adminPage: page }) => {
    const activityPlugin = pluginInstallation("e2e-activity", "E2E activity plugin", "activityTypeKeys", ["e2e"]);
    const contentPlugin = pluginInstallation("e2e-content", "E2E content plugin", "contentTypeKeys", ["e2e-content"]);
    const patchBodies: Array<{ url: string; body: unknown }> = [];
    await page.route("**/api/plugins", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ plugins: [activityPlugin] }) }));
    await page.route("**/api/content-type-plugins", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ plugins: [contentPlugin] }) }));
    await page.route("**/api/plugins/e2e-activity", async (route) => {
      patchBodies.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ plugin: { ...activityPlugin, isEnabled: false } }) });
    });
    await page.route("**/api/content-type-plugins/e2e-content", async (route) => {
      patchBodies.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ plugin: { ...contentPlugin, isEnabled: false } }) });
    });

    await page.goto("/settings/plugins");
    const activityRow = page.locator(".plugin-settings-row").filter({ hasText: "E2E activity plugin" });
    await activityRow.getByRole("checkbox").dispatchEvent("click");
    await expect(activityRow.getByText("Disabled", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Content type plugins" }).click();
    const contentRow = page.locator(".plugin-settings-row").filter({ hasText: "E2E content plugin" });
    await contentRow.getByRole("checkbox").dispatchEvent("click");
    await expect(contentRow.getByText("Disabled", { exact: true })).toBeVisible();
    expect(patchBodies.map((entry) => entry.body)).toEqual([{ isEnabled: false }, { isEnabled: false }]);
  });

  test("confirms media cleanup, blocks the page with progress, and renders the result", async ({ adminPage: page }) => {
    test.setTimeout(120_000);
    const before = mediaOverview({ candidateAssets: 2, newlyUnreferenced: 1 });
    const after = mediaOverview({ candidateAssets: 0, newlyUnreferenced: 0 });
    let markCleanupStarted = () => undefined;
    let releaseCleanup = () => undefined;
    const cleanupStarted = new Promise<void>((resolve) => { markCleanupStarted = resolve; });
    const cleanupGate = new Promise<void>((resolve) => { releaseCleanup = resolve; });
    await page.route("**/api/maintenance/media", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({ overview: before }) });
        return;
      }
      markCleanupStarted();
      await cleanupGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          cleanup: {
            removedAssets: 2,
            trashedBlobs: 1,
            purgedTrashDirectories: 0,
            purgedStagingDirectories: 0,
            newlyUnreferenced: 1
          },
          overview: after
        })
      });
    });
    await page.goto("/settings/maintenance/media");
    await page.getByRole("button", { name: "Run cleanup" }).click();
    const confirmation = page.getByRole("dialog", { name: "Run media cleanup?" });
    await confirmation.getByRole("button", { name: "Run cleanup" }).click();
    await cleanupStarted;
    const progress = page.getByRole("dialog", { name: "Cleaning…" });
    await expect(progress).toBeVisible();
    releaseCleanup();
    await expect(progress).toBeHidden();
    const completed = page.getByRole("status").filter({ hasText: "Media cleanup completed" });
    await expect(completed).toContainText("2 assets");
    await expect(completed).toContainText("1 blobs");
  });
});

async function createUser(
  api: import("@playwright/test").APIRequestContext,
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  const { user } = await responseJson<{ user: { id: string } }>(
    await api.post("/api/users", { data: { email, password, firstName, lastName, roles: ["teacher"] } })
  );
  return user;
}

async function submitLogin(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Password").press("Enter");
}

function emailConfiguration(overrides: { fromName: string; fromEmail: string }) {
  return {
    configured: true,
    updatedAt: new Date().toISOString(),
    transport: "smtp",
    fromName: overrides.fromName,
    fromEmail: overrides.fromEmail,
    smtpHost: "smtp.example.invalid",
    smtpPort: 587,
    smtpSecurity: "starttls",
    smtpUsername: "mailer",
    hasSmtpPassword: true,
    graphTenantId: "",
    graphClientId: "",
    hasGraphClientSecret: false
  };
}

function pluginInstallation(key: string, name: string, typeKey: string, typeValues: string[]) {
  return {
    key,
    name,
    packageName: `@cognelo/${key}`,
    version: "1.0.0",
    isActivated: true,
    isEnabled: true,
    metadata: { [typeKey]: typeValues, databaseNamespace: null },
    tableBackups: []
  };
}

function mediaOverview(overrides: { candidateAssets: number; newlyUnreferenced: number }) {
  return {
    storageRoot: "/tmp/e2e-media",
    storedBytes: 1024,
    blobCount: 2,
    assetCount: 3,
    activeAssetCount: 2,
    stagedAssetCount: 1,
    referenceCount: 2,
    unreferencedActiveAssetCount: overrides.newlyUnreferenced,
    garbagePreview: {
      candidateAssets: overrides.candidateAssets,
      expiredStagedAssets: overrides.candidateAssets,
      eligibleActiveAssets: 0,
      newlyUnreferenced: overrides.newlyUnreferenced,
      trashDirectories: 0,
      staleStagingDirectories: 0
    },
    policy: {
      stagedUploadHours: 24,
      activeGraceDays: 30,
      trashRetentionDays: 7,
      stagingDirectoryRetentionDays: 2,
      maximumImageBytes: 10 * 1024 * 1024
    }
  };
}
