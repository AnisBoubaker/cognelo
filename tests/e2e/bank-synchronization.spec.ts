import { prisma } from "@cognelo/db";
import { responseJson } from "./fixtures/activity-suite";
import { expect, ORIGINAL_SOURCE, test } from "./fixtures/bank-course";

test.describe("bank and course synchronization", { tag: "@regression" }, () => {
  test("requires confirmation to retrieve a newer bank version and preserves assignment and placement", async ({ teacherPage: page, teacherApi, bankCourse: data }) => {
    const original = await prisma.bankActivity.findUniqueOrThrow({ where: { id: data.bankActivityId } });
    const originalVersion = await prisma.activityVersion.findUniqueOrThrow({ where: { id: original.currentVersionId! } });
    const assignmentBefore = await prisma.courseGroupActivity.findUniqueOrThrow({ where: { id: data.assignmentId } });
    const placementsBefore = await prisma.courseContentItem.findMany({ where: { activityId: data.activityId }, orderBy: { id: "asc" } });
    const newerSource = ORIGINAL_SOURCE.replace("What is two plus two?", "What is three plus one?");
    await responseJson(await teacherApi.patch(data.bankActivityPath, {
      data: { lifecycle: "published", config: { ...original.config as object, source: newerSource } }
    }));

    await page.goto(data.editorPath);
    await expect(page.locator("#mcq-source")).toHaveValue(ORIGINAL_SOURCE);
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: `Actions for ${data.title}` }).click();
    await page.getByRole("menuitem", { name: "Sync with bank" }).click();
    const sync = page.getByRole("dialog", { name: data.title, exact: true });
    await expect(sync).toContainText("The bank has a newer version.");
    await sync.getByRole("button", { name: "Retrieve latest bank version (version 2)" }).click();
    const confirmation = page.getByRole("alertdialog", { name: "Replace this course copy?" });
    await expect(confirmation).toContainText("It cannot be recovered after replacement.");
    await confirmation.getByRole("button", { name: "Back", exact: true }).click();
    await sync.getByRole("button", { name: "Cancel", exact: true }).click();
    const unchanged = await prisma.activity.findUniqueOrThrow({ where: { id: data.activityId } });
    expect(unchanged.config).toMatchObject({ source: ORIGINAL_SOURCE });
    expect(unchanged.activityVersionId).toBe(originalVersion.id);

    await page.getByRole("button", { name: `Actions for ${data.title}` }).click();
    await page.getByRole("menuitem", { name: "Sync with bank" }).click();
    await sync.getByRole("button", { name: "Retrieve latest bank version (version 2)" }).click();
    const retrieved = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith(`${data.courseActivityPath}/bank-sync`));
    await confirmation.getByRole("button", { name: "Confirm synchronization" }).click();
    expect((await retrieved).ok()).toBeTruthy();
    await expect(confirmation).toBeHidden();
    await page.goto(data.editorPath);
    await expect(page.locator("#mcq-source")).toHaveValue(newerSource);
    expect(await prisma.courseGroupActivity.findUniqueOrThrow({ where: { id: data.assignmentId } })).toEqual(assignmentBefore);
    expect(await prisma.courseContentItem.findMany({ where: { activityId: data.activityId }, orderBy: { id: "asc" } })).toEqual(placementsBefore);
    expect(await prisma.activityVersion.findUniqueOrThrow({ where: { id: originalVersion.id } })).toEqual(originalVersion);
  });

  test("locks retrieval after a student submits but permits publishing without changing academic history", async ({ teacherPage: page, studentPage, teacherApi, bankCourse: data }) => {
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${data.activityId}`);
    await studentPage.getByLabel("Four", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await studentPage.getByRole("dialog", { name: "Submit answers?" }).getByRole("button", { name: "Submit answers" }).click();
    await expect(studentPage).toHaveURL(`/courses/${data.courseId}/groups/${data.groupId}`);
    const attemptsBefore = await prisma.activityAttempt.findMany({ where: { activityId: data.activityId } });
    expect(attemptsBefore).toHaveLength(1);
    const gradesBefore = await prisma.grade.findMany({ where: { selectedAttemptId: attemptsBefore[0]!.id } });
    expect(gradesBefore).toHaveLength(1);
    const original = await prisma.bankActivity.findUniqueOrThrow({ where: { id: data.bankActivityId } });
    const originalVersion = await prisma.activityVersion.findUniqueOrThrow({ where: { id: original.currentVersionId! } });

    await page.goto(data.editorPath);
    const revisedSource = ORIGINAL_SOURCE.replace("Addition", "Revised introduction");
    await page.locator("#mcq-source").fill(revisedSource);
    await page.getByRole("button", { name: "Save multiple choice questions" }).click();
    await expect(page.getByText("Multiple choice questions activity saved.", { exact: true })).toBeVisible();
    await page.goto(`/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: `Actions for ${data.title}` }).click();
    await page.getByRole("menuitem", { name: "Sync with bank" }).click();
    const sync = page.getByRole("dialog", { name: data.title, exact: true });
    await expect(sync).toContainText("Retrieving bank content is locked because this activity has 1 attempt(s).");
    await expect(sync.getByRole("button", { name: "Restore original bank copy (version 1)" })).toBeDisabled();
    for (const action of ["retrieve_original", "retrieve_latest"]) {
      const rejected = await teacherApi.post(`${data.courseActivityPath}/bank-sync`, { data: { action } });
      expect(rejected.status()).toBe(409);
    }
    await sync.getByRole("button", { name: "Publish course copy to bank" }).click();
    const confirmation = page.getByRole("alertdialog", { name: "Publish a new bank version?" });
    await expect(confirmation).toContainText("earlier bank versions remain in version history");
    const published = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith(`${data.courseActivityPath}/bank-sync`));
    await confirmation.getByRole("button", { name: "Confirm synchronization" }).click();
    expect((await published).ok()).toBeTruthy();
    await expect(confirmation).toBeHidden();

    const bank = await prisma.bankActivity.findUniqueOrThrow({ where: { id: data.bankActivityId }, include: { currentVersion: true } });
    expect(bank.currentVersion).toMatchObject({ versionNumber: 2, config: { source: revisedSource } });
    expect(await prisma.activityVersion.findUniqueOrThrow({ where: { id: originalVersion.id } })).toEqual(originalVersion);
    expect(await prisma.activityAttempt.findMany({ where: { activityId: data.activityId } })).toEqual(attemptsBefore);
    expect(await prisma.grade.findMany({ where: { selectedAttemptId: attemptsBefore[0]!.id } })).toEqual(gradesBefore);
    await page.goto(data.editorPath);
    await expect(page.locator("#mcq-source")).toHaveValue(revisedSource);
  });
});
