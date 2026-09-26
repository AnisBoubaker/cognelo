import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  activityAttempt: { findFirst: vi.fn() },
  grade: { findUnique: vi.fn() },
  gradeChallenge: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  courseGroupParticipant: { findMany: vi.fn(), findFirst: vi.fn() },
  activity: { findMany: vi.fn(), findUnique: vi.fn() },
  courseGroup: { findMany: vi.fn() },
  gradebookItem: { findMany: vi.fn() },
  course: { findUnique: vi.fn() }
}));
const recordResearch = vi.hoisted(() => vi.fn());

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("./authorization", () => ({ assertCanManageCourse: vi.fn() }));
vi.mock("./ai-feedback", () => ({ recordAiFeedbackResearchEvent: recordResearch }));
const { createGradeChallenge, listCourseGradeChallenges, resolveGradeChallenge } = await import("./grade-challenges");

const student: CurrentUser = {
  id: "student-1",
  email: "student@example.test",
  name: "Student One",
  firstName: "Student",
  lastName: "One",
  roles: ["student"]
};

const attempt = {
  id: "attempt-1",
  courseId: "course-1",
  groupId: "group-1",
  activityId: "test-activity",
  groupActivityId: "assignment-1",
  gradebookItemId: "item-1",
  participantId: "participant-1",
  userId: "student-1",
  pluginKey: "core-test-runtime",
  participant: { userId: "student-1" },
  gradebookItem: { gradesReleased: true },
  activity: { activityType: { key: "test" } }
};

const grade = {
  id: "grade-1",
  rawScore: 8,
  rawMaxScore: 10,
  normalizedScore: 80,
  normalizedMaxScore: 100,
  source: "auto",
  gradedAt: new Date("2026-09-19T12:00:00.000Z"),
  normalizedResult: {
    studentFeedback: {
      kind: "test",
      details: {
        items: [
          {
            testItemId: "test-item-1",
            activityId: "mcq-activity",
            activityTypeKey: "mcq",
            feedback: { aiFeedback: { feedbackRef: "feedback-1", feedbackVersion: 1, challengeAllowed: false } }
          },
          {
            testItemId: "test-item-2",
            activityId: "coding-activity",
            activityTypeKey: "coding-exercise",
            feedback: {
              aiFeedback: {
                feedbackRef: "feedback-2",
                feedbackVersion: 3,
                feedbackHash: "hash-2",
                challengeAllowed: true
              }
            }
          }
        ]
      }
    }
  }
};

const openChallenge = {
  id: "challenge-1",
  courseId: "course-1",
  groupId: "group-1",
  activityId: "coding-activity",
  groupActivityId: "assignment-1",
  gradebookItemId: "item-1",
  participantId: "participant-1",
  userId: "student-1",
  attemptId: "attempt-1",
  pluginKey: "coding-exercise",
  feedbackRef: "feedback-2",
  feedbackVersion: 3,
  feedbackHash: "hash-2",
  releasedGradeSnapshot: {
    normalizedScore: 80,
    normalizedMaxScore: 100
  },
  explanation: "The rubric interpretation does not match my submitted implementation.",
  status: "open"
};

describe("grade challenges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.activityAttempt.findFirst.mockResolvedValue(attempt);
    mockPrisma.grade.findUnique.mockResolvedValue(grade);
    mockPrisma.gradeChallenge.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "challenge-1", ...data }));
    mockPrisma.gradeChallenge.findFirst.mockResolvedValue(openChallenge);
    mockPrisma.gradeChallenge.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...openChallenge, ...data }));
    mockPrisma.courseGroupParticipant.findMany.mockResolvedValue([]);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.courseGroup.findMany.mockResolvedValue([]);
    mockPrisma.gradebookItem.findMany.mockResolvedValue([]);
  });

  it("targets the exact challengeable Compound Test child feedback version", async () => {
    await expect(createGradeChallenge(student, "course-1", "attempt-1", {
      feedbackRef: "feedback-2",
      feedbackVersion: 3,
      explanation: "The rubric interpretation does not match my submitted implementation."
    })).resolves.toMatchObject({
      id: "challenge-1",
      activityId: "coding-activity",
      pluginKey: "coding-exercise"
    });

    expect(mockPrisma.gradeChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityId: "coding-activity",
        pluginKey: "coding-exercise",
        feedbackHash: "hash-2",
        metadata: expect.objectContaining({ testItemId: "test-item-2", rootActivityId: "test-activity" })
      })
    });
    expect(recordResearch).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "challenge_opened",
      activityId: "coding-activity",
      pluginKey: "coding-exercise",
      feedbackRef: "feedback-2",
      feedbackVersion: 3
    }));
  });

  it("rejects feedback-only AI explanations that did not influence the grade", async () => {
    await expect(createGradeChallenge(student, "course-1", "attempt-1", {
      feedbackRef: "feedback-1",
      feedbackVersion: 1,
      explanation: "I would like this explanation reviewed even though it did not affect the score."
    })).rejects.toMatchObject({ code: "AI_FEEDBACK_VERSION_MISMATCH", status: 409 });

    expect(mockPrisma.gradeChallenge.create).not.toHaveBeenCalled();
  });

  it("recognizes challengeable feedback preserved in a canonical details envelope", async () => {
    mockPrisma.grade.findUnique.mockResolvedValue({
      ...grade,
      normalizedResult: {
        studentFeedback: {
          kind: "ai_assessment_feedback",
          feedbackText: null,
          details: {
            feedbackRef: "feedback-3",
            feedbackVersion: 2,
            feedbackHash: "hash-3",
            challengeAllowed: true,
            summary: "Reviewed feedback"
          }
        }
      }
    });

    await expect(createGradeChallenge(student, "course-1", "attempt-1", {
      feedbackRef: "feedback-3",
      feedbackVersion: 2,
      explanation: "The released rubric feedback does not match the submitted answer."
    })).resolves.toMatchObject({ feedbackHash: "hash-3" });
  });

  it("returns the root gradebook activity used by Review and grade", async () => {
    mockPrisma.gradeChallenge.findMany.mockResolvedValue([openChallenge]);
    mockPrisma.courseGroupParticipant.findMany.mockResolvedValue([{
      id: "participant-1",
      user: { name: "Student One", email: "student@example.test" }
    }]);
    mockPrisma.activity.findMany.mockResolvedValue([{ id: "coding-activity", title: "Loops exercise" }]);
    mockPrisma.courseGroup.findMany.mockResolvedValue([{ id: "group-1", title: "Section 1" }]);
    mockPrisma.gradebookItem.findMany.mockResolvedValue([{ id: "item-1", activityId: "test-activity" }]);

    await expect(listCourseGradeChallenges({ id: "teacher-1", roles: ["teacher"] } as CurrentUser, "course-1"))
      .resolves.toEqual([expect.objectContaining({
        activityTitle: "Loops exercise",
        participantName: "Student One",
        reviewActivityId: "test-activity"
      })]);
  });

  it("sends a response without changing the grade from the challenge endpoint", async () => {
    const deliver = vi.fn();
    mockPrisma.grade.findUnique.mockResolvedValue({ ...grade, normalizedScore: 90 });
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue({ email: "student@example.test" });
    mockPrisma.activity.findUnique.mockResolvedValue({ title: "Loops exercise" });
    mockPrisma.course.findUnique.mockResolvedValue({ title: "Programming 101" });

    await expect(resolveGradeChallenge(
      { id: "teacher-1", roles: ["teacher"] } as CurrentUser,
      "course-1",
      "challenge-1",
      { teacherResponse: "I reviewed your work and updated the rubric score.", notifyStudent: true },
      "11".repeat(32),
      { deliver }
    )).resolves.toMatchObject({
      status: "adjusted",
      teacherResponse: "I reviewed your work and updated the rubric score.",
      notificationSent: true,
      resultingGradeSnapshot: expect.objectContaining({ normalizedScore: 90 })
    });

    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: "student@example.test",
      subject: "Response to your grade challenge in Programming 101"
    }), "11".repeat(32));
    expect(recordResearch).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "challenge_adjusted",
      metadata: expect.objectContaining({ gradeAdjusted: true, studentNotified: true })
    }));
  });

  it("records an upheld response when Review and grade left the score unchanged", async () => {
    await expect(resolveGradeChallenge(
      { id: "teacher-1", roles: ["teacher"] } as CurrentUser,
      "course-1",
      "challenge-1",
      { teacherResponse: "I reviewed your work and the released grade remains correct.", notifyStudent: false }
    )).resolves.toMatchObject({ status: "upheld", notificationSent: false });

    expect(mockPrisma.gradeChallenge.update).toHaveBeenCalledWith({
      where: { id: "challenge-1" },
      data: expect.objectContaining({ status: "upheld" })
    });
  });
});
