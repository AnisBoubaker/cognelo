import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  activityAttempt: { findFirst: vi.fn() },
  grade: { findUnique: vi.fn(), update: vi.fn() },
  gradeChallenge: { findFirst: vi.fn() },
  gradeEvent: { create: vi.fn() },
  aiFeedbackResearchEvent: { create: vi.fn() },
  $transaction: vi.fn()
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma }));
vi.mock("./authorization", () => ({
  assertCanManageCourse: vi.fn(),
  assertCanViewCourse: vi.fn()
}));

const { getTeacherAttemptAiFeedbackReview, reviseTeacherAttemptAiFeedback } = await import("./ai-feedback");

const teacher: CurrentUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: "Teacher",
  firstName: "Tea",
  lastName: "Cher",
  roles: ["teacher"]
};

const currentFeedback = {
  kind: "ai_assessment_feedback",
  summary: "Original summary",
  strengths: ["Clear structure"],
  improvements: ["Add validation"],
  criteria: [{ id: "quality", title: "Quality", scorePercent: 80, feedback: "Good" }],
  feedbackRef: "evaluation-1",
  feedbackVersion: 1,
  feedbackHash: "original-hash",
  challengeAllowed: true
};

describe("teacher AI feedback review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma));
    mockPrisma.activityAttempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      courseId: "course-1",
      groupId: "group-1",
      groupActivityId: "assignment-1",
      activityId: "activity-1",
      gradebookItemId: "item-1",
      participantId: "participant-1",
      userId: "student-1",
      pluginKey: "coding-exercise",
      gradebookItem: { id: "item-1", gradesReleased: false },
      participant: { id: "participant-1", firstName: "Student", lastName: "One", email: "student@example.test" }
    });
    mockPrisma.grade.findUnique.mockResolvedValue({
      id: "grade-1",
      selectedAttemptId: "attempt-1",
      rawScore: 80,
      rawMaxScore: 100,
      normalizedScore: 80,
      normalizedMaxScore: 100,
      isPass: true,
      source: "auto",
      normalizedResult: { studentFeedback: currentFeedback },
      metadata: {}
    });
    mockPrisma.gradeChallenge.findFirst.mockResolvedValue(null);
    mockPrisma.grade.update.mockResolvedValue({ id: "grade-1" });
    mockPrisma.gradeEvent.create.mockResolvedValue({ id: "event-1" });
    mockPrisma.aiFeedbackResearchEvent.create.mockResolvedValue({ id: "research-1" });
  });

  it("returns the selected attempt feedback to an authorized teacher", async () => {
    const result = await getTeacherAttemptAiFeedbackReview(teacher, "course-1", "attempt-1");
    expect(result).toMatchObject({
      attemptId: "attempt-1",
      participant: { name: "Student One" },
      feedback: { feedbackRef: "evaluation-1", summary: "Original summary" }
    });
  });

  it("can review a legacy canonical student-feedback envelope", async () => {
    mockPrisma.grade.findUnique.mockResolvedValue({
      id: "grade-1",
      selectedAttemptId: "attempt-1",
      rawScore: 80,
      rawMaxScore: 100,
      normalizedScore: 80,
      normalizedMaxScore: 100,
      isPass: true,
      source: "override",
      normalizedResult: {
        studentFeedback: {
          kind: "ai_assessment_feedback",
          feedbackText: null,
          details: currentFeedback
        }
      },
      metadata: {}
    });
    await expect(getTeacherAttemptAiFeedbackReview(teacher, "course-1", "attempt-1")).resolves.toMatchObject({
      feedback: { feedbackRef: "evaluation-1", summary: "Original summary" }
    });
  });

  it("stores a teacher revision without replacing the original grading result", async () => {
    const result = await reviseTeacherAttemptAiFeedback(teacher, "course-1", "attempt-1", {
      ...currentFeedback,
      summary: "Reviewed summary",
      feedbackHash: "client-cannot-control-this"
    });

    expect(result).toMatchObject({ feedback: { summary: "Reviewed summary", teacherRevision: 1, reviewedByTeacher: true } });
    expect(result.feedback.feedbackHash).not.toBe("client-cannot-control-this");
    expect(mockPrisma.grade.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        normalizedResult: expect.objectContaining({
          studentFeedback: expect.objectContaining({ summary: "Reviewed summary", feedbackRef: "evaluation-1" })
        })
      })
    }));
    expect(mockPrisma.gradeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "ai_feedback_recorded", metadata: expect.objectContaining({ action: "teacher_revision" }) })
    });
    expect(mockPrisma.aiFeedbackResearchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "feedback_teacher_revised", triggerKind: "teacher_feedback_review" })
    });
  });

  it("preserves the challenged feedback snapshot", async () => {
    mockPrisma.gradeChallenge.findFirst.mockResolvedValue({ id: "challenge-1" });
    await expect(reviseTeacherAttemptAiFeedback(teacher, "course-1", "attempt-1", currentFeedback))
      .rejects.toMatchObject({ code: "AI_FEEDBACK_ALREADY_CHALLENGED" });
    expect(mockPrisma.grade.update).not.toHaveBeenCalled();
  });
});
