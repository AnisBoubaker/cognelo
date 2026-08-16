import { describe, expect, it } from "vitest";
import { getPrimaryLandingPath } from "./navigation";

describe("primary landing navigation", () => {
  it.each(["admin", "course_manager", "teacher"] as const)("sends %s users to Subjects", (role) => {
    expect(getPrimaryLandingPath({ roles: [role] })).toBe("/subjects");
  });

  it("sends students to Courses", () => {
    expect(getPrimaryLandingPath({ roles: ["student"] })).toBe("/courses");
  });
});
