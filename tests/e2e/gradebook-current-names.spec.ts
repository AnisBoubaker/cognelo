import { prisma } from "@cognelo/db";
import type { UserProfilePolicy } from "@cognelo/contracts";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials, expect, test } from "./fixtures/auth";
import { createCourseActivity, provisionActivitySuite, removeActivitySuite, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";

test("homework submission and gradebook lists follow profile/admin name edits without changing enrollment or attempts", async ({ teacherPage: page }) => {
  test.setTimeout(120_000);
  const teacher = await createAuthenticatedApi("teacher"), admin = await createAuthenticatedApi("admin");
  const policy = await responseJson<UserProfilePolicy>(await admin.get("/api/settings/users"));
  let data: ActivitySuiteData | undefined, userId = "";
  let student: Awaited<ReturnType<typeof createAuthenticatedApiWithCredentials>> | undefined;
  try {
    if (!policy.allowUserNameChanges) await responseJson(await admin.put("/api/settings/users", { data: { allowUserNameChanges: true } }));
    data = await provisionActivitySuite();
    const email = `e2e-gradebook-name-${data.token}@example.invalid`, password = "NameCheckPassword123!";
    const { user } = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: {
      email, password, firstName: "Imported", lastName: "Placeholder", roles: ["student"]
    } }));
    userId = user.id;
    await responseJson(await admin.put(`/api/users/${userId}/email-verification`));
    const course = `/api/courses/${data.courseId}`;
    const { participant } = await responseJson<{ participant: { id: string } }>(await teacher.post(`${course}/groups/${data.groupId}/participants`, { data: { email, role: "student" } }));
    const pendingEmail = `e2e-pending-name-${data.token}@example.invalid`;
    await responseJson(await teacher.post(`${course}/groups/${data.groupId}/participants`, { data: {
      email: pendingEmail, role: "student", firstName: "Pending", lastName: "Learner"
    } }));
    student = await createAuthenticatedApiWithCredentials({ email, password });
    const activityId = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Profile name consistency", config: {} });
    const author = `${course}/activities/${activityId}/coding-homework-grader`;
    const current = await responseJson<{ assignment: Record<string, unknown> }>(await teacher.get(`${author}/authoring`));
    await responseJson(await teacher.put(`${author}/authoring`, { data: {
      assignment: { ...current.assignment, settings: { ...(current.assignment.settings as object), questionGenerationEnabled: false } }, requirements: {}
    } }));
    await responseJson(await teacher.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId, metadata: { assessmentMode: "summative" } } }));
    await responseJson(await teacher.put(`${author}/workflow-settings`, { data: { enabled: true } }));
    const assigned = `${course}/groups/${data.groupId}/activities/assigned/${activityId}/coding-homework-grader`;
    await responseJson(await student.post(`${assigned}/preparation`, { data: {
      kind: "file", path: "main.c", expectedRevision: 0, base64: Buffer.from("int main(void) { return 0; }").toString("base64")
    } }));
    const handedIn = await responseJson<{ submission: { id: string; coreAttemptId: string } }>(await student.post(`${assigned}/hand-in`, { data: { expectedRevision: 1 } }));
    const attemptBefore = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: handedIn.submission.coreAttemptId } });

    await responseJson(await student.patch("/api/users/me", { data: { firstName: "Current", lastName: "Learner" } }));
    const assertNames = async (firstName: string) => {
      const name = `${firstName} Learner`;
      await page.goto(`/courses/${data!.courseId}/gradebook/activities/${activityId}`);
      await page.getByRole("tab", { name: "Student results", exact: true }).click();
      const submission = page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
      await expect(submission).toBeVisible();
      const row = page.locator(".table-row-gradebook-detail").filter({ hasText: email });
      await expect(row).toContainText(name);
      await expect(row).not.toContainText("Imported Placeholder");
      await expect(page.locator(".table-row-gradebook-detail").filter({ hasText: pendingEmail })).toContainText("Pending Learner");
      await row.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
      await page.getByRole("menuitem", { name: "Review and grade", exact: true }).click();
      const review = page.getByRole("dialog", { name: "Review and grade", exact: true });
      await expect(review).toContainText(name);
      await review.locator(".review-chat-toolbar").getByRole("button", { name: "Close", exact: true }).click();
      const result = await responseJson<{ gradebook: { rows: Array<{ participantId: string; participantName: string; participantFirstName: string; participantLastName: string }> } }>(
        await teacher.get(`${course}/gradebook?activityId=${activityId}`)
      );
      expect(result.gradebook.rows.find(row => row.participantId === participant.id)).toMatchObject({
        participantName: name, participantFirstName: firstName, participantLastName: "Learner"
      });
      const csv = await teacher.get(`${course}/gradebook?activityId=${activityId}&format=csv`);
      expect(csv.ok()).toBe(true);
      expect(await csv.text()).toContain(name);
      expect(await csv.text()).not.toContain("Imported Placeholder");
    };
    await assertNames("Current");
    await responseJson(await admin.patch(`/api/users/${userId}`, { data: { email, firstName: "Corrected", lastName: "Learner", roles: ["student"] } }));
    await assertNames("Corrected");
    expect(await prisma.courseGroupParticipant.findUniqueOrThrow({ where: { id: participant.id } })).toMatchObject({
      firstName: "Imported", lastName: "Placeholder", userId
    });
    expect(await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attemptBefore.id } })).toEqual(attemptBefore);
  } finally {
    await student?.dispose();
    await removeActivitySuite(data);
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (!policy.allowUserNameChanges) await responseJson(await admin.put("/api/settings/users", { data: policy }));
    await admin.dispose(); await teacher.dispose();
  }
});
