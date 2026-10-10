import { prisma } from "@cognelo/db";
import { getCourseTeacherQuestionAuthoringAiAgentConnection } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import type { APIRequestContext, BrowserContext } from "@playwright/test";
import {
  createAuthenticatedApi,
  createAuthenticatedApiWithCredentials,
  confirmSharedDialog,
  expect,
  loginWithCredentialsThroughUi,
  test,
  WEB_BASE_URL,
  type Credentials
} from "./fixtures/auth";
import {
  provisionActivitySuite,
  removeActivitySuite,
  responseJson,
  type ActivitySuiteData
} from "./fixtures/activity-suite";

type StaffAccount = Credentials & { id: string };

type StaffSuite = {
  data: ActivitySuiteData;
  coTeacher: StaffAccount;
  sectionTeacher: StaffAccount;
  ta: StaffAccount;
  extraStudent: StaffAccount;
  unrelatedTeacher: StaffAccount;
  group2Id: string;
  group2Title: string;
  activityId: string;
  group1AssignmentId: string;
  group2AssignmentId: string;
};

test.describe.serial("explicit course teachers and section-scoped staff", () => {
  let suite: StaffSuite | undefined;
  const createdUserIds: string[] = [];

  test.beforeAll(async () => {
    const data = await provisionActivitySuite();
    const adminApi = await createAuthenticatedApi("admin");
    const ownerApi = await createAuthenticatedApi("teacher");
    try {
      const coTeacher = await createUser(adminApi, data.token, "co-teacher", ["teacher"]);
      const sectionTeacher = await createUser(adminApi, data.token, "section-teacher", ["teacher"]);
      const ta = await createUser(adminApi, data.token, "section-ta", ["student"]);
      const extraStudent = await createUser(adminApi, data.token, "section-two-student", ["student"]);
      const unrelatedTeacher = await createUser(adminApi, data.token, "unrelated-teacher", ["teacher"]);
      createdUserIds.push(coTeacher.id, sectionTeacher.id, ta.id, extraStudent.id, unrelatedTeacher.id);

      const group2Title = `E2E second section ${data.token}`;
      const { group: group2 } = await responseJson<{ group: { id: string } }>(
        await ownerApi.post(`/api/courses/${data.courseId}/groups`, { data: { title: group2Title } })
      );
      await responseJson(await ownerApi.patch(`/api/courses/${data.courseId}/groups/${group2.id}`, {
        data: { status: "published", availableFrom: null, availableUntil: null }
      }));

      await addParticipant(ownerApi, data.courseId, data.groupId, sectionTeacher.email, "teacher");
      await addParticipant(ownerApi, data.courseId, group2.id, sectionTeacher.email, "teacher");
      await addParticipant(ownerApi, data.courseId, data.groupId, ta.email, "ta");
      await addParticipant(ownerApi, data.courseId, group2.id, extraStudent.email, "student");

      const activityTitle = `E2E staff grading activity ${data.token}`;
      const { activity } = await responseJson<{ activity: { id: string } }>(
        await ownerApi.post(`/api/courses/${data.courseId}/activities`, {
          data: {
            activityTypeKey: "mcq",
            config: {},
            description: "Disposable activity for staff authorization coverage.",
            lifecycle: "published",
            title: activityTitle
          }
        })
      );
      const group1AssignmentId = await assignActivity(ownerApi, data.courseId, data.groupId, activity.id, activityTitle);
      const group2AssignmentId = await assignActivity(ownerApi, data.courseId, group2.id, activity.id, activityTitle);

      suite = {
        data,
        coTeacher,
        sectionTeacher,
        ta,
        extraStudent,
        unrelatedTeacher,
        group2Id: group2.id,
        group2Title,
        activityId: activity.id,
        group1AssignmentId,
        group2AssignmentId
      };
    } catch (error) {
      await removeActivitySuite(data).catch(() => undefined);
      throw error;
    } finally {
      await adminApi.dispose();
      await ownerApi.dispose();
    }
  });

  test.afterAll(async () => {
    await removeActivitySuite(suite?.data);
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  test("MT-01/02/03/04: a second explicit teacher is idempotent, independent, and sees shared course changes", async ({ browser }) => {
    const current = requireSuite(suite);
    const ownerApi = await createAuthenticatedApi("teacher");
    const coTeacherApi = await createAuthenticatedApiWithCredentials(current.coTeacher);
    let context: BrowserContext | undefined;
    try {
      const first = await responseJson<{ membership: { id: string } }>(
        await ownerApi.post(`/api/courses/${current.data.courseId}/memberships`, {
          data: { userId: current.coTeacher.id, role: "teacher" }
        })
      );
      const second = await responseJson<{ membership: { id: string } }>(
        await ownerApi.post(`/api/courses/${current.data.courseId}/memberships`, {
          data: { userId: current.coTeacher.id, role: "teacher" }
        })
      );
      expect(second.membership.id).toBe(first.membership.id);
      expect(await prisma.courseMembership.count({
        where: { courseId: current.data.courseId, userId: current.coTeacher.id, role: "teacher", source: "explicit" }
      })).toBe(1);

      context = await browser.newContext({ baseURL: WEB_BASE_URL, locale: "en-CA" });
      const page = await context.newPage();
      await loginWithCredentialsThroughUi(page, current.coTeacher);
      await page.goto(`/courses/${current.data.courseId}`);
      for (const tab of ["Content", "Gradebook", "Participants", "Challenges", "Settings"]) {
        await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
      }

      await page.getByRole("tab", { name: "Participants", exact: true }).click();
      await page.getByRole("button", { name: "Add course staff", exact: true }).click();
      const staffForm = page.locator("form").filter({ has: page.getByLabel("Existing account email") });
      await staffForm.getByLabel("Existing account email").fill(current.unrelatedTeacher.email);
      await staffForm.getByLabel("Course role").selectOption("teacher");
      await staffForm.getByRole("button", { name: "Add course staff", exact: true }).click();
      const temporaryStaffRow = page.locator(".table-row").filter({ hasText: current.unrelatedTeacher.email });
      await expect(temporaryStaffRow).toBeVisible();
      await temporaryStaffRow.getByRole("button", { name: "Remove course access" }).click();
      await confirmSharedDialog(page, "Remove");
      await expect(temporaryStaffRow).toHaveCount(0);
      const staffAudit = await prisma.courseAuditEvent.findMany({
        where: {
          courseId: current.data.courseId,
          actorUserId: current.coTeacher.id,
          eventType: { in: ["course_membership_added", "course_membership_removed"] }
        },
        select: { eventType: true }
      });
      expect(new Set(staffAudit.map((event) => event.eventType))).toEqual(new Set([
        "course_membership_added",
        "course_membership_removed"
      ]));

      const changedDescription = `Updated by co-teacher ${current.data.token}`;
      expect((await coTeacherApi.patch(`/api/courses/${current.data.courseId}`, {
        data: { description: changedDescription }
      })).status()).toBe(200);
      const ownerView = await responseJson<{ course: { description: string } }>(
        await ownerApi.get(`/api/courses/${current.data.courseId}`)
      );
      expect(ownerView.course.description).toBe(changedDescription);
      await expect(prisma.courseAuditEvent.findFirst({
        where: { courseId: current.data.courseId, actorUserId: current.coTeacher.id, eventType: "course_updated" }
      })).resolves.not.toBeNull();
    } finally {
      await context?.close();
      await coTeacherApi.dispose();
      await ownerApi.dispose();
    }
  });

  test("SEC-01..11/RBAC-04: section teachers and TAs are scoped, and identifier substitution is rejected", async () => {
    const current = requireSuite(suite);
    const sectionApi = await createAuthenticatedApiWithCredentials(current.sectionTeacher);
    const taApi = await createAuthenticatedApiWithCredentials(current.ta);
    const coTeacherApi = await createAuthenticatedApiWithCredentials(current.coTeacher);
    const unrelatedApi = await createAuthenticatedApiWithCredentials(current.unrelatedTeacher);
    try {
      const sectionCourse = await responseJson<{ course: { permissions: { canManageCourse: boolean; gradingGroupIds: string[]; canReleaseGrades: boolean } } }>(
        await sectionApi.get(`/api/courses/${current.data.courseId}`)
      );
      expect(sectionCourse.course.permissions).toMatchObject({
        canManageCourse: false,
        canReleaseGrades: false
      });
      expect(new Set(sectionCourse.course.permissions.gradingGroupIds)).toEqual(new Set([current.data.groupId, current.group2Id]));

      expect((await taApi.get(`/api/courses/${current.data.courseId}/gradebook?groupId=${current.data.groupId}`)).status()).toBe(200);
      expect((await taApi.get(`/api/courses/${current.data.courseId}/gradebook?groupId=${current.group2Id}`)).status()).toBe(403);
      const taCourseList = await responseJson<{
        courses: Array<{
          id: string;
          groups: Array<{ id: string }>;
          memberships: Array<{ userId: string }>;
        }>;
      }>(await taApi.get("/api/courses"));
      const taCourse = taCourseList.courses.find((candidate) => candidate.id === current.data.courseId);
      expect(taCourse?.groups.map((group) => group.id)).toEqual([current.data.groupId]);
      expect(taCourse?.memberships.map((membership) => membership.userId)).toEqual([current.ta.id]);
      expect((await taApi.patch(`/api/courses/${current.data.courseId}/gradebook/items/not-owned/release`, {
        data: { released: true }
      })).status()).toBe(403);
      expect((await taApi.post(`/api/courses/${current.data.courseId}/activities`, {
        data: { activityTypeKey: "placeholder", config: {}, lifecycle: "draft", title: "Forbidden" }
      })).status()).toBe(403);
      expect((await taApi.post(`/api/courses/${current.data.courseId}/groups/${current.data.groupId}/participants`, {
        data: { email: `ta-cannot-add-${current.data.token}@example.invalid`, role: "student" }
      })).status()).toBe(403);

      const added = await responseJson<{ participant: { id: string } }>(
        await sectionApi.post(`/api/courses/${current.data.courseId}/groups/${current.data.groupId}/participants`, {
          data: { email: current.extraStudent.email, role: "student" }
        })
      );
      const coTeacherGroup = await responseJson<{
        group: { participants: Array<{ id: string }> };
      }>(await coTeacherApi.get(`/api/courses/${current.data.courseId}/groups/${current.data.groupId}`));
      expect(coTeacherGroup.group.participants.some((participant) => participant.id === added.participant.id)).toBe(true);
      expect((await sectionApi.delete(
        `/api/courses/${current.data.courseId}/groups/${current.data.groupId}/participants/${added.participant.id}`
      )).status()).toBe(200);
      const coTeacherGroupAfterRemoval = await responseJson<{
        group: { participants: Array<{ id: string }> };
      }>(await coTeacherApi.get(`/api/courses/${current.data.courseId}/groups/${current.data.groupId}`));
      expect(coTeacherGroupAfterRemoval.group.participants.some((participant) => participant.id === added.participant.id)).toBe(false);
      expect((await sectionApi.patch(`/api/courses/${current.data.courseId}`, {
        data: { description: "Forbidden section-wide change" }
      })).status()).toBe(403);

      expect((await unrelatedApi.get(`/api/courses/${current.data.courseId}`)).status()).toBe(403);
      expect((await unrelatedApi.get(`/api/courses/${current.data.courseId}/gradebook`)).status()).toBe(403);
      expect((await unrelatedApi.get(`/api/courses/${current.data.courseId}/groups/${current.data.groupId}`)).status()).toBe(403);
    } finally {
      await unrelatedApi.dispose();
      await coTeacherApi.dispose();
      await taApi.dispose();
      await sectionApi.dispose();
    }
  });

  test("MT-06/07/08: sequential grade changes keep both actors and stale concurrent edits are rejected", async () => {
    const current = requireSuite(suite);
    const ownerApi = await createAuthenticatedApi("teacher");
    const coTeacherApi = await createAuthenticatedApiWithCredentials(current.coTeacher);
    try {
      const initial = await loadGradeRow(ownerApi, current.data.courseId, current.data.groupId, current.activityId);
      expect(initial.gradeUpdatedAt).toBeNull();

      const ownerSave = await ownerApi.patch(gradeOverridePath(current.data.courseId, initial), {
        data: {
          score: 7,
          maxScore: initial.maxScore,
          reason: "Owner review",
          expectedGradeUpdatedAt: initial.gradeUpdatedAt
        }
      });
      expect(ownerSave.status()).toBe(200);

      const staleSave = await coTeacherApi.patch(gradeOverridePath(current.data.courseId, initial), {
        data: {
          score: 8,
          maxScore: initial.maxScore,
          reason: "Stale co-teacher review",
          expectedGradeUpdatedAt: initial.gradeUpdatedAt
        }
      });
      expect(staleSave.status()).toBe(409);
      await expect(staleSave.json()).resolves.toMatchObject({ error: { code: "GRADE_EDIT_CONFLICT" } });

      const refreshed = await loadGradeRow(coTeacherApi, current.data.courseId, current.data.groupId, current.activityId);
      expect(refreshed.gradeUpdatedAt).not.toBeNull();
      expect((await coTeacherApi.patch(gradeOverridePath(current.data.courseId, refreshed), {
        data: {
          score: 8,
          maxScore: refreshed.maxScore,
          reason: "Co-teacher review after reload",
          expectedGradeUpdatedAt: refreshed.gradeUpdatedAt
        }
      })).status()).toBe(200);
      const ownerView = await loadGradeRow(ownerApi, current.data.courseId, current.data.groupId, current.activityId);
      expect(ownerView.score).toBe(8);

      const events = await prisma.gradeEvent.findMany({
        where: { gradebookItemId: initial.gradebookItemId, participantId: initial.participantId, eventType: "overridden" },
        orderBy: { createdAt: "asc" },
        select: { actorUserId: true, previousValue: true, nextValue: true }
      });
      const owner = await prisma.user.findUniqueOrThrow({ where: { email: process.env.E2E_TEACHER_EMAIL ?? "teacher@cognelo.local" } });
      expect(events.map((event) => event.actorUserId)).toEqual([owner.id, current.coTeacher.id]);
      expect(events[1]?.previousValue).not.toBeNull();
      expect(events[1]?.nextValue).not.toBeNull();
    } finally {
      await coTeacherApi.dispose();
      await ownerApi.dispose();
    }
  });

  test("MT-09/10/FLOW-02: a co-teacher releases and resolves the learner challenge with attribution", async () => {
    const current = requireSuite(suite);
    const ownerApi = await createAuthenticatedApi("teacher");
    const coTeacherApi = await createAuthenticatedApiWithCredentials(current.coTeacher);
    const studentApi = await createAuthenticatedApi("student");
    try {
      const row = await loadGradeRow(ownerApi, current.data.courseId, current.data.groupId, current.activityId);
      const participant = await prisma.courseGroupParticipant.findUniqueOrThrow({
        where: { id: row.participantId },
        select: { userId: true }
      });
      const attempt = await prisma.activityAttempt.create({
        data: {
          courseId: current.data.courseId,
          groupId: current.data.groupId,
          groupActivityId: current.group1AssignmentId,
          activityId: current.activityId,
          gradebookItemId: row.gradebookItemId,
          participantId: row.participantId,
          userId: participant.userId,
          attemptNumber: 1,
          lifecycle: "graded",
          submittedAt: new Date(),
          gradedAt: new Date(),
          pluginKey: "mcq",
          pluginVersion: "e2e",
          assessmentMode: "summative"
        }
      });
      expect((await coTeacherApi.patch(
        `/api/courses/${current.data.courseId}/gradebook/items/${row.gradebookItemId}/release`,
        { data: { released: true } }
      )).status()).toBe(200);

      const { grades } = await responseJson<{
        grades: {
          rows: Array<{
            activityId: string;
            challengeAttemptId: string | null;
            gradeChallengeTarget: { feedbackRef: string; feedbackVersion: number } | null;
          }>;
        };
      }>(await studentApi.get(`/api/courses/${current.data.courseId}/groups/${current.data.groupId}/grades`));
      const released = grades.rows.find((candidate) => candidate.activityId === current.activityId);
      expect(released?.challengeAttemptId).toBe(attempt.id);
      if (!released?.challengeAttemptId || !released.gradeChallengeTarget) {
        throw new Error("The released grade did not expose a challenge target.");
      }
      const { challenge } = await responseJson<{ challenge: { id: string } }>(
        await studentApi.post(
          `/api/courses/${current.data.courseId}/gradebook/attempts/${released.challengeAttemptId}/challenges`,
          {
            data: {
              ...released.gradeChallengeTarget,
              explanation: "I would like the second course teacher to review how this final grade was determined."
            }
          }
        )
      );
      const queue = await responseJson<{ challenges: Array<{ id: string }> }>(
        await coTeacherApi.get(`/api/courses/${current.data.courseId}/grade-challenges?status=open`)
      );
      expect(queue.challenges.some((candidate) => candidate.id === challenge.id)).toBe(true);
      expect((await coTeacherApi.patch(
        `/api/courses/${current.data.courseId}/grade-challenges/${challenge.id}`,
        { data: { teacherResponse: "A second teacher reviewed the grade and confirmed the recorded result.", notifyStudent: false } }
      )).status()).toBe(200);
      await expect(prisma.gradeChallenge.findUnique({ where: { id: challenge.id } })).resolves.toMatchObject({
        status: "upheld",
        resolvedByUserId: current.coTeacher.id
      });
    } finally {
      await studentApi.dispose();
      await coTeacherApi.dispose();
      await ownerApi.dispose();
    }
  });

  test("MT-11..15: linked banks and personal AI settings stay isolated with deterministic fallback", async () => {
    const current = requireSuite(suite);
    const ownerApi = await createAuthenticatedApi("teacher");
    const coTeacherApi = await createAuthenticatedApiWithCredentials(current.coTeacher);
    let ownerConnectionId = "";
    let coTeacherConnectionId = "";
    let ownerPreviousQuestionAgentId: string | null = null;
    let coTeacherPreviousQuestionAgentId: string | null = null;
    try {
      const sourceDescription = `Owner bank source ${current.data.token}`;
      const { activity: bankActivity } = await responseJson<{ activity: { id: string } }>(
        await ownerApi.post(`/api/activity-banks/${current.data.activityBankId}/activities`, {
          data: {
            activityTypeKey: "mcq",
            title: `Owner-only bank activity ${current.data.token}`,
            description: sourceDescription,
            lifecycle: "published",
            config: { source: "## Ownership\nWhich copy may publish to this bank?\n\n- [x] The bank owner\n- [ ] Every course teacher" }
          }
        })
      );
      const { activity: courseCopy } = await responseJson<{ activity: { id: string } }>(
        await ownerApi.post(`/api/courses/${current.data.courseId}/activities`, {
          data: {
            activityTypeKey: "mcq",
            bankActivityId: bankActivity.id,
            title: `Independent course copy ${current.data.token}`,
            lifecycle: "published"
          }
        })
      );
      const courseDescription = `Changed only in the course by co-teacher ${current.data.token}`;
      expect((await coTeacherApi.patch(
        `/api/courses/${current.data.courseId}/activities/${courseCopy.id}`,
        { data: { description: courseDescription } }
      )).status()).toBe(200);
      expect((await coTeacherApi.post(
        `/api/courses/${current.data.courseId}/activities/${courseCopy.id}/bank-sync`,
        { data: { action: "publish_to_bank" } }
      )).status()).toBe(403);
      const foreignBank = await responseJson<{ activityBank: { canManage: boolean } }>(
        await coTeacherApi.get(`/api/activity-banks/${current.data.activityBankId}`)
      );
      expect(foreignBank.activityBank.canManage).toBe(false);
      const ownerBankView = await responseJson<{ activity: { description: string } }>(
        await ownerApi.get(`/api/activity-banks/${current.data.activityBankId}/activities/${bankActivity.id}`)
      );
      expect(ownerBankView.activity.description).toBe(sourceDescription);

      const ownerSecret = `owner-secret-${current.data.token}`;
      const { connection: ownerConnection } = await responseJson<{ connection: { id: string } }>(
        await ownerApi.post("/api/ai-agents", {
          data: {
            displayName: `Owner private model ${current.data.token}`,
            provider: "openai",
            model: "owner-priority-model",
            baseUrl: "https://ai-owner.example.invalid/v1",
            apiKey: ownerSecret,
            scope: "personal",
            isEnabled: true
          }
        })
      );
      ownerConnectionId = ownerConnection.id;
      const { connection: coTeacherConnection } = await responseJson<{ connection: { id: string } }>(
        await coTeacherApi.post("/api/ai-agents", {
          data: {
            displayName: `Co-teacher fallback model ${current.data.token}`,
            provider: "ollama",
            model: "co-teacher-fallback-model",
            baseUrl: "http://127.0.0.1:11434",
            scope: "personal",
            isEnabled: true
          }
        })
      );
      coTeacherConnectionId = coTeacherConnection.id;

      const ownerConnections = await responseJson<{
        connections: Array<{ id: string; hasApiKey: boolean }>;
        preferences: { questionAuthoringAiAgentConnectionId: string | null };
      }>(
        await ownerApi.get("/api/ai-agents")
      );
      ownerPreviousQuestionAgentId = ownerConnections.preferences.questionAuthoringAiAgentConnectionId;
      expect(ownerConnections.connections).toContainEqual(expect.objectContaining({ id: ownerConnectionId, hasApiKey: true }));
      expect(JSON.stringify(ownerConnections)).not.toContain(ownerSecret);
      const coTeacherConnections = await responseJson<{
        connections: Array<{ id: string }>;
        preferences: { questionAuthoringAiAgentConnectionId: string | null };
      }>(
        await coTeacherApi.get("/api/ai-agents")
      );
      coTeacherPreviousQuestionAgentId = coTeacherConnections.preferences.questionAuthoringAiAgentConnectionId;
      expect(coTeacherConnections.connections.some((connection) => connection.id === ownerConnectionId)).toBe(false);
      expect((await coTeacherApi.patch(`/api/ai-agents/${ownerConnectionId}`, {
        data: { displayName: "Forbidden cross-teacher edit" }
      })).status()).toBe(403);
      expect((await coTeacherApi.patch("/api/ai-agents/preferences", {
        data: { questionAuthoringAiAgentConnectionId: ownerConnectionId }
      })).status()).toBe(404);

      await responseJson(await ownerApi.patch("/api/ai-agents/preferences", {
        data: { questionAuthoringAiAgentConnectionId: ownerConnectionId }
      }));
      await responseJson(await coTeacherApi.patch("/api/ai-agents/preferences", {
        data: { questionAuthoringAiAgentConnectionId: coTeacherConnectionId }
      }));
      await responseJson(await ownerApi.patch(`/api/courses/${current.data.courseId}/settings`, {
        data: {
          studentSupportAiAgentConnectionId: ownerConnectionId,
          automaticFeedbackEnabled: false,
          assessmentFeedbackAiAgentConnectionId: null
        }
      }));
      expect((await coTeacherApi.patch(`/api/courses/${current.data.courseId}`, {
        data: { description: `AI-safe course update ${current.data.token}` }
      })).status()).toBe(200);
      const savedCourse = await prisma.course.findUniqueOrThrow({
        where: { id: current.data.courseId },
        select: { metadata: true }
      });
      expect(savedCourse.metadata).toMatchObject({
        aiSettings: { studentSupportAiAgentConnectionId: ownerConnectionId }
      });

      const learnerParticipant = await prisma.courseGroupParticipant.findFirstOrThrow({
        where: { groupId: current.data.groupId, role: "student", userId: { not: null } },
        select: { userId: true, email: true, firstName: true, lastName: true }
      });
      const learner: CurrentUser = {
        id: learnerParticipant.userId!,
        email: learnerParticipant.email,
        name: `${learnerParticipant.firstName} ${learnerParticipant.lastName}`.trim(),
        firstName: learnerParticipant.firstName,
        lastName: learnerParticipant.lastName,
        roles: ["student"]
      };
      await expect(getCourseTeacherQuestionAuthoringAiAgentConnection(learner, current.data.courseId))
        .resolves.toMatchObject({ id: ownerConnectionId });
      await responseJson(await ownerApi.patch(`/api/ai-agents/${ownerConnectionId}`, {
        data: { isEnabled: false }
      }));
      await expect(getCourseTeacherQuestionAuthoringAiAgentConnection(learner, current.data.courseId))
        .resolves.toMatchObject({ id: coTeacherConnectionId });
    } finally {
      await ownerApi.patch("/api/ai-agents/preferences", {
        data: { questionAuthoringAiAgentConnectionId: ownerPreviousQuestionAgentId }
      }).catch(() => undefined);
      await coTeacherApi.patch("/api/ai-agents/preferences", {
        data: { questionAuthoringAiAgentConnectionId: coTeacherPreviousQuestionAgentId }
      }).catch(() => undefined);
      if (ownerConnectionId) await ownerApi.delete(`/api/ai-agents/${ownerConnectionId}`).catch(() => undefined);
      if (coTeacherConnectionId) await coTeacherApi.delete(`/api/ai-agents/${coTeacherConnectionId}`).catch(() => undefined);
      await coTeacherApi.dispose();
      await ownerApi.dispose();
    }
  });

  test("SEC-12/13 and MT-16/17/18/19: partial and final staff removal is immediate and preserves academic history", async () => {
    const current = requireSuite(suite);
    const ownerApi = await createAuthenticatedApi("teacher");
    const sectionApi = await createAuthenticatedApiWithCredentials(current.sectionTeacher);
    const coTeacherApi = await createAuthenticatedApiWithCredentials(current.coTeacher);
    try {
      const beforeEvents = await prisma.gradeEvent.count({ where: { gradebookItem: { courseId: current.data.courseId } } });
      const group1 = await responseJson<{ group: { participants: Array<{ id: string; userId: string | null; role: string }> } }>(
        await ownerApi.get(`/api/courses/${current.data.courseId}/groups/${current.data.groupId}`)
      );
      const group1Teacher = group1.group.participants.find((participant) =>
        participant.userId === current.sectionTeacher.id && participant.role === "teacher"
      );
      if (!group1Teacher) throw new Error("Section teacher was not present in Section 1.");
      expect((await ownerApi.delete(
        `/api/courses/${current.data.courseId}/groups/${current.data.groupId}/participants/${group1Teacher.id}`
      )).status()).toBe(200);
      expect((await sectionApi.get(`/api/courses/${current.data.courseId}/gradebook?groupId=${current.data.groupId}`)).status()).toBe(403);
      expect((await sectionApi.get(`/api/courses/${current.data.courseId}/gradebook?groupId=${current.group2Id}`)).status()).toBe(200);

      const group2 = await responseJson<{ group: { participants: Array<{ id: string; userId: string | null; role: string }> } }>(
        await ownerApi.get(`/api/courses/${current.data.courseId}/groups/${current.group2Id}`)
      );
      const group2Teacher = group2.group.participants.find((participant) =>
        participant.userId === current.sectionTeacher.id && participant.role === "teacher"
      );
      if (!group2Teacher) throw new Error("Section teacher was not present in Section 2.");
      expect((await ownerApi.delete(
        `/api/courses/${current.data.courseId}/groups/${current.group2Id}/participants/${group2Teacher.id}`
      )).status()).toBe(200);
      expect((await sectionApi.get(`/api/courses/${current.data.courseId}`)).status()).toBe(403);

      const course = await responseJson<{ course: { memberships: Array<{ id: string; userId: string; role: string; source: string }> } }>(
        await ownerApi.get(`/api/courses/${current.data.courseId}`)
      );
      const coTeacherMembership = course.course.memberships.find((membership) =>
        membership.userId === current.coTeacher.id && membership.role === "teacher" && membership.source === "explicit"
      );
      if (!coTeacherMembership) throw new Error("Explicit co-teacher membership was not present.");
      expect((await ownerApi.delete(
        `/api/courses/${current.data.courseId}/memberships/${coTeacherMembership.id}`
      )).status()).toBe(200);
      expect((await coTeacherApi.get(`/api/courses/${current.data.courseId}`)).status()).toBe(403);
      const courseList = await responseJson<{ courses: Array<{ id: string }> }>(await coTeacherApi.get("/api/courses"));
      expect(courseList.courses.some((candidate) => candidate.id === current.data.courseId)).toBe(false);
      expect(await prisma.gradeEvent.count({ where: { gradebookItem: { courseId: current.data.courseId } } })).toBe(beforeEvents);
    } finally {
      await coTeacherApi.dispose();
      await sectionApi.dispose();
      await ownerApi.dispose();
    }
  });

  test("MT-20/21/22: creator departure leaves a replacement owner and the final owner cannot be removed", async () => {
    const current = requireSuite(suite);
    const adminApi = await createAuthenticatedApi("admin");
    const creatorApi = await createAuthenticatedApi("teacher");
    const replacementApi = await createAuthenticatedApiWithCredentials(current.coTeacher);
    const creator = await prisma.user.findUniqueOrThrow({
      where: { email: process.env.E2E_TEACHER_EMAIL ?? "teacher@cognelo.local" }
    });
    try {
      await responseJson(await adminApi.post(`/api/courses/${current.data.courseId}/memberships`, {
        data: { userId: current.coTeacher.id, role: "owner" }
      }));
      const course = await responseJson<{ course: { memberships: Array<{ id: string; userId: string; role: string; source: string }> } }>(
        await adminApi.get(`/api/courses/${current.data.courseId}`)
      );
      const creatorOwner = course.course.memberships.find((membership) =>
        membership.userId === creator.id && membership.role === "owner" && membership.source === "explicit"
      );
      const replacementOwner = course.course.memberships.find((membership) =>
        membership.userId === current.coTeacher.id && membership.role === "owner" && membership.source === "explicit"
      );
      if (!creatorOwner || !replacementOwner) throw new Error("Both course owners were expected.");

      for (const groupId of [current.data.groupId, current.group2Id]) {
        const group = await responseJson<{
          group: { participants: Array<{ id: string; userId: string | null; role: string }> };
        }>(await adminApi.get(`/api/courses/${current.data.courseId}/groups/${groupId}`));
        const creatorParticipant = group.group.participants.find((participant) =>
          participant.userId === creator.id && participant.role === "teacher"
        );
        if (creatorParticipant) {
          expect((await adminApi.delete(
            `/api/courses/${current.data.courseId}/groups/${groupId}/participants/${creatorParticipant.id}`
          )).status()).toBe(200);
        }
      }
      expect((await adminApi.delete(`/api/courses/${current.data.courseId}/memberships/${creatorOwner.id}`)).status()).toBe(200);
      expect((await replacementApi.get(`/api/courses/${current.data.courseId}`)).status()).toBe(200);
      expect((await creatorApi.get(`/api/courses/${current.data.courseId}`)).status()).toBe(403);
      const creatorCourses = await responseJson<{ courses: Array<{ id: string }> }>(await creatorApi.get("/api/courses"));
      expect(creatorCourses.courses.some((candidate) => candidate.id === current.data.courseId)).toBe(false);
      const finalRemoval = await adminApi.delete(`/api/courses/${current.data.courseId}/memberships/${replacementOwner.id}`);
      expect(finalRemoval.status()).toBe(409);
      await expect(finalRemoval.json()).resolves.toMatchObject({ error: { code: "LAST_COURSE_OWNER_REQUIRED" } });
    } finally {
      await adminApi.post(`/api/courses/${current.data.courseId}/memberships`, {
        data: { userId: creator.id, role: "owner" }
      }).catch(() => undefined);
      await replacementApi.dispose();
      await creatorApi.dispose();
      await adminApi.dispose();
    }
  });
});

async function createUser(api: APIRequestContext, token: string, label: string, roles: string[]): Promise<StaffAccount> {
  const password = "RoleCoverage123!";
  const email = `e2e-${label}-${token}@example.invalid`;
  const { user } = await responseJson<{ user: { id: string } }>(await api.post("/api/users", {
    data: {
      email,
      firstName: "E2E",
      lastName: label.replaceAll("-", " "),
      password,
      roles
    }
  }));
  await responseJson(await api.put(`/api/users/${user.id}/email-verification`));
  return { id: user.id, email, password };
}

async function addParticipant(
  api: APIRequestContext,
  courseId: string,
  groupId: string,
  email: string,
  role: "teacher" | "ta" | "student"
) {
  await responseJson(await api.post(`/api/courses/${courseId}/groups/${groupId}/participants`, {
    data: { email, role }
  }));
}

async function assignActivity(
  api: APIRequestContext,
  courseId: string,
  groupId: string,
  activityId: string,
  title: string
) {
  const { assignment } = await responseJson<{ assignment: { id: string } }>(
    await api.post(`/api/courses/${courseId}/groups/${groupId}/activities`, {
      data: {
        activityId,
        availableFrom: null,
        availableUntil: null,
        config: {},
        contentPlacement: {
          isVisible: true,
          metadata: { e2e: true },
          parentId: null,
          position: 0,
          titleSnapshot: title
        },
        gradebookSettings: {
          attemptLimitMode: "max_attempts",
          gradeStrategy: "latest",
          maxAttempts: 1,
          pointsPossible: 10
        },
        metadata: { assessmentMode: "summative", gradeChallengesEnabled: true },
        position: 0
      }
    })
  );
  return assignment.id;
}

type GradeRow = {
  gradebookItemId: string;
  participantId: string;
  participantEmail: string;
  maxScore: number;
  score: number | null;
  gradeUpdatedAt: string | null;
};

async function loadGradeRow(api: APIRequestContext, courseId: string, groupId: string, activityId: string) {
  const { gradebook } = await responseJson<{ gradebook: { rows: GradeRow[] } }>(
    await api.get(`/api/courses/${courseId}/gradebook?groupId=${groupId}&activityId=${activityId}`)
  );
  const expectedEmail = process.env.E2E_STUDENT_EMAIL ?? "student@cognelo.local";
  const row = gradebook.rows.find((candidate) => candidate.participantEmail === expectedEmail);
  if (!row) throw new Error("The seed learner gradebook row was not found.");
  return row;
}

function gradeOverridePath(courseId: string, row: GradeRow) {
  return `/api/courses/${courseId}/gradebook/items/${row.gradebookItemId}/participants/${row.participantId}/override`;
}

function requireSuite(value: StaffSuite | undefined): StaffSuite {
  if (!value) throw new Error("The staff authorization suite was not provisioned.");
  return value;
}
