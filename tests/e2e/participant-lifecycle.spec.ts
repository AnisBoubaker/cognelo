import { confirmSharedDialog, createAuthenticatedApi, credentialsFor, expect, test } from "./fixtures/auth";
import {
  provisionActivitySuite,
  removeActivitySuite,
  responseJson,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

test.describe.serial("participant import and group lifecycle", () => {
  let data: ActivitySuiteData | undefined;
  let destinationGroupId = "";
  let destinationGroupTitle = "";

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
    destinationGroupTitle = `E2E destination group ${data.token}`;
    const api = await createAuthenticatedApi("teacher");
    try {
      const { group } = await responseJson<{ group: { id: string } }>(
        await api.post(`/api/courses/${data.courseId}/groups`, { data: { title: destinationGroupTitle } })
      );
      destinationGroupId = group.id;
      await responseJson(
        await api.patch(`/api/courses/${data.courseId}/groups/${destinationGroupId}`, {
          data: { availableFrom: null, availableUntil: null, status: "published" }
        })
      );
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("matches an existing account instead of asking for duplicate identity data", async ({ teacherPage: page }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The participant lifecycle suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}?tab=participants`);
    const group = groupCard(page, destinationGroupTitle);
    await group.getByRole("button", { name: "Add participant", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add a participant" });
    await dialog.getByLabel("Email").fill(credentialsFor("admin").email);
    await dialog.getByLabel("Email").blur();
    await expect(dialog.getByText(/Existing user found/)).toBeVisible();
    await expect(dialog.getByLabel("First name")).toHaveAttribute("readonly", "");
    await expect(dialog.getByLabel("Last name")).toHaveAttribute("readonly", "");
    await dialog.getByRole("button", { name: "Add participant", exact: true }).click();
    const addedRow = group.locator(".table-row-participants").filter({ hasText: credentialsFor("admin").email });
    await expect(addedRow.getByText(credentialsFor("admin").email, { exact: true })).toBeVisible();
    await expect(addedRow.getByText("Account linked", { exact: true })).toBeVisible();

    const removed = page.waitForResponse((response) =>
      response.request().method() === "DELETE" && response.url().includes(`/groups/${destinationGroupId}/participants/`)
    );
    await addedRow.getByRole("button", { name: "Remove participant" }).click();
    await confirmSharedDialog(page, "Remove");
    expect((await removed).ok()).toBeTruthy();
    await expect(group.getByText(credentialsFor("admin").email, { exact: true })).toHaveCount(0, { timeout: 30_000 });
  });

  test("validates CSV input, skips existing emails, and reports import progress and totals", async ({ teacherPage: page }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The participant lifecycle suite was not provisioned.");
    const firstEmail = `csv-one-${data.token}@example.invalid`;
    await page.goto(`/courses/${data.courseId}?tab=participants`);
    const group = groupCard(page, destinationGroupTitle);
    await group.getByRole("button", { name: "Import CSV", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Import students from CSV" });
    await dialog.getByLabel("CSV file").setInputFiles({
      name: "invalid-participants.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`Duplicate,One,${firstEmail},1\nDuplicate,Two,${firstEmail},2\n`)
    });
    await expect(dialog.getByRole("alert")).toContainText("occurs more than once");
    await expect(dialog.getByRole("button", { name: "Import students" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await group.getByRole("button", { name: "Import CSV", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Import students from CSV" });
    await dialog.getByLabel("CSV file").setInputFiles({
      name: "participants.csv",
      mimeType: "text/csv",
      buffer: Buffer.from([
        `Existing,Teacher,${credentialsFor("teacher").email},existing`,
        `Csv,One,${firstEmail},csv-1`
      ].join("\n"))
    });
    await expect(dialog).toContainText("2 students are ready to import.");

    let releaseFirstRequest = () => undefined;
    let markFirstRequest = () => undefined;
    const firstRequest = new Promise<void>((resolve) => { markFirstRequest = resolve; });
    const requestGate = new Promise<void>((resolve) => { releaseFirstRequest = resolve; });
    let gated = false;
    await page.route(`**/api/courses/${data.courseId}/groups/${destinationGroupId}/participants`, async (route) => {
      if (route.request().method() === "POST" && !gated) {
        gated = true;
        markFirstRequest();
        await requestGate;
      }
      await route.continue();
    });

    await dialog.getByRole("button", { name: "Import students" }).click();
    await firstRequest;
    const progress = page.getByRole("dialog", { name: "Import students from CSV" }).last();
    await expect(progress).toContainText("Importing 1 of 2 students...");
    releaseFirstRequest();
    await expect(dialog.getByRole("status")).toContainText("Import complete: 1 added, 1 already in the group, 0 failed.");
    await dialog.locator(".dialog-actions").getByRole("button", { name: "Close", exact: true }).click();
    await expect(group.getByText(firstEmail, { exact: true })).toBeVisible();
  });

  test("moves a learner to another group without breaking account or course access", async ({
    studentPage,
    teacherPage
  }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The participant lifecycle suite was not provisioned.");

    await teacherPage.goto(`/courses/${data.courseId}?tab=participants`);
    const originalGroup = groupCard(teacherPage, data.groupTitle);
    await originalGroup.getByTitle("Delete", { exact: true }).click();
    const deletion = teacherPage.getByRole("dialog", { name: "Delete group" });
    await deletion.getByText("Move participants to another group", { exact: true }).click();
    await deletion.getByLabel("Destination group").selectOption(destinationGroupId);
    await deletion.getByRole("button", { name: "Continue" }).click();
    await expect(originalGroup).toHaveCount(0);
    await expect(groupCard(teacherPage, destinationGroupTitle).getByText(credentialsFor("student").email, { exact: true })).toBeVisible();

    await studentPage.goto(`/courses/${data.courseId}/groups/${destinationGroupId}`);
    await expect(studentPage.getByRole("heading", { name: `${data.courseTitle}: ${destinationGroupTitle}` })).toBeVisible();
    await expect(studentPage.getByText("No content items yet.", { exact: true })).toBeVisible();
  });
});

function groupCard(page: import("@playwright/test").Page, title: string) {
  return page.locator(".participant-group-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}
