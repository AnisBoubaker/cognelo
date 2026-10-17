import { describe, expect, it } from "vitest";
import type { CourseGradebookRow } from "./api";
import { deletableSubmissions } from "./submission-deletion";

function attempt(id: string, number: number, lifecycle: CourseGradebookRow["attempts"][number]["lifecycle"], assessmentMode: "formative" | "summative" = "summative"): CourseGradebookRow["attempts"][number] {
  return { id, attemptNumber: number, lifecycle, assessmentMode, pluginAttemptRef: null, startedAt: "2026-10-17T12:00:00Z", submittedAt: null, gradedAt: null, isLate: false, lateBySeconds: null, durationSeconds: null };
}

describe("deletable submissions", () => {
  it("offers completed current-mode submissions newest first, without modifying the row", () => {
    const attempts = [attempt("first", 1, "graded"), attempt("open", 4, "started"), attempt("deleted", 3, "deleted"), attempt("second", 2, "submitted"), attempt("practice", 5, "submitted", "formative")];
    const originalOrder = attempts.map((item) => item.id);
    expect(deletableSubmissions({ assessmentMode: "summative", attempts }).map((item) => item.id)).toEqual(["second", "first"]);
    expect(attempts.map((item) => item.id)).toEqual(originalOrder);
  });

  it("includes formative submissions without requiring a plugin reference or a grade", () => {
    const submitted = attempt("formative", 1, "submitted", "formative");
    expect(deletableSubmissions({ assessmentMode: "formative", attempts: [submitted, attempt("summative", 2, "graded")] })).toEqual([submitted]);
  });

  it("does not offer a deletion when the student never submitted", () => {
    expect(deletableSubmissions({ assessmentMode: "summative", attempts: [attempt("open", 1, "started")] })).toEqual([]);
    expect(deletableSubmissions({ assessmentMode: "summative", attempts: [] })).toEqual([]);
  });
});
