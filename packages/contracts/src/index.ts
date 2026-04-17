import { z } from "zod";

export const RoleKeySchema = z.enum(["admin", "teacher", "student"]);
export type RoleKey = z.infer<typeof RoleKeySchema>;

export const CourseStatusSchema = z.enum(["draft", "published", "archived"]);
export type CourseStatus = z.infer<typeof CourseStatusSchema>;

export const CourseMembershipRoleSchema = z.enum(["owner", "teacher", "ta", "student"]);
export type CourseMembershipRole = z.infer<typeof CourseMembershipRoleSchema>;

export const MaterialKindSchema = z.enum([
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

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const CourseInputSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional().default(""),
  status: CourseStatusSchema.optional().default("draft")
});
export type CourseInput = z.infer<typeof CourseInputSchema>;

export const CourseUpdateSchema = CourseInputSchema.partial();
export type CourseUpdate = z.infer<typeof CourseUpdateSchema>;

export const CourseMaterialInputSchema = z.object({
  title: z.string().min(2).max(180),
  kind: MaterialKindSchema,
  body: z.string().max(20000).optional(),
  url: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
  position: z.number().int().min(0).optional().default(0)
});
export type CourseMaterialInput = z.infer<typeof CourseMaterialInputSchema>;

export const CourseMaterialUpdateSchema = CourseMaterialInputSchema.partial();
export type CourseMaterialUpdate = z.infer<typeof CourseMaterialUpdateSchema>;

export const ActivityInputSchema = z.object({
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
