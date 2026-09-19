import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  activityAttempt: { findFirst: vi.fn() },
  grade: { findUnique: vi.fn() },
  gradeChallenge: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  courseGroupParticipant: { findMany: vi.fn() },
  activity: { findMany: vi.fn() },
  courseGroup: { findMany: vi.fn() }
}));
const recordResearch = vi.hoisted(() => vi.fn());

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("./authorization", () => ({ assertCanManageCourse: vi.fn() }));
vi.mock("./ai-feedback", () => ({ recordAiFeedbackResearchEvent: recordResearch }));
vi.mock("./gradebook", () => ({ overrideGradebookGrade: vi.fn() }));

const { createGradeChallenge } = await import("./grade-challenges");

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

describe("grade challenges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.activityAttempt.findFirst.mockResolvedValue(attempt);
    mockPrisma.grade.findUnique.mockResolvedValue(grade);
    mockPrisma.gradeChallenge.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "challenge-1", ...data }));
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
});
