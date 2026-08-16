import { describe, expect, it } from "vitest";
import { buildContextualLineDiff } from "./activity-version-diff-view";

describe("buildContextualLineDiff", () => {
  it("preserves line boundaries and limits output to nearby context", () => {
    const before = ["## Question 1", "answer 1", "## Question 2", "answer 2", "## Question 3", "answer 3", "## Question 4", "answer 4"].join("\n");
    const after = before.replace("answer 3", "answer 3 changed");
    const hunks = buildContextualLineDiff(before, after, 1);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toEqual([
      { kind: "context", text: "## Question 3" },
      { kind: "removed", text: "answer 3" },
      { kind: "added", text: "answer 3 changed" }
    ]);
    expect(hunks[0].some((line) => line.text.includes("Question 1"))).toBe(false);
  });

  it("normalizes carriage returns without collapsing lines", () => {
    expect(buildContextualLineDiff("first\r\nsecond", "first\r\nchanged", 0)).toEqual([[
      { kind: "removed", text: "second" },
      { kind: "added", text: "changed" }
    ]]);
  });

  it("expands Markdown question changes to the containing question only", () => {
    const before = ["## Question 1", "choice a", "choice b", "choice c", "## Question 2", "choice d", "choice e", "choice f", "## Question 3", "choice g"].join("\n");
    const after = before.replace("choice e", "choice e changed");
    const output = buildContextualLineDiff(before, after, 1).flat().map((line) => line.text);
    expect(output).toContain("## Question 2");
    expect(output).toContain("choice f");
    expect(output).not.toContain("## Question 1");
    expect(output).not.toContain("## Question 3");
  });
});
