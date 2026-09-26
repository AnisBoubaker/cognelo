import { describe, expect, it } from "vitest";
import { getAuthenticatedLandingPath, getPrimaryLandingPath, resolveCourseWorkspaceTab } from "./navigation";

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

describe("course workspace navigation", () => {
  it.each(["content", "participants", "gradebook", "challenges", "settings"] as const)(
    "opens the %s tab requested by the URL",
    (tab) => {
      expect(resolveCourseWorkspaceTab(tab)).toBe(tab);
    }
  );

  it("keeps the legacy groups URL mapped to participants", () => {
    expect(resolveCourseWorkspaceTab("groups")).toBe("participants");
  });

  it("defaults unknown and missing tabs to course content", () => {
    expect(resolveCourseWorkspaceTab("unknown")).toBe("content");
    expect(resolveCourseWorkspaceTab(null)).toBe("content");
  });
});
