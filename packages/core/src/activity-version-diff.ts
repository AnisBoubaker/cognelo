import type { ActivityVersionDiff, ActivityVersionDiffChange, ActivityVersionDiffField, CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { notFound, AppError } from "./errors";
import { getActivityBank } from "./subjects";

export async function compareBankActivityVersions(
  user: CurrentUser,
  activityBankId: string,
  bankActivityId: string,
  fromVersionId: string,
  toVersionId: string
): Promise<ActivityVersionDiff> {
  await getActivityBank(user, activityBankId);
  if (fromVersionId === toVersionId) {
    throw new AppError(400, "ACTIVITY_VERSION_DIFF_SAME_VERSION", "Choose two different activity versions to compare.");
  }
  const versions = await prisma.activityVersion.findMany({
    where: { id: { in: [fromVersionId, toVersionId] }, bankActivityId, lifecycle: "published" },
    include: { activityType: true, knowledgeConcepts: { include: { concept: true } } }
  });
  const from = versions.find((version) => version.id === fromVersionId);
  const to = versions.find((version) => version.id === toVersionId);
  if (!from || !to) throw notFound("Activity version");

  const coreFields: ActivityVersionDiffField[] = [
    textField("title", "Title", from.title, to.title),
    textField("description", "Description", from.description, to.description),
    textField("lifecycle", "Lifecycle", from.lifecycle, to.lifecycle),
    textField("activityType", "Activity type", from.activityType.name, to.activityType.name),
    listField("knowledgeConcepts", "Concepts and skills", conceptLabels(from.knowledgeConcepts), conceptLabels(to.knowledgeConcepts))
  ].filter(hasChanges);
  const configChanges = structuredChanges(from.config, to.config);
  const metadataChanges = structuredChanges(from.metadata, to.metadata);
  const sections = [
    coreFields.length ? { key: "core", title: "Activity", fields: coreFields } : null,
    configChanges.length ? { key: "config", title: "Activity configuration", fields: [{ kind: "structured" as const, key: "config", label: "Configuration", changes: configChanges }] } : null,
    metadataChanges.length ? { key: "metadata", title: "Authoring metadata", fields: [{ kind: "structured" as const, key: "metadata", label: "Metadata", changes: metadataChanges }] } : null
  ].filter((section): section is NonNullable<typeof section> => Boolean(section));
  return {
    fromVersion: { id: from.id, versionNumber: from.versionNumber, createdAt: from.createdAt.toISOString() },
    toVersion: { id: to.id, versionNumber: to.versionNumber, createdAt: to.createdAt.toISOString() },
    sections,
    changeCount: sections.reduce((count, section) => count + section.fields.reduce((fieldCount, field) => fieldCount + (field.kind === "structured" ? field.changes.length : 1), 0), 0)
  };
}

function textField(key: string, label: string, before: string, after: string): ActivityVersionDiffField {
  return { kind: "text", key, label, before, after };
}

function listField(key: string, label: string, before: string[], after: string[]): ActivityVersionDiffField {
  return { kind: "list", key, label, before, after };
}

function hasChanges(field: ActivityVersionDiffField) {
  return field.kind === "structured" ? field.changes.length > 0 : stableValue(field.before) !== stableValue(field.after);
}

function conceptLabels(links: Array<{ conceptId: string; selectsAllSkills: boolean; selectedSkills: unknown; concept: { title: string } }>) {
  return links.map((link) => {
    const skills = Array.isArray(link.selectedSkills) ? link.selectedSkills.filter((skill): skill is string => typeof skill === "string") : [];
    return link.selectsAllSkills ? link.concept.title : `${link.concept.title}: ${skills.join(", ")}`;
  }).sort((a, b) => a.localeCompare(b));
}

export function structuredChanges(before: unknown, after: unknown, path = ""): ActivityVersionDiffChange[] {
  if (stableValue(before) === stableValue(after)) return [];
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((key) => {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in before)) return [{ path: childPath, kind: "added" as const, after: after[key] }];
      if (!(key in after)) return [{ path: childPath, kind: "removed" as const, before: before[key] }];
      return structuredChanges(before[key], after[key], childPath);
    });
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    return Array.from({ length }, (_, index) => {
      const childPath = `${path}[${index}]`;
      if (index >= before.length) return [{ path: childPath, kind: "added" as const, after: after[index] }];
      if (index >= after.length) return [{ path: childPath, kind: "removed" as const, before: before[index] }];
      return structuredChanges(before[index], after[index], childPath);
    }).flat();
  }
  return [{ path: path || "value", kind: before === undefined ? "added" : after === undefined ? "removed" : "changed", before, after }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
