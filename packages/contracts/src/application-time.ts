import { z } from "zod";
export const ApplicationTimeZoneSchema = z.string().trim().min(1).max(100).refine((value) => {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Choose a valid IANA timezone.");
export const ApplicationTimeSettingsSchema = z.object({
  timeZone: ApplicationTimeZoneSchema,
  allowCourseTimeZone: z.boolean().optional()
}).strict();
export type ApplicationTimeSettings = z.infer<typeof ApplicationTimeSettingsSchema>;
export type ApplicationTimeSnapshot = { timeZone: string; serverNow: string };
export type ApplicationTimeSettingsDto = ApplicationTimeSnapshot & { allowCourseTimeZone: boolean; timeZones: string[] };
export const CourseTimeSettingsSchema = z.object({ timeZone: ApplicationTimeZoneSchema.nullable() }).strict();
export type CourseTimeSettingsDto = {
  timeZone: string;
  courseTimeZone: string | null;
  applicationTimeZone: string;
  allowCourseTimeZone: boolean;
  canConfigure: boolean;
  timeZones: string[];
};
