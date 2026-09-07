import { prisma } from "@cognelo/db";
import type { APIRequestContext, APIResponse, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createAuthenticatedApi, credentialsFor } from "./auth";

export type ActivityTypeKey =
  | "coding-exercise"
  | "coding-homework-grader"
  | "mcq"
  | "parsons-problem"
  | "placeholder"
  | "test"
  | "web-design-coding-exercise";

export type ActivitySuiteData = {
  activityBankId: string;
  activityBankTitle: string;
  courseId: string;
  courseTitle: string;
  groupId: string;
  groupTitle: string;
  secondaryActivityBankId: string;
  secondaryActivityBankTitle: string;
  subjectId: string;
  subjectTitle: string;
  token: string;
};

export type AssignedActivity = {
  activityId: string;
  assignmentId: string;
  title: string;
};

type JsonRecord = Record<string, unknown>;

export async function responseJson<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(
      `E2E data request failed: ${response.url()} -> ${response.status()} ${await response.text()}`
    );
  }
  return response.json() as Promise<T>;
}

export async function provisionActivitySuite(): Promise<ActivitySuiteData> {
  const api = await createAuthenticatedApi("teacher");
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const subjectTitle = `E2E full activity subject ${token}`;
  const activityBankTitle = `E2E full activity bank ${token}`;
  const secondaryActivityBankTitle = `E2E destination bank ${token}`;
  const courseTitle = `E2E full activity course ${token}`;
  const groupTitle = `E2E full activity group ${token}`;

  try {
    const { subject } = await responseJson<{ subject: { id: string } }>(
      await api.post("/api/subjects", {
        data: {
          description: "Disposable subject for broad Playwright role and activity coverage.",
          title: subjectTitle
        }
      })
    );
    const { activityBank } = await responseJson<{ activityBank: { id: string } }>(
      await api.post("/api/activity-banks", {
        data: {
          description: "Disposable source bank for browser-authored activities.",
          subjectId: subject.id,
          title: activityBankTitle
        }
      })
    );
    const { activityBank: secondaryActivityBank } = await responseJson<{ activityBank: { id: string } }>(
      await api.post("/api/activity-banks", {
        data: {
          description: "Disposable destination bank for lifecycle coverage.",
          subjectId: subject.id,
          title: secondaryActivityBankTitle
        }
      })
    );
    const { course } = await responseJson<{ course: { id: string } }>(
      await api.post("/api/courses", {
        data: {
          description: "Disposable course for end-to-end activity coverage.",
          status: "published",
          subjectId: subject.id,
          title: courseTitle
        }
      })
    );
    const { group } = await responseJson<{ group: { id: string } }>(
      await api.post(`/api/courses/${course.id}/groups`, { data: { title: groupTitle } })
    );
    await responseJson(
      await api.patch(`/api/courses/${course.id}/groups/${group.id}`, {
        data: { availableFrom: null, availableUntil: null, status: "published" }
      })
    );
    await responseJson(
      await api.post(`/api/courses/${course.id}/groups/${group.id}/participants`, {
        data: { email: credentialsFor("student").email, role: "student" }
      })
    );

    return {
      activityBankId: activityBank.id,
      activityBankTitle,
      courseId: course.id,
      courseTitle,
      groupId: group.id,
      groupTitle,
      secondaryActivityBankId: secondaryActivityBank.id,
      secondaryActivityBankTitle,
      subjectId: subject.id,
      subjectTitle,
      token
    };
  } finally {
    await api.dispose();
  }
}

export async function removeActivitySuite(data: ActivitySuiteData | undefined) {
  if (!data) return;
  const api = await createAuthenticatedApi("teacher");
  let cleanupError: unknown;
  try {
    let activities: Array<{ id: string }> = [];
    try {
      ({ activities } = await responseJson<{ activities: Array<{ id: string }> }>(
        await api.get(`/api/courses/${data.courseId}/activities`)
      ));
    } catch (error) {
      cleanupError = error;
    }
    for (const activity of activities) {
      try {
        await responseJson(await api.delete(`/api/courses/${data.courseId}/activities/${activity.id}`));
      } catch (error) {
        cleanupError ??= error;
      }
    }
    for (const activityBankId of [data.activityBankId, data.secondaryActivityBankId]) {
      try {
        await responseJson(
          await api.delete(`/api/activity-banks/${activityBankId}`, {
            data: { action: "delete", force: true }
          })
        );
      } catch (error) {
        cleanupError ??= error;
      }
    }
  } finally {
    await api.dispose();
    await prisma.course.deleteMany({ where: { id: data.courseId } });
    await prisma.activityBank.deleteMany({
      where: { id: { in: [data.activityBankId, data.secondaryActivityBankId] } }
    });
    await prisma.subject.deleteMany({ where: { id: data.subjectId } });
  }
  if (cleanupError) throw cleanupError;
}

export async function createBankActivityThroughUi(
  page: Page,
  data: ActivitySuiteData,
  input: { category: "Generic Activity" | "Miscellaneous" | "Programming"; typeName: RegExp | string }
) {
  await page.goto(`/activity-banks/${data.activityBankId}`);
  await page.getByRole("button", { name: "Add activity", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Choose an activity" });
  await picker.getByRole("tab", { name: input.category, exact: true }).click();
  const typeName =
    typeof input.typeName === "string"
      ? new RegExp(`^${escapeRegex(input.typeName)}(?:\\s|$)`)
      : input.typeName;
  await picker.getByRole("button", { name: typeName }).click();
  await expect(page).toHaveURL(
    new RegExp(`/activity-banks/${escapeRegex(data.activityBankId)}/activities/[^/?#]+$`)
  );
  const match = page.url().match(/\/activities\/([^/?#]+)$/);
  if (!match?.[1]) throw new Error("The authored bank activity id was not present in the URL.");
  return match[1];
}

export async function publishCurrentBankActivity(page: Page) {
  await page.getByLabel("Publication status").selectOption("published");
  await expect(page.getByText("Publication status updated.", { exact: true })).toBeVisible();
}

export async function copyAndAssignBankActivity(
  data: ActivitySuiteData,
  input: {
    activityTypeKey: Exclude<ActivityTypeKey, "test">;
    bankActivityId: string;
    assessmentMode?: "formative" | "summative";
    gradebookSettings?: JsonRecord;
    title: string;
  }
): Promise<AssignedActivity> {
  const api = await createAuthenticatedApi("teacher");
  try {
    const { activity } = await responseJson<{ activity: { id: string } }>(
      await api.post(`/api/courses/${data.courseId}/activities`, {
        data: {
          activityTypeKey: input.activityTypeKey,
          bankActivityId: input.bankActivityId,
          description: "",
          lifecycle: "published",
          metadata: { e2e: true },
          position: Date.now() % 100000,
          title: input.title
        }
      })
    );
    const assessmentMode = input.assessmentMode ?? "summative";
    const { assignment } = await responseJson<{ assignment: { id: string } }>(
      await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, {
        data: {
          activityId: activity.id,
          availableFrom: null,
          availableUntil: null,
          config: {},
          contentPlacement: {
            isVisible: true,
            metadata: { e2e: true },
            parentId: null,
            position: Date.now() % 100000,
            titleSnapshot: input.title
          },
          gradebookSettings:
            assessmentMode === "summative"
              ? {
                  attemptLimitMode: "max_attempts",
                  gradeStrategy: "latest",
                  maxAttempts: 1,
                  pointsPossible: 10,
                  ...input.gradebookSettings
                }
              : undefined,
          metadata: { assessmentMode },
          position: Date.now() % 100000
        }
      })
    );
    return { activityId: activity.id, assignmentId: assignment.id, title: input.title };
  } finally {
    await api.dispose();
  }
}

export async function createCourseTestThroughUi(
  page: Page,
  data: ActivitySuiteData,
  title: string
) {
  await page.goto(`/courses/${data.courseId}?tab=content`);
  await page.getByRole("button", { name: "Content tree actions" }).click();
  await page.getByRole("menuitem", { name: "New activity" }).click();
  const picker = page.getByRole("dialog", { name: "Choose course element" });
  await picker.getByRole("tab", { name: "Generic Activity", exact: true }).click();
  await picker.getByRole("button", { name: /^Test/ }).click();
  await expect(page).toHaveURL(new RegExp(`/courses/${escapeRegex(data.courseId)}/activities/[^/?#]+$`));
  const match = page.url().match(/\/activities\/([^/?#]+)$/);
  if (!match?.[1]) throw new Error("The authored Test activity id was not present in the URL.");
  const activityId = match[1];

  await expect(page.getByRole("heading", { name: "Assessment details" })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByText("Instructions shown to students", { exact: true })
    .locator("..")
    .getByRole("textbox")
    .first()
    .fill("Complete every required activity, then submit the Test.");
  await page.getByLabel("Time limit in minutes (optional)").fill("30");
  await page.getByLabel("Navigation").selectOption("free");
  await page.getByLabel("Allow students to resume an unfinished attempt").check();
  await page.getByRole("button", { name: "Save test settings" }).click();
  await expect(page.getByText("Test settings saved.", { exact: true })).toBeVisible();

  const api = await createAuthenticatedApi("teacher");
  try {
    await responseJson(
      await api.patch(`/api/courses/${data.courseId}/activities/${activityId}/test`, {
        data: { lifecycle: "published" }
      })
    );
    return activityId;
  } finally {
    await api.dispose();
  }
}

export async function assignCourseTest(
  data: ActivitySuiteData,
  activityId: string,
  title: string
): Promise<AssignedActivity> {
  const api = await createAuthenticatedApi("teacher");
  try {
    const { assignment } = await responseJson<{ assignment: { id: string } }>(
      await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/activities`, {
        data: {
          activityId,
          availableFrom: null,
          availableUntil: null,
          config: {},
          contentPlacement: {
            isVisible: true,
            metadata: { e2e: true },
            parentId: null,
            position: Date.now() % 100000,
            titleSnapshot: title
          },
          gradebookSettings: {
            attemptLimitMode: "max_attempts",
            gradeStrategy: "latest",
            maxAttempts: 1,
            pointsPossible: 20
          },
          metadata: { assessmentMode: "summative" },
          position: Date.now() % 100000
        }
      })
    );
    return { activityId, assignmentId: assignment.id, title };
  } finally {
    await api.dispose();
  }
}

export async function createCourseActivity(
  data: ActivitySuiteData,
  input: {
    activityTypeKey: Exclude<ActivityTypeKey, "test">;
    config: JsonRecord;
    description?: string;
    lifecycle?: "draft" | "published";
    title: string;
  }
) {
  const api = await createAuthenticatedApi("teacher");
  try {
    const { activity } = await responseJson<{ activity: { id: string } }>(
      await api.post(`/api/courses/${data.courseId}/activities`, {
        data: {
          activityTypeKey: input.activityTypeKey,
          config: input.config,
          contentPlacement: {
            isVisible: true,
            metadata: { e2e: true },
            parentId: null,
            position: Date.now() % 100000,
            titleSnapshot: input.title
          },
          description: input.description ?? "",
          lifecycle: input.lifecycle ?? "published",
          metadata: { e2e: true },
          position: Date.now() % 100000,
          title: input.title
        }
      })
    );
    return activity.id;
  } finally {
    await api.dispose();
  }
}

export async function openStudentActivity(page: Page, data: ActivitySuiteData, title: string) {
  await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true }).first()).toBeVisible();
}

export async function courseActivityIdForBankActivity(
  api: APIRequestContext,
  data: ActivitySuiteData,
  bankActivityId: string
) {
  const { activities } = await responseJson<{
    activities: Array<{ bankActivityId?: string | null; id: string }>;
  }>(await api.get(`/api/courses/${data.courseId}/activities`));
  const activity = activities.find((candidate) => candidate.bankActivityId === bankActivityId);
  if (!activity) throw new Error(`No course activity was copied from bank activity ${bankActivityId}.`);
  return activity.id;
}

export async function setSeedStudentParticipantRole(
  data: ActivitySuiteData,
  role: "student" | "ta" | "teacher"
) {
  const api = await createAuthenticatedApi("teacher");
  try {
    const { group } = await responseJson<{
      group: { participants?: Array<{ email: string; id: string }> };
    }>(await api.get(`/api/courses/${data.courseId}/groups/${data.groupId}`));
    const existing = group.participants?.find(
      (participant) => participant.email.toLowerCase() === credentialsFor("student").email.toLowerCase()
    );
    if (existing) {
      await responseJson(
        await api.delete(
          `/api/courses/${data.courseId}/groups/${data.groupId}/participants/${existing.id}`
        )
      );
    }
    const seedStudent = await prisma.user.findUnique({
      where: { email: credentialsFor("student").email },
      select: { id: true }
    });
    if (!seedStudent) throw new Error("The seeded E2E student account was not found.");
    await prisma.courseMembership.deleteMany({
      where: {
        courseId: data.courseId,
        userId: seedStudent.id,
        role: { in: ["student", "ta", "teacher"] }
      }
    });
    await responseJson(
      await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, {
        data: { email: credentialsFor("student").email, role }
      })
    );
  } finally {
    await api.dispose();
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
