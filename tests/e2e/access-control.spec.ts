import { prisma } from "@cognelo/db";
import {
  createAuthenticatedApi,
  expect,
  loginWithCredentialsThroughUi,
  test,
  WEB_BASE_URL
} from "./fixtures/auth";
import {
  provisionActivitySuite,
  removeActivitySuite,
  responseJson,
  setSeedStudentParticipantRole,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

test.describe.serial("global and course role boundaries", () => {
  let data: ActivitySuiteData | undefined;

  test.beforeAll(async () => {
    data = await provisionActivitySuite();
  });

  test.afterEach(async () => {
    if (data) await setSeedStudentParticipantRole(data, "student");
  });

  test.afterAll(async () => {
    await removeActivitySuite(data);
  });

  test("anonymous visitors are redirected from every protected workspace family", async ({ page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    for (const path of [
      "/subjects",
      "/activity-banks",
      "/courses",
      `/courses/${data.courseId}`,
      "/settings/profile",
      "/settings/users",
      "/settings/plugins"
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("students see learner course and settings surfaces without authoring actions", async ({ studentPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await expect(page.getByRole("heading", { name: `${data.courseTitle}: ${data.groupTitle}` })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Content" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Grades" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Activities" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a course activity" })).toHaveCount(0);

    await page.goto("/settings/profile");
    await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Settings" }).getByRole("link", { name: /Users/ })).toHaveCount(0);
  });

  test("student APIs reject authoring, roster, gradebook, release, and administration mutations", async () => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const api = await createAuthenticatedApi("student");
    try {
      expect((await api.post("/api/subjects", { data: { title: "Forbidden subject" } })).status()).toBe(403);
      expect(
        (
          await api.post(`/api/courses/${data.courseId}/activities`, {
            data: {
              activityTypeKey: "mcq",
              config: {},
              lifecycle: "draft",
              title: "Forbidden activity"
            }
          })
        ).status()
      ).toBe(403);
      expect((await api.get(`/api/courses/${data.courseId}/gradebook`)).status()).toBe(403);
      expect(
        (
          await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, {
            data: { email: "forbidden-participant@example.invalid", role: "student" }
          })
        ).status()
      ).toBe(403);
      expect(
        (
          await api.patch(`/api/courses/${data.courseId}/gradebook/items/not-a-gradebook-item/release`, {
            data: { released: true }
          })
        ).status()
      ).toBe(403);
      expect((await api.get("/api/users")).status()).toBe(403);
      expect((await api.get("/api/plugins")).status()).toBe(403);
    } finally {
      await api.dispose();
    }
  });

  test("teachers get personal AI settings but explicit admin-only states for users, plugins, email, and maintenance", async ({ teacherPage: page }) => {
    await page.goto("/settings/ai-agents");
    await expect(page.getByRole("heading", { name: "Model connections" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your connections" })).toBeVisible();

    await page.goto("/settings/users");
    await expect(page.getByText("User management is available to administrators.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add user" })).toHaveCount(0);

    await page.goto("/settings/plugins");
    await expect(page.getByText("Plugin settings are available to administrators.")).toBeVisible();

    await page.goto("/settings/email");
    await expect(page.getByText("Email delivery settings are available to administrators.")).toBeVisible();

    await page.goto("/settings/maintenance/media");
    await expect(page.getByText("Maintenance is available to administrators.")).toBeVisible();
  });

  test("teacher APIs reject administrator-only user, plugin, email, and maintenance operations", async () => {
    const api = await createAuthenticatedApi("teacher");
    try {
      expect((await api.get("/api/users")).status()).toBe(403);
      expect((await api.get("/api/plugins")).status()).toBe(403);
      expect((await api.get("/api/settings/email")).status()).toBe(403);
      expect((await api.get("/api/maintenance/media")).status()).toBe(403);
      expect((await api.post("/api/maintenance/media")).status()).toBe(403);
    } finally {
      await api.dispose();
    }
  });

  test("administrators can reach every platform administration surface", async ({ adminPage: page }) => {
    await page.goto("/settings/users");
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();
    await page.goto("/settings/plugins");
    await expect(page.getByRole("heading", { name: "Plugin availability" })).toBeVisible();
    await page.goto("/settings/email");
    await expect(page.getByRole("heading", { name: "Email delivery" })).toBeVisible();
    await page.goto("/settings/ai-agents");
    await expect(page.getByRole("heading", { name: "Global connections" })).toBeVisible();
    await page.goto("/settings/maintenance/media");
    await expect(page.getByRole("heading", { name: "Rich-text media" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Maintenance sections" }).getByRole("link", { name: /Media/ })).toBeVisible();
    await expect(page.getByText("Physical blobs", { exact: true })).toBeVisible();
  });

  test("a pure course manager can create curriculum and courses without administrator access", async ({ browser }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    const email = `e2e-course-manager-${data.token}@example.invalid`;
    const password = "CourseManager123!";
    const adminApi = await createAuthenticatedApi("admin");
    let userId = "";
    try {
      const { user } = await responseJson<{ user: { id: string } }>(
        await adminApi.post("/api/users", {
          data: {
            email,
            firstName: "E2E",
            lastName: "Course Manager",
            password,
            roles: ["course_manager"]
          }
        })
      );
      userId = user.id;
      await responseJson(await adminApi.put(`/api/users/${userId}/email-verification`));

      const context = await browser.newContext({ baseURL: WEB_BASE_URL, locale: "en-CA" });
      try {
        const page = await context.newPage();
        await loginWithCredentialsThroughUi(page, { email, password });

        await page.goto("/subjects");
        await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
        await page.goto("/courses");
        await expect(page.getByRole("link", { name: "Create course" })).toBeVisible();
        await page.goto("/settings/users");
        await expect(page.getByText("User management is available to administrators.")).toBeVisible();
      } finally {
        await context.close();
      }
    } finally {
      await adminApi.dispose();
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  test("the course owner can manage activities, content, participants, gradebook, and settings", async ({ teacherPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await page.goto(`/courses/${data.courseId}?tab=content`);
    for (const tab of ["Content", "Gradebook", "Participants", "Settings"]) {
      await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Content tree actions" }).click();
    await expect(page.getByRole("menuitem", { name: "New activity" })).toBeVisible();
  });

  test("a group TA can use the same management workspace within assigned scope", async ({ studentPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await setSeedStudentParticipantRole(data, "ta");
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await expect(page).toHaveURL(
      `${WEB_BASE_URL}/courses/${data.courseId}?tab=content&view=group&groupId=${data.groupId}`
    );
    await expect(page.getByRole("tab", { name: "Content", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Gradebook", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Participants", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Content tree actions" }).click();
    await expect(page.getByRole("menuitem", { name: "New activity" })).toHaveCount(0);
    await page.getByRole("link", { name: "Course", exact: true }).click();
    await expect(page).toHaveURL(`${WEB_BASE_URL}/courses/${data.courseId}?tab=content`);
    await page.getByRole("button", { name: "Content tree actions" }).click();
    await expect(page.getByRole("menuitem", { name: "New activity" })).toBeVisible();
  });

  test("a group teacher can manage authoring and participant paths", async ({ studentPage: page }) => {
    if (!data) throw new Error("The activity suite was not provisioned.");
    await setSeedStudentParticipantRole(data, "teacher");
    await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    await expect(page).toHaveURL(
      `${WEB_BASE_URL}/courses/${data.courseId}?tab=content&view=group&groupId=${data.groupId}`
    );
    await page.getByRole("tab", { name: "Participants", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Participants", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add participant" })).toBeVisible();
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("heading", { name: "General settings" })).toBeVisible();
    await expect(page.getByText("You do not have permission to perform this action.")).toHaveCount(0);
  });
});
