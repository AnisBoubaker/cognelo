import { describe, expect, it } from "vitest";
import {
  ActivateAccountInputSchema,
  ActivityBankInputSchema,
  ActivityInputSchema,
  ActivityPluginInstallationUpdateSchema,
  AiAgentConnectionInputSchema,
  AiAgentPreferencesInputSchema,
  BankActivityInputSchema,
  CourseGroupActivityInputSchema,
  CourseGroupInputSchema,
  CourseGroupUpdateSchema,
  CourseInputSchema,
  CourseMaterialInputSchema,
  CourseMaterialUpdateSchema,
  EnrollmentInputSchema,
  LoginInputSchema,
  SubjectInputSchema,
  UserProfileUpdateSchema
} from "./index";

describe("shared contract schemas", () => {
  it("normalizes activity input defaults", () => {
    expect(
      ActivityInputSchema.parse({
        activityTypeKey: "mcq",
        title: "Question set"
      })
    ).toMatchObject({
      activityTypeKey: "mcq",
      title: "Question set",
      description: "",
      lifecycle: "draft",
      config: {},
      metadata: {},
      position: 0
    });
  });

  it("requires URLs for URL-backed course materials on create", () => {
    expect(() =>
      CourseMaterialInputSchema.parse({
        title: "Repository",
        kind: "github_repo"
      })
    ).toThrow();
  });

  it("restricts github repository materials to github.com URLs", () => {
    expect(() =>
      CourseMaterialUpdateSchema.parse({
        kind: "github_repo",
        url: "https://example.com/org/repo"
      })
    ).toThrow();

    expect(
      CourseMaterialUpdateSchema.parse({
        kind: "github_repo",
        url: "https://github.com/org/repo"
      })
    ).toMatchObject({ url: "https://github.com/org/repo" });
  });

  it("rejects group availability windows that end before they start", () => {
    expect(() =>
      CourseGroupUpdateSchema.parse({
        availableFrom: "2026-05-14T10:00:00.000Z",
        availableUntil: "2026-05-14T09:00:00.000Z"
      })
    ).toThrow();
  });

  it("trims profile names", () => {
    expect(UserProfileUpdateSchema.parse({ firstName: " Ada ", lastName: " Lovelace " })).toEqual({
      firstName: "Ada",
      lastName: "Lovelace"
    });
  });

  it("validates auth and activation payloads", () => {
    expect(LoginInputSchema.parse({ email: "teacher@example.test", password: "Password123!" })).toEqual({
      email: "teacher@example.test",
      password: "Password123!"
    });

    expect(() =>
      ActivateAccountInputSchema.parse({
        email: "student@example.test",
        password: "Password123!",
        confirmPassword: "Different123!"
      })
    ).toThrow();
  });

  it("validates AI agent and plugin installation payloads", () => {
    expect(
      AiAgentConnectionInputSchema.parse({
        scope: "personal",
        provider: "openai",
        displayName: "OpenAI",
        model: "gpt-4.1-mini"
      })
    ).toMatchObject({ isEnabled: true });

    expect(
      AiAgentPreferencesInputSchema.parse({
        questionAuthoringAiAgentConnectionId: null
      })
    ).toEqual({ questionAuthoringAiAgentConnectionId: null });

    expect(ActivityPluginInstallationUpdateSchema.parse({ action: "activate", restoreBackupId: null })).toEqual({
      action: "activate",
      restoreBackupId: null
    });
  });

  it("validates course, subject, bank, group, activity, and enrollment defaults", () => {
    expect(CourseInputSchema.parse({ subjectId: "subject-1", title: "Programming" })).toMatchObject({
      description: "",
      status: "draft"
    });
    expect(SubjectInputSchema.parse({ title: "Math" })).toMatchObject({ description: "", metadata: {} });
    expect(ActivityBankInputSchema.parse({ subjectId: "subject-1", title: "Bank" })).toMatchObject({
      description: "",
      metadata: {}
    });
    expect(BankActivityInputSchema.parse({ activityTypeKey: "mcq", title: "Quiz" })).toMatchObject({
      lifecycle: "draft",
      config: {},
      metadata: {},
      position: 0
    });
    expect(CourseGroupInputSchema.parse({ title: "Group" })).toMatchObject({ title: "Group" });
    expect(CourseGroupActivityInputSchema.parse({ activityId: "activity-1" })).toMatchObject({
      activityId: "activity-1",
      config: {},
      metadata: {},
      position: 0
    });
    expect(EnrollmentInputSchema.parse({ userId: "user-1", role: "student" })).toEqual({ userId: "user-1", role: "student" });
  });
});
