import { expect, test } from "./fixtures/auth";
import {
  createBankActivityThroughUi,
  createCourseActivity,
  openStudentActivity,
  provisionActivitySuite,
  publishCurrentBankActivity,
  removeActivitySuite,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

test.describe.serial("course, group, participant, attempt, and gradebook workflows", () => {
  let data: ActivitySuiteData | undefined;
  let activityTitle = "";

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
    activityTitle = `E2E repeatable assessment ${data.token}`;
    await createCourseActivity(data, {
      activityTypeKey: "mcq",
      config: {
        aiGenerationInstructions: "",
        aiQuestionCount: 5,
        defaultCodeLanguage: "none",
        randomizeChoices: false,
        source: [
          "## Safe submission",
          "Should the server enforce attempt limits?",
          "",
          "- [x] Yes",
          "- [ ] No"
        ].join("\n")
      },
      description: "Exercise the complete repeatable-assessment policy.",
      title: activityTitle
    });
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("teacher assigns a summative activity with the full attempt and grading policy", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: `Actions for ${activityTitle}` }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const settings = page.getByRole("dialog", { name: activityTitle });
    await settings.getByLabel("Assessment mode").selectOption("summative");
    await settings.getByLabel("Points possible").fill("25");
    await settings.getByLabel("Grading").selectOption("pass_fail");
    await settings.getByLabel("Pass at").fill("18");
    await settings.getByLabel("Out of").fill("25");
    await settings.getByLabel("Attempts").selectOption("max_attempts");
    await settings.getByLabel("Maximum attempts").fill("3");
    await settings.getByLabel("Grade counted").selectOption("weighted_average");
    await settings.getByLabel("Drop lowest attempt").check();
    await settings.getByRole("button", { name: "Assign to all groups" }).click();
    await expect(settings).toBeHidden();
    await expect(page.getByText(/Assigned to all groups/)).toBeVisible();
  });

  test("student autosaves a draft and resumes it after a page reload", async ({ studentPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await openStudentActivity(page, data, activityTitle);
    const draftSaved = page.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "PUT" &&
        response.url().includes(`/activities/assigned/`) &&
        response.url().endsWith("/draft")
    );
    await page.getByLabel("No", { exact: true }).check();
    await expect(page.getByLabel("No", { exact: true })).toBeChecked();
    await draftSaved;
    await page.reload();
    await expect(page.getByLabel("No", { exact: true })).toBeChecked();
  });

  test("student uses multiple attempts and cannot exceed the configured attempt policy", async ({ studentPage: page }) => {
    test.fail(true, "Known assessment-integrity bug: https://github.com/AnisBoubaker/cognelo/issues/160");
    test.setTimeout(120_000);
    if (!data) throw new Error("The activity suite was not provisioned.");

    await openStudentActivity(page, data, activityTitle);
    await submitCurrentMcqAttempt(page, "No");
    await openStudentActivity(page, data, activityTitle);
    await submitCurrentMcqAttempt(page, "Yes");
    await openStudentActivity(page, data, activityTitle);
    await submitCurrentMcqAttempt(page, "Yes");

    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await page.getByRole("link", { name: activityTitle, exact: true }).click();
    await expect(page.getByRole("tab", { name: "New attempt" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Previous submissions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
  });

  test("teacher filters, exports, releases, and hides group gradebook results", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}?tab=gradebook`);
    await expect(page.getByRole("heading", { name: "Course gradebook" })).toBeVisible();
    const gradebook = page.getByRole("tabpanel", { name: "Gradebook" });
    await gradebook.getByLabel("Group", { exact: true }).selectOption(data.groupId);
    await gradebook.getByLabel("Activity").selectOption({ label: activityTitle });
    await gradebook.getByLabel("Status").selectOption("graded");
    const exportLink = page.getByRole("link", { name: "Export CSV" });
    await expect(exportLink).toHaveAttribute("href", /activityId=.*status=graded/);
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Release", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hide", exact: true })).toBeVisible();

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Hide", exact: true }).click();
    await expect(page.getByRole("button", { name: "Release", exact: true })).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Release", exact: true }).click();
  });

  test("student sees only the released selected grade, not raw grading payloads", async ({ studentPage: page }) => {
    test.fail(true, "Known grade-release bug: https://github.com/AnisBoubaker/cognelo/issues/162");
    if (!data) throw new Error("The activity suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}?tab=grades`);
    await expect(page.getByRole("heading", { name: "Grades", exact: true })).toBeVisible();
    await expect(page.getByText(activityTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(/25\s*\/\s*25/)).toBeVisible();
    await expect(page.getByText(/rawScore|rawResult|selectedAttemptId/)).toHaveCount(0);
  });

  test("teacher adds and removes a pending TA participant through the group UI", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const email = `e2e-pending-ta-${data.token}@example.invalid`;
    await page.goto(`/courses/${data.courseId}?tab=participants`);
    await page.getByRole("button", { name: "Add participant" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Email").blur();
    await expect(
      page.getByText("No account found yet. Enter first and last name for the future participant.", {
        exact: true
      })
    ).toBeVisible();
    await page.getByLabel("Role").selectOption("ta");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Assistant");
    await page.getByLabel("External ID").fill(`ta-${data.token}`);
    await page.getByRole("button", { name: "Add participant" }).last().click();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByText("TA", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending first login", { exact: true })).toBeVisible();

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByText(email, { exact: true }).locator("..").getByRole("button", { name: "Remove participant" }).click();
    await expect(page.getByText(email, { exact: true })).toHaveCount(0);
  });

  test("teacher edits and restores group publishing and availability settings", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const temporaryTitle = `${data.groupTitle} updated`;
    await page.goto(`/courses/${data.courseId}?tab=participants`);
    await page.getByTitle("Edit group").click();
    let editor = page.getByRole("dialog", { name: "Edit group" });
    await editor.getByLabel("Group title").fill(temporaryTitle);
    await editor.getByLabel("Status").selectOption("draft");
    await editor.getByLabel("Available from").fill("2030-01-10");
    await editor.getByLabel("Available until").fill("2030-01-20");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByRole("heading", { name: temporaryTitle })).toBeVisible();

    await page.getByTitle("Edit group").click();
    editor = page.getByRole("dialog", { name: "Edit group" });
    await editor.getByLabel("Group title").fill(data.groupTitle);
    await editor.getByLabel("Status").selectOption("published");
    await editor.getByLabel("Available from").fill("");
    await editor.getByLabel("Available until").fill("");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByRole("heading", { name: data.groupTitle })).toBeVisible();
  });

  test("teacher versions, compares, duplicates, and moves a bank activity", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const title = `E2E bank lifecycle ${data.token}`;
    await createBankActivityThroughUi(page, data, {
      category: "Generic Activity",
      typeName: /Mult.*choice questions/
    });
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Student prompt").fill("First version of the bank lifecycle activity.");
    await page.locator("#mcq-source").fill("## Version\nWhich version is this?\n\n- [x] One\n- [ ] Two");
    await page.getByRole("button", { name: "Save multiple choice questions" }).click();
    await expect(page.getByText("Multiple choice questions activity saved.", { exact: true })).toBeVisible();
    await publishCurrentBankActivity(page);

    await page.getByLabel("Student prompt").fill("Second version of the bank lifecycle activity.");
    await page.locator("#mcq-source").fill("## Version\nWhich version is this?\n\n- [ ] One\n- [x] Two");
    const secondVersionSaved = page.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "PATCH" &&
        response.url().includes(`/api/activity-banks/${data.activityBankId}/activities/`)
    );
    await page.getByRole("button", { name: "Save multiple choice questions" }).click();
    await secondVersionSaved;
    await page.goto(`/activity-banks/${data.activityBankId}`);

    await page.getByRole("button", { name: `Actions for ${title}` }).click();
    await page.getByRole("menuitem", { name: "Compare versions" }).click();
    const comparison = page.getByRole("dialog", { name: title });
    await comparison.getByRole("button", { name: "Compare versions" }).click();
    await expect(comparison.getByText(/changed/i).first()).toBeVisible();
    await comparison.getByTitle("Close").click();

    await page.getByRole("button", { name: `Actions for ${title}` }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    const duplicate = page.getByRole("dialog", { name: "Duplicate activity" });
    const duplicateTitle = `${title} copy`;
    await duplicate.getByLabel("Title").fill(duplicateTitle);
    await duplicate.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByText(duplicateTitle, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Actions for ${duplicateTitle}` }).click();
    await page.getByRole("menuitem", { name: "Move", exact: true }).click();
    const move = page.getByRole("dialog", { name: "Move activity" });
    await move.getByLabel("Destination activity bank").selectOption(data.secondaryActivityBankId);
    await move.getByRole("button", { name: "Move" }).click();
    await expect(page.getByText(duplicateTitle, { exact: true })).toHaveCount(0);
    await page.goto(`/activity-banks/${data.secondaryActivityBankId}`);
    await expect(page.getByText(duplicateTitle, { exact: true })).toBeVisible();
  });
});

async function submitCurrentMcqAttempt(page: import("@playwright/test").Page, choice: "No" | "Yes") {
  await page.getByLabel(choice, { exact: true }).check();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByRole("dialog", { name: "Submit answers?" }).getByRole("button", { name: "Submit answers" }).click();
}
