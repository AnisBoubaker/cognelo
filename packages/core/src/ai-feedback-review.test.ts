import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  activityAttempt: { findFirst: vi.fn(), update: vi.fn() },
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
      lifecycle: "submitted",
      metadata: {},
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
    mockPrisma.activityAttempt.update.mockResolvedValue({ id: "attempt-1" });
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

  it("returns an empty feedback slot when the submission has not been graded or reviewed", async () => {
    mockPrisma.grade.findUnique.mockResolvedValue(null);

    await expect(getTeacherAttemptAiFeedbackReview(teacher, "course-1", "attempt-1")).resolves.toMatchObject({
      attemptId: "attempt-1",
      gradeId: null,
      feedback: null
    });
  });

  it("does not open feedback before the learner submits", async () => {
    mockPrisma.activityAttempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      lifecycle: "started"
    });

    await expect(getTeacherAttemptAiFeedbackReview(teacher, "course-1", "attempt-1"))
      .rejects.toMatchObject({ code: "FEEDBACK_SUBMISSION_REQUIRED" });
  });

  it("stores teacher-authored feedback on an ungraded submission", async () => {
    mockPrisma.grade.findUnique.mockResolvedValue(null);

    const result = await reviseTeacherAttemptAiFeedback(teacher, "course-1", "attempt-1", {
      kind: "assessment_feedback",
      summary: "Check the boundary condition.",
      strengths: [],
      improvements: ["Trace the equal-value case."],
      criteria: []
    });

    expect(result).toMatchObject({
      feedback: {
        kind: "assessment_feedback",
        feedbackOrigin: "teacher",
        feedbackRef: "teacher-feedback:attempt-1",
        feedbackVersion: 1,
        challengeAllowed: false,
        summary: "Check the boundary condition.",
        authoredByTeacher: true
      }
    });
    expect(mockPrisma.activityAttempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: {
        metadata: expect.objectContaining({
          teacherFeedback: expect.objectContaining({
            feedbackRef: "teacher-feedback:attempt-1",
            summary: "Check the boundary condition."
          })
        })
      }
    });
    expect(mockPrisma.grade.update).not.toHaveBeenCalled();
    expect(mockPrisma.gradeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gradeId: null,
        metadata: expect.objectContaining({ action: "teacher_authored" })
      })
    });
    expect(mockPrisma.aiFeedbackResearchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "feedback_teacher_authored" })
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

  it("audits a teacher revision made after the feedback was challenged", async () => {
    mockPrisma.gradeChallenge.findFirst.mockResolvedValue({ id: "challenge-1" });
    await expect(reviseTeacherAttemptAiFeedback(teacher, "course-1", "attempt-1", {
      ...currentFeedback,
      summary: "Reviewed after the challenge"
    })).resolves.toMatchObject({
      feedback: { summary: "Reviewed after the challenge", teacherRevision: 1 }
    });
    expect(mockPrisma.grade.update).toHaveBeenCalled();
    expect(mockPrisma.gradeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousValue: expect.objectContaining({
          studentFeedback: expect.objectContaining({ feedbackHash: "original-hash" })
        }),
        metadata: expect.objectContaining({
          gradeChallengeId: "challenge-1",
          challengedFeedbackRevision: true,
          previousFeedbackHash: "original-hash"
        })
      })
    });
    expect(mockPrisma.aiFeedbackResearchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ gradeChallengeId: "challenge-1", challengedFeedbackRevision: true })
      })
    });
  });
});
