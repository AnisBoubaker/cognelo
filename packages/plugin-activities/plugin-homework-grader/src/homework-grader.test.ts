import { describe, expect, it } from "vitest";
import { homeworkGraderPlugin } from "./index";
import { homeworkGraderServerPlugin } from "./server";

describe("homework grader plugin manifest", () => {
  it("is registered as an incomplete no-op plugin safely", () => {
    expect(homeworkGraderPlugin.key).toBe("homework-grader");
    expect(homeworkGraderPlugin.activities[0]?.key).toBe("homework-grader");
    expect(homeworkGraderServerPlugin.routes).toEqual([]);
  });
});
