import { describe, expect, it } from "vitest";
import { getAuthenticatedLandingPath, getPrimaryLandingPath } from "./navigation";

describe("primary landing navigation", () => {
  it.each(["admin", "course_manager", "teacher"] as const)("sends %s users to Subjects", (role) => {
    expect(getPrimaryLandingPath({ roles: [role] })).toBe("/subjects");
  });

  it("sends students to Courses", () => {
    expect(getPrimaryLandingPath({ roles: ["student"] })).toBe("/courses");
  });

  it("prioritizes password replacement and then email verification", () => {
    expect(getAuthenticatedLandingPath({ roles: ["student"], mustChangePassword: true, emailVerified: false })).toBe("/change-password");
    expect(getAuthenticatedLandingPath({ roles: ["student"], mustChangePassword: false, emailVerified: false })).toBe("/verify-email");
    expect(getAuthenticatedLandingPath({ roles: ["student"], mustChangePassword: false, emailVerified: true })).toBe("/courses");
  });
});
