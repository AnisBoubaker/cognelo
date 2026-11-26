import { z } from "zod";

/** The server derives enrollments, materials and attempts; callers cannot select another learner. */
export const StudentCourseExportRequestSchema = z.object({
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en")
}).strict();
export type StudentCourseExportRequest = z.infer<typeof StudentCourseExportRequestSchema>;

export const ExportUsageRightsTextSchema = z.string().max(20_000);
export const StudentCourseExportPolicySchema = z.object({
  usageRights: ExportUsageRightsTextSchema,
  allowTeacherEditing: z.boolean()
}).strict();
export type StudentCourseExportPolicy = z.infer<typeof StudentCourseExportPolicySchema>;
