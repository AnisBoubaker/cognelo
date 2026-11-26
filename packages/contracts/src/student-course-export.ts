import { z } from "zod";

/** The server derives enrollments, materials and attempts; callers cannot select another learner. */
export const StudentCourseExportRequestSchema = z.object({
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en")
}).strict();
export type StudentCourseExportRequest = z.infer<typeof StudentCourseExportRequestSchema>;
