import { ApplicationTimeSettingsSchema, type CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { isAdmin } from "./authorization";
import { forbidden } from "./errors";

export async function getApplicationTime() {
  const settings = await prisma.applicationSettings.findUnique({ where: { id: "instance" }, select: { timeZone: true } });
  return { timeZone: settings?.timeZone ?? "UTC", serverNow: new Date().toISOString() };
}
export async function getApplicationTimeSettings(user: CurrentUser) {
  if (!isAdmin(user)) throw forbidden();
  const snapshot = await getApplicationTime();
  return { ...snapshot, timeZones: [...new Set(["UTC", snapshot.timeZone, "America/Toronto", ...Intl.supportedValuesOf("timeZone")])].sort() };
}
export async function updateApplicationTimeSettings(user: CurrentUser, input: unknown) {
  if (!isAdmin(user)) throw forbidden();
  const { timeZone } = ApplicationTimeSettingsSchema.parse(input);
  const canonical = new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone;
  await prisma.applicationSettings.upsert({
    where: { id: "instance" },
    create: { id: "instance", timeZone: canonical, updatedById: user.id },
    update: { timeZone: canonical, updatedById: user.id }
  });
  return getApplicationTime();
}
