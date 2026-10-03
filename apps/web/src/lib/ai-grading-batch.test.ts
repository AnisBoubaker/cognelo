import { describe, expect, it } from "vitest";
import { excludeAiGradingTemplateTargets } from "./ai-grading-batch";

describe("guided AI grading batches", () => {
  it("never includes selected grading templates among the attempts to regrade", () => {
    const targets = ["attempt-1", "attempt-2", "attempt-3"].map((id) => ({ attempt: { id } }));
    expect(excludeAiGradingTemplateTargets(targets, ["attempt-1", "attempt-3"])).toEqual([
      { attempt: { id: "attempt-2" } }
    ]);
  });
});
