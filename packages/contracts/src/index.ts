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

export const CourseInputSchema = z.object({
  subjectId: z.string().cuid(),
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional().default(""),
  status: CourseStatusSchema.optional().default("draft")
});
export type CourseInput = z.infer<typeof CourseInputSchema>;

export const CourseUpdateSchema = CourseInputSchema.partial();
export type CourseUpdate = z.infer<typeof CourseUpdateSchema>;

export const SubjectInputSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional().default(""),
  metadata: z.record(z.unknown()).optional().default({})
});
export type SubjectInput = z.infer<typeof SubjectInputSchema>;

export const SubjectUpdateSchema = SubjectInputSchema.partial();
export type SubjectUpdate = z.infer<typeof SubjectUpdateSchema>;

export const ActivityBankInputSchema = z.object({
  subjectId: z.string().cuid(),
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional().default(""),
  ownerId: z.string().cuid().optional(),
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
  parentId: z.string().cuid().nullable().optional(),
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
  if (value.kind && ["link", "github_repo", "pdf"].includes(value.kind) && !value.url) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["url"],
      message: "A URL is required for this material type."
    });
  }

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

export const ActivityInputSchema = z.object({
  bankActivityId: z.string().cuid().optional(),
  activityVersionId: z.string().cuid().optional(),
  activityTypeKey: z.string().min(2).max(80),
  title: z.string().min(2).max(180),
  description: z.string().max(4000).optional().default(""),
  lifecycle: ActivityLifecycleSchema.optional().default("draft"),
  config: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
  position: z.number().int().min(0).optional().default(0)
});
export type ActivityInput = z.infer<typeof ActivityInputSchema>;

export const ActivityUpdateSchema = ActivityInputSchema.partial();
export type ActivityUpdate = z.infer<typeof ActivityUpdateSchema>;

export const CourseGroupActivityInputSchema = z.object({
  activityId: z.string().cuid(),
  availableFrom: z.string().datetime().nullable().optional(),
  availableUntil: z.string().datetime().nullable().optional(),
  config: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
  position: z.number().int().min(0).optional().default(0)
});
export type CourseGroupActivityInput = z.infer<typeof CourseGroupActivityInputSchema>;

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
  userId: z.string().cuid(),
  role: CourseMembershipRoleSchema
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
  roles: RoleKey[];
};
