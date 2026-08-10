import { z } from "zod";

export const RoleKeySchema = z.enum(["admin", "course_manager", "teacher", "student"]);
export type RoleKey = z.infer<typeof RoleKeySchema>;

export const CourseStatusSchema = z.enum(["draft", "published", "archived"]);
export type CourseStatus = z.infer<typeof CourseStatusSchema>;

export const CourseMembershipRoleSchema = z.enum(["owner", "teacher", "ta", "student"]);
export type CourseMembershipRole = z.infer<typeof CourseMembershipRoleSchema>;

export const MaterialKindSchema = z.enum([
  "folder",
  "text",
  "markdown",
  "pdf",
  "link",
  "github_repo",
  "code_example",
  "dataset",
  "file",
  "module"
]);
export type MaterialKind = z.infer<typeof MaterialKindSchema>;

export const ActivityLifecycleSchema = z.enum(["draft", "published", "paused", "archived"]);
export type ActivityLifecycle = z.infer<typeof ActivityLifecycleSchema>;

export const CourseGroupStatusSchema = z.enum(["draft", "published"]);
export type CourseGroupStatus = z.infer<typeof CourseGroupStatusSchema>;

export const CourseGroupParticipantRoleSchema = z.enum(["teacher", "ta", "student"]);
export type CourseGroupParticipantRole = z.infer<typeof CourseGroupParticipantRoleSchema>;

export const AiAgentProviderSchema = z.enum(["ollama", "openai", "codex", "claude"]);
export type AiAgentProvider = z.infer<typeof AiAgentProviderSchema>;

export const AiAgentScopeSchema = z.enum(["personal", "global"]);
export type AiAgentScope = z.infer<typeof AiAgentScopeSchema>;

export const RecordIdSchema = z.string().trim().min(1).max(191);
export type RecordId = z.infer<typeof RecordIdSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const ActivateAccountInputSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords must match."
      });
    }
  });
export type ActivateAccountInput = z.infer<typeof ActivateAccountInputSchema>;

export const UserProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120)
});
export type UserProfileUpdate = z.infer<typeof UserProfileUpdateSchema>;

export const UserPasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(8).max(200),
    newPassword: z.string().min(8).max(200),
    confirmNewPassword: z.string().min(8).max(200)
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmNewPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmNewPassword"],
        message: "Passwords must match."
      });
    }
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "The new password must be different from the current password."
      });
    }
  });
export type UserPasswordChange = z.infer<typeof UserPasswordChangeSchema>;

export const AiAgentConnectionInputSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  provider: AiAgentProviderSchema,
  model: z.string().trim().min(1).max(160),
  baseUrl: z.string().trim().url().max(500).optional().nullable(),
  apiKey: z.string().trim().max(2000).optional().nullable(),
  scope: AiAgentScopeSchema.optional().default("personal"),
  isEnabled: z.boolean().optional().default(true)
});
export type AiAgentConnectionInput = z.infer<typeof AiAgentConnectionInputSchema>;

export const AiAgentConnectionUpdateSchema = AiAgentConnectionInputSchema.partial();
export type AiAgentConnectionUpdate = z.infer<typeof AiAgentConnectionUpdateSchema>;

export const AiAgentPreferencesInputSchema = z.object({
  questionAuthoringAiAgentConnectionId: z.string().cuid().nullable().optional()
});
export type AiAgentPreferencesInput = z.infer<typeof AiAgentPreferencesInputSchema>;

export const ActivityPluginInstallationUpdateSchema = z.union([
  z.object({ action: z.literal("activate"), restoreBackupId: z.string().cuid().optional().nullable() }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ isEnabled: z.boolean() })
]);
export type ActivityPluginInstallationUpdate = z.infer<typeof ActivityPluginInstallationUpdateSchema>;

export const ContentTypePluginInstallationUpdateSchema = z.union([
  z.object({ action: z.literal("activate"), restoreBackupId: z.string().cuid().optional().nullable() }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ isEnabled: z.boolean() })
]);
export type ContentTypePluginInstallationUpdate = z.infer<typeof ContentTypePluginInstallationUpdateSchema>;

export const CourseInputSchema = z.object({
  subjectId: RecordIdSchema,
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional().default(""),
  status: CourseStatusSchema.optional().default("draft")
});
export type CourseInput = z.infer<typeof CourseInputSchema>;

export const StudentContentLayoutSchema = z.enum(["accordion", "folder_tabs"]);
export type StudentContentLayout = z.infer<typeof StudentContentLayoutSchema>;

export const CourseUpdateSchema = CourseInputSchema.partial().extend({
  studentContentLayout: StudentContentLayoutSchema.optional()
});
export type CourseUpdate = z.infer<typeof CourseUpdateSchema>;

export const CourseSettingsInputSchema = z.object({
  studentSupportAiAgentConnectionId: z.string().cuid().nullable().optional()
});
export type CourseSettingsInput = z.infer<typeof CourseSettingsInputSchema>;

export const SubjectInputSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional().default(""),
  metadata: z.record(z.unknown()).optional().default({})
});
export type SubjectInput = z.infer<typeof SubjectInputSchema>;

export const SubjectUpdateSchema = SubjectInputSchema.partial();
export type SubjectUpdate = z.infer<typeof SubjectUpdateSchema>;

export const SubjectKnowledgeConceptInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(4000).optional().default(""),
  positionX: z.number().finite().optional().default(0),
  positionY: z.number().finite().optional().default(0)
});
export type SubjectKnowledgeConceptInput = z.infer<typeof SubjectKnowledgeConceptInputSchema>;

export const SubjectKnowledgeConceptUpdateSchema = SubjectKnowledgeConceptInputSchema.partial();
export type SubjectKnowledgeConceptUpdate = z.infer<typeof SubjectKnowledgeConceptUpdateSchema>;

export const SubjectKnowledgePrerequisiteInputSchema = z.object({
  sourceConceptId: RecordIdSchema,
  requiredConceptId: RecordIdSchema
}).refine((value) => value.sourceConceptId !== value.requiredConceptId, {
  message: "A concept cannot require itself."
});
export type SubjectKnowledgePrerequisiteInput = z.infer<typeof SubjectKnowledgePrerequisiteInputSchema>;

export const SubjectKnowledgeGraphGenerationInputSchema = z.object({
  description: z.string().min(10).max(4000),
  directions: z.string().max(4000).optional().default(""),
  maxConcepts: z.number().int().min(1).max(50).default(12),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en")
});
export type SubjectKnowledgeGraphGenerationInput = z.infer<typeof SubjectKnowledgeGraphGenerationInputSchema>;

export const ActivityBankInputSchema = z.object({
  subjectId: RecordIdSchema,
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional().default(""),
  ownerId: RecordIdSchema.optional(),
  metadata: z.record(z.unknown()).optional().default({})
});
export type ActivityBankInput = z.infer<typeof ActivityBankInputSchema>;

export const ActivityBankUpdateSchema = ActivityBankInputSchema.omit({ subjectId: true }).partial();
export type ActivityBankUpdate = z.infer<typeof ActivityBankUpdateSchema>;

export const BankActivityInputSchema = z.object({
  activityTypeKey: z.string().min(2).max(80),
  title: z.string().min(2).max(180),
  description: z.string().max(4000).optional().default(""),
  lifecycle: ActivityLifecycleSchema.optional().default("draft"),
  config: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
  position: z.number().int().min(0).optional().default(0)
});
export type BankActivityInput = z.infer<typeof BankActivityInputSchema>;

export const BankActivityUpdateSchema = BankActivityInputSchema.partial();
export type BankActivityUpdate = z.infer<typeof BankActivityUpdateSchema>;

export const BankActivityDeleteSchema = z.object({
  force: z.boolean().optional().default(false)
});
export type BankActivityDelete = z.infer<typeof BankActivityDeleteSchema>;

export const CourseGroupInputSchema = z.object({
  title: z.string().min(2).max(160)
});
export type CourseGroupInput = z.infer<typeof CourseGroupInputSchema>;

export const CourseGroupUpdateSchema = z
  .object({
    title: z.string().min(2).max(160).optional(),
    status: CourseGroupStatusSchema.optional(),
    availableFrom: z.string().datetime().nullable().optional(),
    availableUntil: z.string().datetime().nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.availableFrom && value.availableUntil && new Date(value.availableUntil) < new Date(value.availableFrom)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["availableUntil"],
        message: "The availability end must be after the start."
      });
    }
  });
export type CourseGroupUpdate = z.infer<typeof CourseGroupUpdateSchema>;

const CourseMaterialBaseSchema = z.object({
  title: z.string().min(2).max(180),
  kind: MaterialKindSchema,
  parentId: RecordIdSchema.nullable().optional(),
  body: z.string().max(20000).optional(),
  url: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
  position: z.number().int().min(0).optional().default(0)
});

function validateCourseMaterialUrl(value: { kind?: MaterialKind; url?: string }, context: z.RefinementCtx) {
  if (value.kind === "github_repo" && value.url) {
    const host = new URL(value.url).host.toLowerCase();
    if (host !== "github.com" && !host.endsWith(".github.com")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "GitHub repository material must use a github.com URL."
      });
    }
  }
}

function validateCourseMaterialCreate(value: { kind?: MaterialKind; url?: string }, context: z.RefinementCtx) {
  validateCourseMaterialUrl(value, context);
}

export const CourseMaterialInputSchema = CourseMaterialBaseSchema.superRefine(validateCourseMaterialCreate);
export type CourseMaterialInput = z.infer<typeof CourseMaterialInputSchema>;

export const CourseMaterialUpdateSchema = CourseMaterialBaseSchema.partial().superRefine(validateCourseMaterialUrl);
export type CourseMaterialUpdate = z.infer<typeof CourseMaterialUpdateSchema>;

export const CourseGroupMaterialInputSchema = CourseMaterialBaseSchema.superRefine(validateCourseMaterialCreate);
export type CourseGroupMaterialInput = z.infer<typeof CourseGroupMaterialInputSchema>;

export const CourseGroupMaterialUpdateSchema = CourseMaterialBaseSchema.partial().superRefine(validateCourseMaterialUrl);
export type CourseGroupMaterialUpdate = z.infer<typeof CourseGroupMaterialUpdateSchema>;

export const CourseContentPlacementInputSchema = z.object({
  parentId: RecordIdSchema.nullable().optional(),
  titleSnapshot: z.string().trim().min(1).max(180).nullable().optional(),
  isVisible: z.boolean().optional().default(true),
  position: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional().default({})
});
export type CourseContentPlacementInput = z.infer<typeof CourseContentPlacementInputSchema>;

export const ActivityInputSchema = z.object({
  bankActivityId: RecordIdSchema.optional(),
  activityVersionId: RecordIdSchema.optional(),
  activityTypeKey: z.string().min(2).max(80),
  title: z.string().min(2).max(180),
  description: z.string().max(4000).optional().default(""),
  lifecycle: ActivityLifecycleSchema.optional().default("draft"),
  config: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
  position: z.number().int().min(0).optional().default(0),
  contentPlacement: CourseContentPlacementInputSchema.optional()
});
export type ActivityInput = z.infer<typeof ActivityInputSchema>;

export const ActivityUpdateSchema = ActivityInputSchema.partial();
export type ActivityUpdate = z.infer<typeof ActivityUpdateSchema>;

export const TestSettingsSchema = z.object({
  timeLimitMinutes: z.number().int().positive().max(1440).nullable().optional().default(null),
  navigationMode: z.enum(["free", "sequential"]).optional().default("free"),
  randomizeItems: z.boolean().optional().default(false),
  allowResume: z.boolean().optional().default(true)
});
export type TestSettings = z.infer<typeof TestSettingsSchema>;

export const TestCreateSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().max(4000).optional().default(""),
  lifecycle: ActivityLifecycleSchema.optional().default("draft"),
  position: z.number().int().min(0).optional().default(0),
  settings: TestSettingsSchema.optional().default({}),
  contentPlacement: CourseContentPlacementInputSchema.optional()
});
export type TestCreate = z.infer<typeof TestCreateSchema>;

export const TestUpdateSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().max(4000).optional(),
  lifecycle: ActivityLifecycleSchema.optional(),
  settings: TestSettingsSchema.partial().optional()
});
export type TestUpdate = z.infer<typeof TestUpdateSchema>;

export const TestDuplicateSchema = z.object({
  title: z.string().trim().min(2).max(180).optional()
});
export type TestDuplicate = z.infer<typeof TestDuplicateSchema>;

const TestItemSettingsSchema = z.object({
  pointsPossible: z.number().positive().max(100000).optional().default(1),
  isRequired: z.boolean().optional().default(true),
  position: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional().default({})
});

export const TestItemCreateSchema = z.discriminatedUnion("source", [
  TestItemSettingsSchema.extend({
    source: z.literal("bank"),
    bankActivityId: RecordIdSchema,
    activityVersionId: RecordIdSchema.optional()
  }),
  TestItemSettingsSchema.extend({
    source: z.literal("local"),
    activityTypeKey: z.string().min(2).max(80),
    title: z.string().trim().min(2).max(180),
    description: z.string().max(4000).optional().default(""),
    lifecycle: ActivityLifecycleSchema.optional().default("draft"),
    config: z.record(z.unknown()).optional().default({}),
    activityMetadata: z.record(z.unknown()).optional().default({})
  })
]);
export type TestItemCreate = z.infer<typeof TestItemCreateSchema>;

export const TestItemUpdateSchema = z.object({
  pointsPossible: z.number().positive().max(100000).optional(),
  isRequired: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional()
});
export type TestItemUpdate = z.infer<typeof TestItemUpdateSchema>;

export const GradebookItemSettingsInputSchema = z.object({
  pointsPossible: z.number().positive().max(100000).optional(),
  gradingMode: z.enum(["points", "pass_fail"]).optional(),
  passThresholdPoints: z.number().min(0).max(100000).nullable().optional(),
  passThresholdOutOf: z.number().positive().max(100000).nullable().optional(),
  attemptLimitMode: z.enum(["unlimited", "max_attempts", "until_due"]).optional(),
  maxAttempts: z.number().int().positive().max(1000).nullable().optional(),
  gradeStrategy: z.enum(["latest", "best", "first", "weighted_average"]).optional(),
  dropLowestAttempt: z.boolean().optional()
});
export type GradebookItemSettingsInput = z.infer<typeof GradebookItemSettingsInputSchema>;

export const CourseGroupActivityInputSchema = z.object({
  activityId: RecordIdSchema,
  availableFrom: z.string().datetime().nullable().optional(),
  availableUntil: z.string().datetime().nullable().optional(),
  config: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
  gradebookSettings: GradebookItemSettingsInputSchema.optional(),
  position: z.number().int().min(0).optional().default(0),
  contentPlacement: CourseContentPlacementInputSchema.optional()
});
export type CourseGroupActivityInput = z.infer<typeof CourseGroupActivityInputSchema>;

export const AssignedActivityAssessmentModeSchema = z.enum(["formative", "summative"]);
export type AssignedActivityAssessmentMode = z.infer<typeof AssignedActivityAssessmentModeSchema>;

export const CourseAllGroupsActivityAssignmentInputSchema = z.object({
  availableFrom: z.string().datetime().nullable().optional(),
  availableUntil: z.string().datetime().nullable().optional(),
  enablePerGroupSettings: z.boolean().optional().default(true),
  assessmentMode: AssignedActivityAssessmentModeSchema.optional().default("formative"),
  gradebookSettings: GradebookItemSettingsInputSchema.optional(),
  contentPlacement: CourseContentPlacementInputSchema.optional()
});
export type CourseAllGroupsActivityAssignmentInput = z.infer<typeof CourseAllGroupsActivityAssignmentInputSchema>;

export const CourseGroupActivityUpdateSchema = z.object({
  availableFrom: z.string().datetime().nullable().optional(),
  availableUntil: z.string().datetime().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  position: z.number().int().min(0).optional()
});
export type CourseGroupActivityUpdate = z.infer<typeof CourseGroupActivityUpdateSchema>;

export const CourseGroupParticipantInputSchema = z.object({
  role: CourseGroupParticipantRoleSchema.optional().default("student"),
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  email: z.string().email(),
  externalId: z.string().trim().max(120).optional().nullable()
});
export type CourseGroupParticipantInput = z.infer<typeof CourseGroupParticipantInputSchema>;

export const EnrollmentInputSchema = z.object({
  userId: RecordIdSchema,
  role: CourseMembershipRoleSchema,
  groupId: RecordIdSchema.optional()
});
export type EnrollmentInput = z.infer<typeof EnrollmentInputSchema>;

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: RoleKey[];
};
