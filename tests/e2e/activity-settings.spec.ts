import { prisma } from "@cognelo/db";
import type { APIRequestContext, APIResponse, Locator, Page } from "@playwright/test";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import {
  createCourseActivity,
  provisionActivitySuite,
  removeActivitySuite,
  responseJson,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

type AssignmentSettings = {
  general: {
    availableFrom: string | null;
    availableUntil: string | null;
    assessmentMode: "formative" | "summative";
    requireSafeExamBrowser: boolean;
    gradebookSettings: GradebookSettings;
    contentPlacement: { isVisible: boolean };
  };
  groups: Array<{
    groupId: string;
    assigned: boolean;
    assignmentId: string | null;
    overrideFields: string[];
    availableFrom: string | null;
    availableUntil: string | null;
    requireSafeExamBrowser: boolean;
    gradebookSettings: GradebookSettings;
    contentPlacement: { isVisible: boolean };
  }>;
};

type GradebookSettings = {
  pointsPossible: number;
  gradingMode: "points" | "pass_fail";
  passThresholdPoints: number | null;
  passThresholdOutOf: number | null;
  attemptLimitMode: "unlimited" | "max_attempts" | "until_due";
  maxAttempts: number | null;
  gradeStrategy: "latest" | "best" | "first" | "weighted_average";
  dropLowestAttempt: boolean;
};

const mcqConfig = {
  aiGenerationInstructions: "",
  aiQuestionCount: 5,
  defaultCodeLanguage: "none",
  randomizeChoices: false,
  source: [
    "## Assignment policy",
    "Do the effective group settings govern this activity?",
    "",
    "- [x] Yes",
    "- [ ] No"
  ].join("\n")
};

test.describe.serial("activity settings inheritance, overrides, and student behavior", () => {
  let data: ActivitySuiteData | undefined;
  let secondaryGroupId = "";
  let secondaryGroupTitle = "";
  let matrixActivityId = "";
  let matrixTitle = "";
  const activityIds: Record<string, string> = {};
  const activityTitles: Record<string, string> = {};

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
    const teacherApi = await createAuthenticatedApi("teacher");
    try {
      secondaryGroupTitle = `E2E settings second group ${data.token}`;
      const { group } = await responseJson<{ group: { id: string } }>(
        await teacherApi.post(`/api/courses/${data.courseId}/groups`, {
          data: { title: secondaryGroupTitle }
        })
      );
      secondaryGroupId = group.id;
      await responseJson(
        await teacherApi.patch(`/api/courses/${data.courseId}/groups/${secondaryGroupId}`, {
          data: { availableFrom: null, availableUntil: null, status: "published" }
        })
      );

      matrixTitle = `E2E override matrix ${data.token}`;
      matrixActivityId = await createCourseActivity(data, {
        activityTypeKey: "mcq",
        config: mcqConfig,
        title: matrixTitle
      });
      await saveAssignmentSettings(teacherApi, data, matrixActivityId, matrixTitle, {
        availableFrom: "2026-01-10T17:00:00.000Z",
        availableUntil: "2028-01-10T17:00:00.000Z",
        assessmentMode: "summative",
        requireSafeExamBrowser: true,
        gradebookSettings: gradebookSettings(),
        groupAssignments: [
          assignedGroup(data.groupId),
          assignedGroup(secondaryGroupId)
        ]
      });

      for (const key of ["visible", "assignAll", "unassigned", "hidden", "future", "expired", "seb", "policy"] as const) {
        const title = `E2E settings ${key} ${data.token}`;
        activityTitles[key] = title;
        activityIds[key] = await createCourseActivity(data, {
          activityTypeKey: "mcq",
          config: mcqConfig,
          title
        });
      }

      await saveAssignmentSettings(teacherApi, data, activityIds.visible, activityTitles.visible, {
        groupAssignments: [assignedGroup(data.groupId), unassignedGroup(secondaryGroupId)]
      });
      await saveAssignmentSettings(teacherApi, data, activityIds.assignAll, activityTitles.assignAll, {
        groupAssignments: [
          unassignedGroup(data.groupId),
          assignedGroup(secondaryGroupId, {
            overrideFields: ["availableFrom", "visibility"],
            availableFrom: "2030-03-04T17:00:00.000Z",
            contentPlacement: contentPlacement(activityTitles.assignAll, false)
          })
        ]
      });
      await saveAssignmentSettings(teacherApi, data, activityIds.unassigned, activityTitles.unassigned, {
        groupAssignments: [unassignedGroup(data.groupId), assignedGroup(secondaryGroupId)]
      });
      await saveAssignmentSettings(teacherApi, data, activityIds.hidden, activityTitles.hidden, {
        groupAssignments: [
          assignedGroup(data.groupId, {
            overrideFields: ["visibility"],
            contentPlacement: contentPlacement(activityTitles.hidden, false)
          }),
          unassignedGroup(secondaryGroupId)
        ]
      });
      await saveAssignmentSettings(teacherApi, data, activityIds.future, activityTitles.future, {
        groupAssignments: [
          assignedGroup(data.groupId, {
            overrideFields: ["availableFrom"],
            availableFrom: "2031-01-10T17:00:00.000Z"
          }),
          unassignedGroup(secondaryGroupId)
        ]
      });
      await saveAssignmentSettings(teacherApi, data, activityIds.expired, activityTitles.expired, {
        assessmentMode: "summative",
        gradebookSettings: gradebookSettings({ attemptLimitMode: "until_due" }),
        groupAssignments: [
          assignedGroup(data.groupId, {
            overrideFields: ["availableUntil"],
            availableUntil: "2025-01-10T17:00:00.000Z"
          }),
          unassignedGroup(secondaryGroupId)
        ]
      });
      await saveAssignmentSettings(teacherApi, data, activityIds.seb, activityTitles.seb, {
        assessmentMode: "summative",
        requireSafeExamBrowser: false,
        gradebookSettings: gradebookSettings(),
        groupAssignments: [
          assignedGroup(data.groupId, {
            overrideFields: ["requireSafeExamBrowser"],
            requireSafeExamBrowser: true
          }),
          unassignedGroup(secondaryGroupId)
        ]
      });
      await saveAssignmentSettings(teacherApi, data, activityIds.policy, activityTitles.policy, {
        assessmentMode: "summative",
        gradebookSettings: gradebookSettings(),
        groupAssignments: [
          assignedGroup(data.groupId, {
            overrideFields: ["pointsPossible", "grading", "attempts", "gradeStrategy"],
            gradebookSettings: gradebookSettings({
              pointsPossible: 7,
              gradingMode: "pass_fail",
              passThresholdPoints: 1,
              passThresholdOutOf: 1,
              attemptLimitMode: "max_attempts",
              maxAttempts: 1,
              gradeStrategy: "first"
            })
          }),
          unassignedGroup(secondaryGroupId)
        ]
      });
    } finally {
      await teacherApi.dispose();
    }
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("the dialog exposes the requested structure and Cancel discards unsaved General changes", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const settings = await openSettings(page, data.courseId, activityTitles.visible);
    const dialogBounds = await settings.boundingBox();
    expect(dialogBounds?.width).toBeGreaterThan(900);
    const navigationBounds = await settings.getByRole("tablist", { name: "Activity settings sections" }).boundingBox();
    const contentBounds = await settings.locator(".activity-settings-content").boundingBox();
    expect((navigationBounds?.x ?? Number.POSITIVE_INFINITY) + (navigationBounds?.width ?? 0))
      .toBeLessThanOrEqual(contentBounds?.x ?? Number.NEGATIVE_INFINITY);

    for (const tab of ["General", "Group assignment", "AI settings", "Exceptions"]) {
      await expect(settings.getByRole("tab", { name: tab, exact: true })).toBeVisible();
    }
    await expect(settings.getByRole("button", { name: "Cancel", exact: true }).last()).toBeVisible();
    await expect(settings.getByRole("button", { name: "Save settings", exact: true })).toBeVisible();
    await expect(settings.getByLabel("Assessment mode")).toHaveValue("formative");
    await expect(settings.locator(".activity-summative-settings")).toHaveCount(0);
    await expect(settings.getByLabel("Folder")).toHaveCount(0);

    await settings.getByRole("tab", { name: "Group assignment", exact: true }).click();
    await expect(settings.getByRole("tab", { name: data.groupTitle, exact: true })).toBeVisible();
    await expect(settings.getByRole("tab", { name: secondaryGroupTitle, exact: true })).toBeVisible();
    await settings.getByRole("tab", { name: data.groupTitle, exact: true }).click();
    await expect(settings.locator(".activity-override-field")).toHaveCount(3);
    await expect(overrideCard(settings, "Assessment mode")).toHaveCount(0);
    await expect(overrideCard(settings, "Require Safe Exam Browser")).toHaveCount(0);
    await expect(overrideCard(settings, "Points possible")).toHaveCount(0);
    await expect(overrideCard(settings, "Grading")).toHaveCount(0);
    await expect(overrideCard(settings, "Attempts")).toHaveCount(0);
    await expect(overrideCard(settings, "Grade counted")).toHaveCount(0);
    await expect(settings.getByLabel("Folder")).toHaveCount(0);

    for (const tab of ["AI settings", "Exceptions"]) {
      await settings.getByRole("tab", { name: tab, exact: true }).click();
      const panel = settings.getByRole("tabpanel");
      await expect(panel.getByText("Settings for this section will be added later.", { exact: true })).toBeVisible();
      await expect(panel.locator("input, select, textarea, button")).toHaveCount(0);
    }

    await settings.getByRole("tab", { name: "General", exact: true }).click();
    await settings.getByLabel("Visible to students", { exact: true }).uncheck();
    await settings.getByRole("button", { name: "Cancel", exact: true }).last().click();
    await expect(settings).toBeHidden();

    const reopened = await openSettings(page, data.courseId, activityTitles.visible);
    await expect(reopened.getByLabel("Visible to students", { exact: true })).toBeChecked();
    await reopened.getByRole("button", { name: "Cancel", exact: true }).last().click();
  });

  test("Assign to all changes only assignment status, while unassigning clears saved overrides", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const settings = await openSettings(page, data.courseId, activityTitles.assignAll);
    await settings.getByRole("tab", { name: "Group assignment", exact: true }).click();
    await settings.getByRole("tab", { name: data.groupTitle, exact: true }).click();
    await expect(settings.getByLabel("Assigned", { exact: true })).not.toBeChecked();
    await expect(settings.locator(".activity-group-overrides")).toHaveCount(0);

    await settings.getByRole("button", { name: "Assign to all", exact: true }).click();
    await expect(settings.getByLabel("Assigned", { exact: true })).toBeChecked();
    await expect(settings.getByRole("button", { name: "Assign to all", exact: true })).toBeDisabled();

    await settings.getByRole("tab", { name: secondaryGroupTitle, exact: true }).click();
    const availableFrom = overrideCard(settings, "Available from");
    await expect(overrideToggle(availableFrom)).toBeChecked();
    await expect(availableFrom.locator("input[type='date']")).toHaveValue("2030-03-04");
    const visibility = overrideCard(settings, "Visible to students");
    await expect(overrideToggle(visibility)).toBeChecked();
    await expect(overrideValueCheckbox(visibility)).not.toBeChecked();
    await settings.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(settings).toBeHidden();

    const teacherApi = await createAuthenticatedApi("teacher");
    try {
      const saved = await loadAssignmentSettings(teacherApi, data.courseId, activityIds.assignAll);
      expect(saved.groups.find((group) => group.groupId === data?.groupId)).toMatchObject({
        assigned: true,
        overrideFields: []
      });
      expect(saved.groups.find((group) => group.groupId === secondaryGroupId)).toMatchObject({
        assigned: true,
        overrideFields: ["availableFrom", "visibility"],
        availableFrom: "2030-03-04T17:00:00.000Z",
        contentPlacement: { isVisible: false }
      });
    } finally {
      await teacherApi.dispose();
    }

    const reopened = await openSettings(page, data.courseId, activityTitles.assignAll);
    await reopened.getByRole("tab", { name: "Group assignment", exact: true }).click();
    await reopened.getByRole("tab", { name: secondaryGroupTitle, exact: true }).click();
    await reopened.getByLabel("Assigned", { exact: true }).uncheck();
    await expect(reopened.locator(".activity-group-overrides")).toHaveCount(0);
    await reopened.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(reopened).toBeHidden();

    const verificationApi = await createAuthenticatedApi("teacher");
    try {
      const saved = await loadAssignmentSettings(verificationApi, data.courseId, activityIds.assignAll);
      expect(saved.groups.find((group) => group.groupId === secondaryGroupId)).toMatchObject({
        assigned: false,
        assignmentId: null,
        overrideFields: []
      });
      const contentItem = await prisma.courseContentItem.findFirstOrThrow({
        where: { courseId: data.courseId, groupId: null, activityId: activityIds.assignAll, kind: "activity" }
      });
      expect(await prisma.courseGroupContentVisibilityOverride.count({
        where: { groupId: secondaryGroupId, contentItemId: contentItem.id }
      })).toBe(0);
    } finally {
      await verificationApi.dispose();
    }
  });

  test("every override initializes from General, saves its own value, and survives reopening", async ({ teacherPage: page }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The activity suite was not provisioned.");
    const settings = await openSettings(page, data.courseId, matrixTitle);
    await settings.getByRole("tab", { name: "Group assignment" }).click();
    await settings.getByRole("tab", { name: data.groupTitle, exact: true }).click();

    const availableFrom = overrideCard(settings, "Available from");
    await enableOverride(availableFrom);
    await expect(availableFrom.locator("input[type='date']")).toHaveValue("2026-01-10");
    await availableFrom.locator("input[type='date']").fill("2026-02-11");

    const availableUntil = overrideCard(settings, "Available until");
    await enableOverride(availableUntil);
    await expect(availableUntil.locator("input[type='date']")).toHaveValue("2028-01-10");
    await availableUntil.locator("input[type='date']").fill("2027-11-12");

    const visibility = overrideCard(settings, "Visible to students");
    await enableOverride(visibility);
    await expect(overrideValueCheckbox(visibility)).toBeChecked();
    await overrideValueCheckbox(visibility).uncheck();

    const safeExamBrowser = overrideCard(settings, "Require Safe Exam Browser");
    await enableOverride(safeExamBrowser);
    await expect(overrideValueCheckbox(safeExamBrowser)).toBeChecked();
    await overrideValueCheckbox(safeExamBrowser).uncheck();

    const points = overrideCard(settings, "Points possible");
    await enableOverride(points);
    await expect(points.getByRole("spinbutton")).toHaveValue("100");
    await points.getByRole("spinbutton").fill("40");

    const grading = overrideCard(settings, "Grading");
    await enableOverride(grading);
    await expect(grading.getByRole("combobox", { name: "Grading" })).toHaveValue("points");
    await grading.getByRole("combobox", { name: "Grading" }).selectOption("pass_fail");
    await grading.getByLabel("Pass at").fill("30");
    await grading.getByLabel("Out of").fill("40");

    const attempts = overrideCard(settings, "Attempts");
    await enableOverride(attempts);
    await expect(attempts.getByRole("combobox", { name: "Attempts" })).toHaveValue("unlimited");
    await attempts.getByRole("combobox", { name: "Attempts" }).selectOption("max_attempts");
    await attempts.getByLabel("Maximum attempts").fill("2");

    const gradeStrategy = overrideCard(settings, "Grade counted");
    await enableOverride(gradeStrategy);
    await expect(gradeStrategy.getByRole("combobox", { name: "Grade counted" })).toHaveValue("latest");
    await gradeStrategy.getByRole("combobox", { name: "Grade counted" }).selectOption("weighted_average");
    await gradeStrategy.getByLabel("Drop lowest attempt").check();

    await settings.getByRole("button", { name: "Save settings" }).click();
    await expect(settings).toBeHidden();

    const teacherApi = await createAuthenticatedApi("teacher");
    try {
      const saved = await loadAssignmentSettings(teacherApi, data.courseId, matrixActivityId);
      const group = saved.groups.find((candidate) => candidate.groupId === data?.groupId);
      const inherited = saved.groups.find((candidate) => candidate.groupId === secondaryGroupId);
      expect(new Set(group?.overrideFields)).toEqual(new Set([
        "availableFrom",
        "availableUntil",
        "visibility",
        "requireSafeExamBrowser",
        "pointsPossible",
        "grading",
        "attempts",
        "gradeStrategy"
      ]));
      expect(group).toMatchObject({
        assigned: true,
        requireSafeExamBrowser: false,
        contentPlacement: { isVisible: false },
        gradebookSettings: {
          pointsPossible: 40,
          gradingMode: "pass_fail",
          passThresholdPoints: 30,
          passThresholdOutOf: 40,
          attemptLimitMode: "max_attempts",
          maxAttempts: 2,
          gradeStrategy: "weighted_average",
          dropLowestAttempt: true
        }
      });
      expect(group?.availableFrom).toBe("2026-02-11T17:00:00.000Z");
      expect(group?.availableUntil).toBe("2027-11-12T17:00:00.000Z");
      expect(inherited).toMatchObject({
        assigned: true,
        overrideFields: [],
        requireSafeExamBrowser: true,
        contentPlacement: { isVisible: true },
        gradebookSettings: {
          pointsPossible: 100,
          gradingMode: "points",
          attemptLimitMode: "unlimited",
          gradeStrategy: "latest"
        }
      });
    } finally {
      await teacherApi.dispose();
    }

    const reopened = await openSettings(page, data.courseId, matrixTitle);
    await reopened.getByRole("tab", { name: "Group assignment" }).click();
    await reopened.getByRole("tab", { name: data.groupTitle, exact: true }).click();
    for (const label of [
      "Available from",
      "Available until",
      "Visible to students",
      "Require Safe Exam Browser",
      "Points possible",
      "Grading",
      "Attempts",
      "Grade counted"
    ]) {
      await expect(overrideToggle(overrideCard(reopened, label))).toBeChecked();
    }
    await expect(overrideCard(reopened, "Points possible").getByRole("spinbutton")).toHaveValue("40");
    await expect(overrideCard(reopened, "Visible to students").locator(".activity-override-control input[type='checkbox']")).not.toBeChecked();

    await reopened.getByRole("tab", { name: "General", exact: true }).click();
    await reopened.getByLabel("Assessment mode").selectOption("formative");
    await reopened.getByRole("tab", { name: "Group assignment", exact: true }).click();
    await expect(reopened.locator(".activity-override-field")).toHaveCount(3);
    await reopened.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(reopened).toBeHidden();

    const verificationApi = await createAuthenticatedApi("teacher");
    try {
      const saved = await loadAssignmentSettings(verificationApi, data.courseId, matrixActivityId);
      expect(saved.general).toMatchObject({ assessmentMode: "formative", requireSafeExamBrowser: false });
      expect(saved.groups.find((group) => group.groupId === data?.groupId)?.overrideFields).toEqual([
        "availableFrom",
        "availableUntil",
        "visibility"
      ]);
    } finally {
      await verificationApi.dispose();
    }
  });

  test("students inherit access, cannot see hidden or unassigned activities, and see availability states", async ({ studentPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await expect(page.getByText("This activity is not currently available in the group.", { exact: true })).toHaveCount(0);

    await expect(page.getByRole("link", { name: activityTitles.visible, exact: true })).toBeVisible();
    await expect(page.getByText(activityTitles.unassigned, { exact: true })).toHaveCount(0);
    await expect(page.getByText(activityTitles.hidden, { exact: true })).toHaveCount(0);

    const futureRow = page.locator(".table-row-content-tree").filter({ hasText: activityTitles.future });
    await expect(futureRow.getByText("Upcoming", { exact: true })).toBeVisible();
    await expect(futureRow.getByRole("link", { name: activityTitles.future, exact: true })).toHaveCount(0);

    const expiredRow = page.locator(".table-row-content-tree").filter({ hasText: activityTitles.expired });
    await expect(expiredRow.getByText("Expired", { exact: true })).toBeVisible();
    await expect(expiredRow.getByRole("link", { name: activityTitles.expired, exact: true })).toBeVisible();

    const studentApi = await createAuthenticatedApi("student");
    try {
      expect((await studentApi.get(assignedActivityPath(data, activityIds.visible))).status()).toBe(200);
      expect((await studentApi.get(assignedActivityPath(data, activityIds.unassigned))).status()).toBe(404);
      await expectErrorCode(await studentApi.get(assignedActivityPath(data, activityIds.hidden)), 403, "GROUP_ACTIVITY_HIDDEN");
      await expectErrorCode(await studentApi.get(assignedActivityPath(data, activityIds.future)), 403, "GROUP_ACTIVITY_NOT_AVAILABLE");
    } finally {
      await studentApi.dispose();
    }

    await expiredRow.getByRole("link", { name: activityTitles.expired, exact: true }).click();
    await expect(page.getByRole("heading", { name: activityTitles.expired, exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
  });

  test("a group Safe Exam Browser override gates the activity in an ordinary student browser", async ({ studentPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await page.getByRole("link", { name: activityTitles.seb, exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Open this activity in Safe Exam Browser?" })).toBeVisible();
    await expect(page.getByText("Do the effective group settings govern this activity?", { exact: true })).toHaveCount(0);
  });

  test("group gradebook overrides govern points, pass/fail, attempts, and the released student grade", async ({ studentPage: page }) => {
    test.setTimeout(120_000);
    if (!data) throw new Error("The activity suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await page.getByRole("link", { name: activityTitles.policy, exact: true }).click();
    await submitCurrentMcqAttempt(page, "Yes");

    const item = await prisma.gradebookItem.findFirstOrThrow({
      where: { courseId: data.courseId, groupId: data.groupId, activityId: activityIds.policy }
    });
    expect(item).toMatchObject({
      pointsPossible: 7,
      gradingMode: "pass_fail",
      passThresholdPoints: 1,
      passThresholdOutOf: 1,
      attemptLimitMode: "max_attempts",
      maxAttempts: 1,
      gradeStrategy: "first"
    });
    const grade = await prisma.grade.findFirstOrThrow({ where: { gradebookItemId: item.id } });
    expect(grade).toMatchObject({ normalizedScore: 7, normalizedMaxScore: 7, isPass: true });

    const studentApi = await createAuthenticatedApi("student");
    const teacherApi = await createAuthenticatedApi("teacher");
    try {
      await expectErrorCode(
        await studentApi.post(`${assignedActivityPath(data, activityIds.policy)}/mcq/submission`, {
          data: { answers: { "question-1": ["question-1-choice-1"] } }
        }),
        409,
        "ATTEMPT_LIMIT_REACHED"
      );
      await responseJson(
        await teacherApi.patch(`/api/courses/${data.courseId}/gradebook/items/${item.id}/release`, {
          data: { released: true }
        })
      );
    } finally {
      await studentApi.dispose();
      await teacherApi.dispose();
    }

    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}?tab=grades`);
    await expect(page.getByText(activityTitles.policy, { exact: true })).toBeVisible();
    await expect(page.getByText(/7\s*\/\s*7/)).toBeVisible();
  });
});

async function openSettings(page: Page, courseId: string, title: string) {
  await page.goto(`/courses/${courseId}?tab=content`);
  await page.getByRole("button", { name: `Actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: title });
  await expect(settings.getByRole("button", { name: "Save settings" })).toBeEnabled();
  return settings;
}

function overrideCard(settings: Locator, label: string) {
  return settings.locator(".activity-override-field").filter({ hasText: label });
}

function overrideToggle(card: Locator) {
  return card.locator(".activity-override-toggle input[type='checkbox']");
}

function overrideValueCheckbox(card: Locator) {
  return card.locator(".activity-override-control input[type='checkbox']");
}

async function enableOverride(card: Locator) {
  await overrideToggle(card).check();
  await expect(card).toHaveClass(/is-enabled/);
}

async function submitCurrentMcqAttempt(page: Page, choice: "No" | "Yes") {
  await page.getByLabel(choice, { exact: true }).check();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const submissionFinished = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().endsWith("/mcq/submission")
  );
  await page.getByRole("dialog", { name: "Submit answers?" }).getByRole("button", { name: "Submit answers" }).click();
  expect((await submissionFinished).ok()).toBeTruthy();
}

async function saveAssignmentSettings(
  api: APIRequestContext,
  data: ActivitySuiteData,
  activityId: string,
  title: string,
  input: Record<string, unknown>
) {
  await responseJson(
    await api.post(`/api/courses/${data.courseId}/activities/${activityId}/assign-all-groups`, {
      data: {
        availableFrom: null,
        availableUntil: null,
        assessmentMode: "formative",
        requireSafeExamBrowser: false,
        contentPlacement: contentPlacement(title, true),
        ...input
      }
    })
  );
}

async function loadAssignmentSettings(api: APIRequestContext, courseId: string, activityId: string) {
  const result = await responseJson<{ settings: AssignmentSettings }>(
    await api.get(`/api/courses/${courseId}/activities/${activityId}/assign-all-groups`)
  );
  return result.settings;
}

function assignedGroup(groupId: string, input: Record<string, unknown> = {}) {
  return {
    groupId,
    assigned: true,
    overrideFields: [],
    availableFrom: null,
    availableUntil: null,
    requireSafeExamBrowser: false,
    gradebookSettings: gradebookSettings(),
    contentPlacement: { parentId: null, isVisible: true, metadata: {} },
    ...input
  };
}

function unassignedGroup(groupId: string) {
  return { groupId, assigned: false, overrideFields: [] };
}

function contentPlacement(title: string, isVisible: boolean) {
  return { parentId: null, titleSnapshot: title, isVisible, metadata: { e2e: true } };
}

function gradebookSettings(input: Partial<GradebookSettings> = {}): GradebookSettings {
  return {
    pointsPossible: 100,
    gradingMode: "points",
    passThresholdPoints: null,
    passThresholdOutOf: null,
    attemptLimitMode: "unlimited",
    maxAttempts: null,
    gradeStrategy: "latest",
    dropLowestAttempt: false,
    ...input
  };
}

function assignedActivityPath(data: ActivitySuiteData, activityId: string) {
  return `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
}

async function expectErrorCode(
  response: APIResponse,
  status: number,
  code: string
) {
  expect(response.status()).toBe(status);
  await expect(response.json()).resolves.toMatchObject({ error: { code } });
}
