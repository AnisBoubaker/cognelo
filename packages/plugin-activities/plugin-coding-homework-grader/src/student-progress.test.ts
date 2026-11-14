import { describe, expect, it, vi } from "vitest";
vi.mock("./db-client", () => ({ prisma: { $queryRaw: vi.fn() } }));
import { homeworkStudentProgress, homeworkStudentProgressService } from "./student-progress";
import { prisma } from "./db-client";
describe("homework participation projection", () => {
  const base = { participantId: "p", groupId: "g", hasDraft: false, hasSubmission: false, status: null, questionsEnabled: true, answeringStarted: false };
  it("distinguishes preparation, frozen files, answering, and completion independently of grading", () => {
    expect(homeworkStudentProgress(base).state).toBe("not_started");
    expect(homeworkStudentProgress({ ...base, hasDraft: true })).toMatchObject({ state: "in_progress", stageId: "files" });
    for (const status of ["uploaded", "processing", "challenge_ready", "failed"]) expect(homeworkStudentProgress({ ...base, hasSubmission: true, status })).toMatchObject({ state: "stage_submitted", stageId: "files" });
    expect(homeworkStudentProgress({ ...base, hasSubmission: true, status: "challenge_ready", answeringStarted: true })).toMatchObject({ state: "in_progress", stageId: "questions" });
    for (const status of ["answered", "ready_for_grading", "graded"]) expect(homeworkStudentProgress({ ...base, hasSubmission: true, status, answeringStarted: true }).state).toBe("done");
    expect(homeworkStudentProgress({ ...base, hasSubmission: true, questionsEnabled: false, status: "ready_for_grading" }).state).toBe("done");
    expect(homeworkStudentProgress({ ...base, hasSubmission: false, status: "cancelled" }).state).toBe("not_started");
  });
  it("does not query an empty roster", async () => {
    expect(await homeworkStudentProgressService.getProgress({ participants: [] } as never)).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
