import { describe, expect, it } from "vitest";
import {
  ActivateAccountInputSchema,
  ActivityBankInputSchema,
  ActivityInputSchema,
  ActivityPluginInstallationUpdateSchema,
  AdminUserPasswordResetSchema,
  AiAgentConnectionInputSchema,
  AiAgentPreferencesInputSchema,
  ContentTypePluginInstallationUpdateSchema,
  BankActivityInputSchema,
  CourseGroupActivityInputSchema,
  CourseGroupInputSchema,
  CourseGroupUpdateSchema,
  CourseInputSchema,
  CourseUpdateSchema,
  CourseMaterialInputSchema,
  CourseMaterialUpdateSchema,
  EnrollmentInputSchema,
  EmailDeliveryConfigurationInputSchema,
  EmailTestInputSchema,
  LoginInputSchema,
  SubjectInputSchema,
  SubjectKnowledgeGraphGenerationInputSchema,
  SubjectUpdateSchema,
  TestCreateSchema,
  TestItemCreateSchema,
  UserPasswordChangeSchema,
  UserProfileUpdateSchema
} from "./index";

describe("shared contract schemas", () => {
  it("validates vendor-neutral and Microsoft institutional email routes", () => {
    expect(EmailDeliveryConfigurationInputSchema.parse({
      transport: "smtp",
      fromName: "Cognelo",
      fromEmail: "notify@example.test",
      smtpHost: "smtp.example.test",
      smtpPort: 587,
      smtpSecurity: "starttls"
    })).toMatchObject({ smtpUsername: "", smtpPassword: "" });
    expect(EmailDeliveryConfigurationInputSchema.parse({
      transport: "microsoft_graph",
      fromName: "Cognelo",
      fromEmail: "notify@institution.test",
      graphTenantId: "tenant-id",
      graphClientId: "client-id"
    })).toMatchObject({ graphClientSecret: "" });
    expect(() => EmailDeliveryConfigurationInputSchema.parse({
      transport: "microsoft_graph",
      fromName: "Cognelo",
      fromEmail: "invalid",
      graphTenantId: "tenant id",
      graphClientId: "client-id"
    })).toThrow();
    expect(EmailTestInputSchema.parse({ recipientEmail: "outside@gmail.com" })).toEqual({ recipientEmail: "outside@gmail.com" });
  });

  it("normalizes Test authoring defaults", () => {
    expect(TestCreateSchema.parse({ title: "Midterm" })).toMatchObject({
      title: "Midterm",
      description: "",
      lifecycle: "draft",
      settings: {
        timeLimitMinutes: null,
        navigationMode: "free",
        randomizeItems: false,
        allowResume: true
      }
    });
  });

  it("validates bank and local Test item sources", () => {
    expect(TestItemCreateSchema.parse({ source: "bank", bankActivityId: "bank-activity-1" })).toMatchObject({
      source: "bank",
      pointsPossible: 1,
      isRequired: true
    });
    expect(TestItemCreateSchema.parse({ source: "local", activityTypeKey: "mcq", title: "Question set" })).toMatchObject({
      source: "local",
      activityTypeKey: "mcq",
      config: {}
    });
    expect(() => TestItemCreateSchema.parse({ source: "bank", activityTypeKey: "mcq" })).toThrow();
  });
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

  it("accepts long student prompts for bank and course activities", () => {
    const description = "Long passage. ".repeat(500);

    expect(BankActivityInputSchema.parse({
      activityTypeKey: "mcq",
      title: "Reading comprehension",
      description
    }).description).toBe(description);
    expect(ActivityInputSchema.parse({
      activityTypeKey: "mcq",
      title: "Reading comprehension",
      description
    }).description).toBe(description);
  });

  it("accepts optional course content placement for activities and assignments", () => {
    expect(
      ActivityInputSchema.parse({
        activityTypeKey: "mcq",
        title: "Question set",
        contentPlacement: {
          parentId: "folder-1",
          isVisible: false
        }
      })
    ).toMatchObject({
      contentPlacement: {
        parentId: "folder-1",
        isVisible: false,
        metadata: {}
      }
    });

    expect(
      CourseGroupActivityInputSchema.parse({
        activityId: "activity-1",
        contentPlacement: {
          parentId: "folder-1"
        }
      })
    ).toMatchObject({
      contentPlacement: {
        parentId: "folder-1",
        isVisible: true,
        metadata: {}
      }
    });
  });

  it("allows URL-backed course materials to be created before they are configured", () => {
    expect(
      CourseMaterialInputSchema.parse({
        title: "Repository",
        kind: "github_repo"
      })
    ).toMatchObject({
      title: "Repository",
      kind: "github_repo"
    });
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

  it("validates password changes", () => {
    expect(
      UserPasswordChangeSchema.parse({
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword456!",
        confirmNewPassword: "NewPassword456!"
      })
    ).toEqual({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      confirmNewPassword: "NewPassword456!"
    });
    expect(() =>
      UserPasswordChangeSchema.parse({
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword456!",
        confirmNewPassword: "DifferentPassword!"
      })
    ).toThrow();
    expect(() =>
      UserPasswordChangeSchema.parse({
        currentPassword: "SamePassword123!",
        newPassword: "SamePassword123!",
        confirmNewPassword: "SamePassword123!"
      })
    ).toThrow();
  });

  it("validates matching administrator temporary passwords", () => {
    expect(AdminUserPasswordResetSchema.parse({
      password: "Temporary123!",
      confirmPassword: "Temporary123!"
    })).toEqual({ password: "Temporary123!", confirmPassword: "Temporary123!" });
    expect(() => AdminUserPasswordResetSchema.parse({
      password: "Temporary123!",
      confirmPassword: "Different123!"
    })).toThrow();
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
    expect(ContentTypePluginInstallationUpdateSchema.parse({ isEnabled: false })).toEqual({ isEnabled: false });
  });

  it("validates course, subject, bank, group, activity, and enrollment defaults", () => {
    expect(CourseInputSchema.parse({ subjectId: "subject-1", title: "Programming" })).toMatchObject({
      description: "",
      status: "draft"
    });
    expect(CourseUpdateSchema.parse({ studentContentLayout: "folder_tabs" })).toEqual({
      studentContentLayout: "folder_tabs"
    });
    expect(SubjectInputSchema.parse({ title: "Math" })).toMatchObject({ description: "", teachingLanguage: "en", metadata: {} });
    expect(() => SubjectInputSchema.parse({ title: "Math", teachingLanguage: "es" })).toThrow();
    expect(SubjectKnowledgeGraphGenerationInputSchema.parse({ description: "A detailed mathematics curriculum." })).toEqual({
      description: "A detailed mathematics curriculum.",
      directions: "",
      maxConcepts: 12,
      mode: "new"
    });
    expect(() => SubjectKnowledgeGraphGenerationInputSchema.parse({ description: "Too short", maxConcepts: 51 })).toThrow();
    expect(() => SubjectKnowledgeGraphGenerationInputSchema.parse({
      description: "A detailed mathematics curriculum.",
      teachingLanguage: "es"
    })).toThrow();
    expect(() => SubjectKnowledgeGraphGenerationInputSchema.parse({
      description: "A detailed mathematics curriculum.",
      mode: "iterate"
    })).toThrow();
    expect(SubjectKnowledgeGraphGenerationInputSchema.parse({
      description: "A detailed mathematics curriculum.",
      mode: "iterate",
      existingGraph: {
        concepts: [{ id: "variables", title: "Variables", skills: "Declare a variable", positionX: 0, positionY: 0 }],
        prerequisites: []
      }
    }).mode).toBe("iterate");
    expect(SubjectUpdateSchema.parse({
      knowledgeGraph: {
        concepts: [
          { id: "variables", title: "Variables", skills: "Declare a variable", positionX: 10, positionY: 20 },
          { id: "loops", title: "Loops", skills: "Write a counted loop", positionX: 40, positionY: 80 }
        ],
        prerequisites: [{ id: "loops-variables", sourceConceptId: "loops", requiredConceptId: "variables" }]
      }
    }).knowledgeGraph?.concepts).toHaveLength(2);
    expect(SubjectUpdateSchema.parse({
      knowledgeGraph: {
        concepts: [{ id: "variables", title: "Variables", skills: "  Declare a variable  \n\nAssign a value  ", positionX: 0, positionY: 0 }],
        prerequisites: []
      }
    }).knowledgeGraph?.concepts[0]?.skills).toBe("Declare a variable\nAssign a value");
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
    expect(BankActivityInputSchema.parse({ activityTypeKey: "mcq", title: "Quiz", knowledgeConceptIds: ["concept-1"] }).knowledgeConceptIds).toEqual(["concept-1"]);
    expect(() => BankActivityInputSchema.parse({ activityTypeKey: "mcq", title: "Quiz", knowledgeConceptIds: ["concept-1", "concept-1"] })).toThrow();
    expect(BankActivityInputSchema.parse({
      activityTypeKey: "mcq",
      title: "Quiz",
      knowledgeConceptSelections: [{ conceptId: "concept-1", selectsAllSkills: false, selectedSkills: ["Apply the rule"] }]
    }).knowledgeConceptSelections).toHaveLength(1);
    expect(() => BankActivityInputSchema.parse({
      activityTypeKey: "mcq",
      title: "Quiz",
      knowledgeConceptSelections: [{ conceptId: "concept-1", selectsAllSkills: false, selectedSkills: [] }]
    })).toThrow();
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
