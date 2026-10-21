import { z } from "zod";
export const ApplicationTimeZoneSchema = z.string().trim().min(1).max(100).refine((value) => {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Choose a valid IANA timezone.");
export const ApplicationTimeSettingsSchema = z.object({ timeZone: ApplicationTimeZoneSchema }).strict();
export type ApplicationTimeSettings = z.infer<typeof ApplicationTimeSettingsSchema>;
export type ApplicationTimeSnapshot = ApplicationTimeSettings & { serverNow: string };
