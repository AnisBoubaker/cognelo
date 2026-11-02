import { prisma } from "@cognelo/db";
import { test, expect, createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor, WEB_BASE_URL, API_BASE_URL } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";

// Opt in to a private, locally imported dataset. Neither its identities nor content belong in Git.
const courseId = process.env.E2E_IMPORTED_COURSE_ID;
const studentEmail = process.env.E2E_IMPORTED_STUDENT_EMAIL;
if (courseId && studentEmail) {
  for (const endpoint of [WEB_BASE_URL, API_BASE_URL]) {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(endpoint).hostname)) throw new Error("Imported datasets may only be tested locally.");
  }
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Imported datasets require a local database.");
}
test.beforeEach(() => {
  test.skip(!courseId || !studentEmail, "Provide the private local import configuration to run this acceptance scenario.");
});

test("imported course retains its real content and teacher review evidence", async ({ teacherPage: page }) => {
  test.setTimeout(120_000);
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId! } });
  const api = await createAuthenticatedApi("teacher");
  const attemptsBefore = await prisma.activityAttempt.count({ where: { courseId } });
  const gradesBefore = await prisma.grade.count({ where: { gradebookItem: { courseId } } });
  try {
    await page.goto(`/courses/${course.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(course.title);
    await page.getByRole("button", { name: "Content tree actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "Expand all", exact: true }).click();
    const resources = await prisma.courseContentResource.findMany({ where: { courseId }, orderBy: { createdAt: "asc" } });
    expect(resources.length).toBeGreaterThan(0);
    for (const resource of resources.filter(row => row.contentTypeKey === "file")) {
      const response = await api.get(`/api/courses/${course.id}/content-resources/${resource.id}/download`);
      expect(response.ok()).toBe(true);
      const bytes = await response.body();
      const metadata = resource.metadata as { size?: number; mimeType?: string };
      if (metadata.size) expect(bytes.length).toBe(metadata.size);
      if (metadata.mimeType === "application/pdf") expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    }
    const parent = await prisma.activityAttempt.findFirstOrThrow({ where: { courseId, lifecycle: { in: ["submitted", "graded"] }, testRevisionId: { not: null } }, orderBy: { submittedAt: "desc" } });
    await responseJson(await api.get(`/api/courses/${course.id}/gradebook/attempts/${parent.id}/test-review`));
    const children = await prisma.testItemAttempt.findMany({ where: { parentAttemptId: parent.id } });
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) await responseJson(await api.get(`/api/courses/${course.id}/gradebook/attempts/${parent.id}/test-items/${child.testItemId}/review`));
    await page.goto(`/courses/${course.id}/gradebook/activities/${parent.activityId}`);
    await expect(page.getByRole("main")).toBeVisible();
    expect(await prisma.activityAttempt.count({ where: { courseId } })).toBe(attemptsBefore);
    expect(await prisma.grade.count({ where: { gradebookItem: { courseId } } })).toBe(gradesBefore);
  } finally { await api.dispose(); }
});

test("imported roster supports the added test login and retained learner histories", async ({ browser }) => {
  const password = process.env.E2E_IMPORTED_STUDENT_PASSWORD ?? credentialsFor("student").password;
  const participant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { email: studentEmail!, group: { courseId } }, include: { group: true } });
  const testApi = await createAuthenticatedApiWithCredentials({ email: studentEmail!, password });
  const context = await browser.newContext({ baseURL: WEB_BASE_URL, storageState: await testApi.storageState(), locale: "en-CA" });
  try {
    const page = await context.newPage();
    await page.goto(`/courses/${courseId}/groups/${participant.groupId}`);
    await expect(page.getByRole("main")).toContainText(participant.group.title);
    await expect(page.getByRole("tab", { name: "Grades", exact: true })).toBeVisible();
    const sampled = await prisma.activityAttempt.findFirstOrThrow({ where: { courseId, lifecycle: "graded" }, include: { participant: true } });
    const sampleApi = await createAuthenticatedApiWithCredentials({ email: sampled.participant.email, password });
    try {
      await responseJson(await sampleApi.get(`/api/courses/${courseId}/groups/${sampled.groupId}/grades`));
      const history = await sampleApi.get(`/api/courses/${courseId}/groups/${sampled.groupId}/activities/assigned/${sampled.activityId}/submissions`);
      expect(history.ok()).toBe(true);
      const audit = await history.json() as { audit: { submittedAttemptCount: number } };
      expect(audit.audit.submittedAttemptCount).toBeGreaterThan(0);
    } finally { await sampleApi.dispose(); }
  } finally { await context.close(); await testApi.dispose(); }
});
