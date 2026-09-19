import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  activityAttempt: { findFirst: vi.fn() },
  grade: { findUnique: vi.fn() },
  aiFeedbackResearchEvent: { create: vi.fn() }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma }));
vi.mock("./authorization", () => ({
  assertCanViewCourse: vi.fn(),
  canManageCourse: vi.fn(),
  isAdmin: vi.fn()
}));

const { recordReleasedAttemptAiFeedbackViewed } = await import("./gradebook");

const student: CurrentUser = {
  id: "student-1",
  email: "student@example.test",
  name: "Student One",
  firstName: "Student",
  lastName: "One",
  roles: ["student"]
};

describe("AI feedback view research events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.activityAttempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      courseId: "course-1",
      groupId: "group-1",
      groupActivityId: "assignment-1",
      activityId: "test-activity",
      gradebookItemId: "item-1",
      participantId: "participant-1",
      pluginKey: "core-test-runtime",
      participant: { userId: "student-1" },
      gradebookItem: { id: "item-1", gradesReleased: true }
    });
    mockPrisma.grade.findUnique.mockResolvedValue({
      id: "grade-1",
      selectedAttemptId: "attempt-1",
      normalizedResult: {
        studentFeedback: {
          kind: "test",
          details: {
            items: [
              {
                testItemId: "child-1",
                activityId: "coding-1",
                activityTypeKey: "coding-exercise",
                feedback: { aiFeedback: { feedbackRef: "evaluation-1", feedbackVersion: 1 } }
              },
              {
                testItemId: "child-2",
                activityId: "mcq-1",
                activityTypeKey: "mcq",
                feedback: { aiFeedback: { feedbackRef: "evaluation-2", feedbackVersion: 2 } }
              }
            ]
          }
        }
      }
    });
    mockPrisma.aiFeedbackResearchEvent.create.mockResolvedValue({ id: "event-1" });
  });

  it("records one explicit view event for every released Compound Test child feedback", async () => {
    await expect(recordReleasedAttemptAiFeedbackViewed(student, "course-1", "attempt-1")).resolves.toEqual({ recorded: 2 });

    expect(mockPrisma.aiFeedbackResearchEvent.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.aiFeedbackResearchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "feedback_viewed",
        activityId: "coding-1",
        pluginKey: "coding-exercise",
        feedbackRef: "evaluation-1",
        triggerKind: "student_feedback_view",
        metadata: expect.objectContaining({ testItemId: "child-1" })
      })
    });
  });

  it("rejects view recording before release", async () => {
    mockPrisma.activityAttempt.findFirst.mockResolvedValue({
      ...(await mockPrisma.activityAttempt.findFirst()),
      gradebookItem: { id: "item-1", gradesReleased: false }
    });

    await expect(recordReleasedAttemptAiFeedbackViewed(student, "course-1", "attempt-1"))
      .rejects.toMatchObject({ code: "GRADE_NOT_RELEASED" });
    expect(mockPrisma.aiFeedbackResearchEvent.create).not.toHaveBeenCalled();
  });
});
