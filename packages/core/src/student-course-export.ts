import { createHash } from "node:crypto";
import { prisma } from "@cognelo/db";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { exportRecord, getStudentActivityExportHandler, type AnswerExportBlock, type AnswerExportLabels, type ServerActivityRecord, type StudentActivityExportInput } from "@cognelo/activity-sdk/server";
import { getServerContentTypePlugin } from "@cognelo/content-type-sdk/server";
import { StudentCourseExportRequestSchema, type CurrentUser } from "@cognelo/contracts";
import { AppError, forbidden } from "./errors";
import { listContentItems } from "./course-content";
import { getGroupAssignedActivityForStudentExport, assignmentRequiresSafeExamBrowser } from "./groups";
import { assignmentAssessmentPolicyMode } from "./activity-assignment-policy";
import { activitySubmissionStageSafeExamBrowser } from "./activity-submission-stages";
import { getActivityContentAccess } from "./activity-content-access";
import { getActivityGradingReviews } from "./grading-review";
import { getCourseTimeSettings } from "./course-time";
import { assertContentResourcePluginActive, isActivityTypePluginEnabled } from "./plugins";
import type { AnswerExportSection } from "./answer-export";
import nodePath from "node:path";
import { openStoredMaterial } from "./material-storage";
import { extractMediaAssetIds } from "./media-assets";

export type StudentCourseExportLabels = AnswerExportLabels & {
  contents: string; exported: string; attempt: string; submitted: string; noSubmissions: string;
  contentClosed: string; unsupported: string; gradebookGrade: string; attemptGrade: string; ungraded: string;
};
export type StudentCourseExportDocument = {
  path: string[]; title: string; groupTitle: string;
  isActivity?: boolean;
  prompt: AnswerExportBlock[]; promptPdfs?: Array<{ name: string; bytes: Uint8Array }>;
  grade?: string | null;
  gradeComment?: string;
  attempts: Array<{ number: number; submittedAt: string | null; score?: string | null; sections: AnswerExportSection[] }>;
};
export type StudentCourseExportSecurity = {
  signal?: AbortSignal;
  validateSession?: () => Promise<void>;
  hasSafeExamBrowserAccess?: (scope: { courseId: string; groupId: string; activityId: string }) => Promise<boolean>;
};
export type StudentCourseExportBundle = {
  courseTitle: string; subjectTitle: string; studentName: string; timeZone: string;
  locale: "en" | "fr" | "zh" | "ar"; exportedAt: string; labels: StudentCourseExportLabels;
  documents: StudentCourseExportDocument[]; directories: string[][];
  files: Array<{ path: string[]; bytes: Uint8Array }>;
  revalidate: () => Promise<void>;
  authorizeImage: (assetId: string) => Promise<boolean>;
  hasSafeExamBrowserAccess?: StudentCourseExportSecurity["hasSafeExamBrowserAccess"];
};
const MAX_ITEMS = 2000;
const MAX_ATTEMPTS = 1000;
const MAX_INPUT_BYTES = 32_000_000n;
const MAX_PROJECTED_BYTES = 64_000_000;
const tooLarge = () => new AppError(413, "COURSE_EXPORT_TOO_LARGE", "This course exceeds the export limit. Ask your teacher to reduce the exportable content.");
const changed = () => new AppError(409, "COURSE_EXPORT_CHANGED", "Course access or content changed during export. Try again.");
function digest(value: unknown) {
  const hash = createHash("sha256");
  const visit = (entry: unknown, depth: number) => {
    if (depth > 100) throw tooLarge();
    if (entry instanceof Date) { hash.update(`date:${entry.toISOString()};`); return; }
    if (ArrayBuffer.isView(entry)) { hash.update(`bytes:${entry.byteLength}:`); hash.update(new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength)); return; }
    if (Array.isArray(entry)) { hash.update("["); for (const child of entry) { visit(child, depth + 1); hash.update(","); } hash.update("]"); return; }
    if (entry && typeof entry === "object") {
      hash.update("{");
      for (const key of Object.keys(entry).sort()) { hash.update(JSON.stringify(key)); hash.update(":"); visit(Reflect.get(entry, key), depth + 1); hash.update(","); }
      hash.update("}"); return;
    }
    hash.update(JSON.stringify(entry) ?? "undefined");
  };
  visit(value, 0); return hash.digest("hex");
}
const score = (value: { normalizedScore?: number | null; normalizedMaxScore?: number | null }) => typeof value.normalizedScore === "number" && typeof value.normalizedMaxScore === "number" ? `${value.normalizedScore} / ${value.normalizedMaxScore}` : null;

type TreeItem = { id: string; parentId: string | null; kind: string; titleSnapshot: string | null; position: number; createdAt: Date };
/** Walk only reachable visible folders, using the same logical sibling order as the course tree. */
export function studentCourseExportOrder<T extends TreeItem>(items: T[]) {
  const children = new Map<string | null, T[]>();
  for (const item of items) children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  for (const siblings of children.values()) siblings.sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const result: Array<{ item: T; path: string[] }> = [];
  const seen = new Set<string>();
  const pending = [...(children.get(null) ?? [])].map((item, index) => ({ item, path: [segment(index, item.titleSnapshot ?? "")] })).reverse();
  while (pending.length) {
    const entry = pending.pop()!;
    if (seen.has(entry.item.id)) continue;
    if (entry.path.length > 24 || result.length >= MAX_ITEMS) throw tooLarge();
    seen.add(entry.item.id); result.push(entry);
    if (entry.item.kind === "folder") {
      const nested = children.get(entry.item.id) ?? [];
      for (let index = nested.length - 1; index >= 0; index--) pending.push({ item: nested[index], path: [...entry.path, segment(index, nested[index].titleSnapshot ?? "")] });
    }
  }
  return result;
}
const segment = (index: number, title: string) => `${String(index + 1).padStart(3, "0")}-${title}`;

export async function assertStudentCourseExportAccess(user: CurrentUser, courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, groups: { some: { participants: { some: { userId: user.id, role: "student" } } } } },
    select: { id: true, title: true, studentCourseExportEnabled: true, updatedAt: true, subject: { select: { title: true } } } });
  if (!course) throw forbidden();
  if (!course.studentCourseExportEnabled) throw new AppError(403, "COURSE_EXPORT_DISABLED", "Student course export is not enabled for this course.");
  return course;
}

async function collectScope(user: CurrentUser, courseId: string, security: StudentCourseExportSecurity) {
  security.signal?.throwIfAborted();
  await security.validateSession?.();
  const course = await assertStudentCourseExportAccess(user, courseId);
  const now = new Date();
  const groups = await prisma.courseGroup.findMany({ where: { courseId, status: "published", participants: { some: { userId: user.id, role: "student" } },
    AND: [{ OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] }, { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] }] },
    include: { participants: { where: { userId: user.id, role: "student" }, select: { id: true } } }, orderBy: [{ title: "asc" }, { id: "asc" }], take: 51 });
  if (!groups.length) throw forbidden();
  if (groups.length > 50) throw tooLarge();
  const groupIds = groups.map(group => group.id);
  const [treeSize] = await prisma.$queryRaw<Array<{ count: bigint; bytes: bigint }>>`SELECT
    COALESCE(SUM(CASE WHEN "groupId" IS NULL THEN ${groupIds.length}::int ELSE 1 END),0)::bigint AS count,
    COALESCE(SUM(octet_length(metadata::text)*(CASE WHEN "groupId" IS NULL THEN ${groupIds.length}::int ELSE 1 END)),0)::bigint AS bytes FROM "CourseContentItem"
    WHERE "courseId"=${courseId} AND ("groupId" IS NULL OR "groupId"=ANY(${groupIds}::text[]))`;
  if (treeSize.count > BigInt(MAX_ITEMS) || treeSize.bytes > MAX_INPUT_BYTES) throw tooLarge();
  const trees = await Promise.all(groups.map(group => listContentItems(user, courseId, { groupId: group.id, visibleOnly: true, learnerVisibility: true })));
  const activityOccurrences = trees.flatMap(items => items.flatMap(item => item.activityId ? [item.activityId] : []));
  const assignmentIdsForSize = [...new Set(trees.flatMap(items => items.flatMap(item => item.courseGroupActivityId ? [item.courseGroupActivityId] : [])))];
  const resourceIds = [...new Set(trees.flatMap(items => items.flatMap(item => item.contentResourceId ? [item.contentResourceId] : [])))];
  const [contentSize] = await prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT (
    COALESCE((SELECT SUM(octet_length(a.config::text)+octet_length(a.metadata::text)+octet_length(a.description)) FROM unnest(${activityOccurrences}::text[]) visible(id) JOIN "Activity" a ON a.id=visible.id),0)
    + COALESCE((SELECT SUM(octet_length(config::text)+octet_length(metadata::text)) FROM "CourseGroupActivity" WHERE id=ANY(${assignmentIdsForSize}::text[])),0)
    + COALESCE((SELECT SUM(octet_length(metadata::text)) FROM "CourseContentResource" WHERE id=ANY(${resourceIds}::text[])),0)
    + COALESCE((SELECT SUM(octet_length(metadata::text)+COALESCE(octet_length(body),0)) FROM "CourseMaterial" WHERE "courseId"=${courseId}),0)
  )::bigint AS bytes`;
  if (contentSize.bytes > MAX_INPUT_BYTES) throw tooLarge();
  const sections = [];
  for (const [index, group] of groups.entries()) {
    const items = studentCourseExportOrder(trees[index]);
    const activities = [];
    for (const { item } of items) {
      if (!item.activityId || !item.courseGroupActivityId) continue;
      security.signal?.throwIfAborted();
      try {
        const activity = await getGroupAssignedActivityForStudentExport(user, courseId, group.id, item.activityId);
        if (activity.activityType.providerKind !== "core" && !await isActivityTypePluginEnabled(activity.activityType.key)) continue;
        const access = await getActivityContentAccess(user, courseId, group.id, item.activityId, { forceLearner: true });
        const stages = await activitySubmissionStageSafeExamBrowser(activity, activity.assignment);
        const requiresSeb = stages ? stages.assessmentRequired : getActivityDefinition(activity.activityType.key)?.supportsSafeExamBrowser !== false && assignmentRequiresSafeExamBrowser(activity.assignment.metadata);
        const sebAllowed = !requiresSeb || Boolean(await security.hasSafeExamBrowserAccess?.({ courseId, groupId: group.id, activityId: activity.id }));
        const itemPolicy = await prisma.gradebookItem.findFirst({ where: { courseId, groupId: group.id, groupActivityId: activity.assignment.id }, select: { id: true, gradesReleased: true, updatedAt: true } });
        const mode = assignmentAssessmentPolicyMode(activity.assignment.metadata);
        activities.push({ activity, access, sebAllowed, itemPolicy, mode });
      } catch (error) {
        if (!(error instanceof AppError && [403, 404].includes(error.status))) throw error;
      }
    }
    sections.push({ group, items, activities });
  }
  const participants = groups.map(group => group.participants[0].id);
  const assignmentIds = sections.flatMap(section => section.activities.map(entry => entry.activity.assignment.id));
  const attempts = await prisma.activityAttempt.findMany({ where: { courseId, participantId: { in: participants }, groupActivityId: { in: assignmentIds },
    lifecycle: { in: ["submitted", "graded"] } }, select: { id: true, groupId: true, groupActivityId: true, participantId: true, assessmentMode: true, lifecycle: true,
    updatedAt: true, attemptNumber: true, submittedAt: true, testRevisionId: true,
    testItemAttempts: { select: { id: true, updatedAt: true, lifecycle: true } },
    gradeEvents: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, createdAt: true } }
  }, orderBy: [{ attemptNumber: "asc" }, { id: "asc" }], take: MAX_ATTEMPTS + 1 });
  if (attempts.length > MAX_ATTEMPTS) throw tooLarge();
  const reviews = await getActivityGradingReviews(attempts.map(attempt => attempt.id));
  const grades = await prisma.grade.findMany({ where: { participantId: { in: participants }, gradebookItem: { courseId, groupActivityId: { in: assignmentIds } }, isActive: true },
    select: { id: true, gradebookItemId: true, participantId: true, normalizedScore: true, normalizedMaxScore: true, selectedAttemptId: true, updatedAt: true } });
  const resources = resourceIds.length ? await prisma.courseContentResource.findMany({ where: { courseId, id: { in: resourceIds }, OR: [{ groupId: null }, { groupId: { in: groupIds } }] } }) : [];
  const resourceActive = new Map<string, boolean>();
  for (const resource of resources) {
    try { await assertContentResourcePluginActive(resource.pluginKey); resourceActive.set(resource.id, true); }
    catch (error) { if (!(error instanceof AppError && (error.code === "PLUGIN_INACTIVE" || [403, 404, 409].includes(error.status)))) throw error; resourceActive.set(resource.id, false); }
  }
  const materialIds = [...new Set(trees.flatMap(items => items.flatMap(item => item.materialId ? [item.materialId] : [])))];
  const materials = materialIds.length ? await prisma.courseMaterial.findMany({ where: { courseId, id: { in: materialIds } } }) : [];
  return { course, sections, attempts, reviews, grades, resources, resourceActive, materials };
}
function scopeRevision(scope: Awaited<ReturnType<typeof collectScope>>) {
  return digest({ course: scope.course, sections: scope.sections.map(section => ({ group: section.group,
    items: section.items.map(({ item }) => [item.id, item.parentId, item.position, item.titleSnapshot, item.updatedAt]),
    activities: section.activities.map(({ activity, access, sebAllowed, itemPolicy, mode }) => [activity.id, activity.updatedAt, activity.assignment, access.locked, sebAllowed, itemPolicy, mode]) })),
    attempts: scope.attempts, reviews: scope.reviews.map(review => [review.id, review.version]), grades: scope.grades,
    resources: scope.resources.map(resource => [resource.id, resource.updatedAt, scope.resourceActive.get(resource.id)]),
    materials: scope.materials.map(material => [material.id, material.updatedAt]) });
}

export async function buildStudentCourseExport(user: CurrentUser, courseId: string, value: unknown, labels: StudentCourseExportLabels, security: StudentCourseExportSecurity = {}): Promise<StudentCourseExportBundle> {
  const input = StudentCourseExportRequestSchema.parse(value);
  const scope = await collectScope(user, courseId, security);
  const revision = scopeRevision(scope);
  const { timeZone } = await getCourseTimeSettings(user, courseId);
  const documents: StudentCourseExportDocument[] = [];
  const files: StudentCourseExportBundle["files"] = [];
  const directories: string[][] = [];
  const allowedActivities = new Set<string>(), allowedResources = new Set<string>(), allowedRevisions = new Set<string>(), allowedRevisionItems = new Set<string>();
  const preparationImages = new Map<string, Set<string>>();
  const budget = { bytes: MAX_PROJECTED_BYTES };
  const projections: Array<() => Promise<void>> = [];
  const attemptIds = scope.attempts.map(attempt => attempt.id);
  if (attemptIds.length) {
    const [size] = await prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT COALESCE(SUM(octet_length(a.metadata::text)
      + COALESCE((SELECT SUM(octet_length(c.result::text)+octet_length(c.feedback::text)) FROM "TestItemAttempt" c WHERE c."parentAttemptId"=a.id),0)
      + COALESCE((SELECT SUM(octet_length(r.config::text)+octet_length(r.metadata::text)+octet_length(r.description)) FROM "TestRevisionItem" r WHERE r."testRevisionId"=a."testRevisionId"),0)
      + COALESCE((SELECT octet_length(g."normalizedResult"::text) FROM "Grade" g WHERE g."selectedAttemptId"=a.id AND g."isActive" LIMIT 1),0)
      + COALESCE((SELECT octet_length(e."nextValue"::text) FROM "GradeEvent" e WHERE e."attemptId"=a.id ORDER BY e."createdAt" DESC,e.id DESC LIMIT 1),0)
      ),0)::bigint AS bytes FROM "ActivityAttempt" a WHERE a.id=ANY(${attemptIds}::text[])`;
    if (size.bytes > MAX_INPUT_BYTES) throw tooLarge();
  }
  for (const [groupIndex, section] of scope.sections.entries()) {
    const prefix = scope.sections.length > 1 ? [segment(groupIndex, section.group.title)] : [];
    for (const { item, path } of section.items) {
      security.signal?.throwIfAborted();
      const location = [...prefix, ...path];
      if (item.kind === "folder") { directories.push(location); continue; }
      const document: StudentCourseExportDocument = { path: location, title: item.titleSnapshot ?? "", groupTitle: section.group.title, prompt: [], attempts: [] };
      let promptBudgetConsumed = false;
      if (item.contentResourceId) {
        const resource = scope.resources.find(resource => resource.id === item.contentResourceId && (!resource.groupId || resource.groupId === section.group.id));
        if (!resource || !scope.resourceActive.get(resource.id)) continue;
        const handler = getServerContentTypePlugin(resource.pluginKey)?.studentExport;
        if (!handler) { document.prompt = [{ kind: "markdown", text: labels.unsupported }]; }
        else {
          const content = await handler({ user, resource: { ...resource, metadata: exportRecord(resource.metadata) }, signal: security.signal });
          document.prompt = content.blocks;
          for (const [index, file] of (content.files ?? []).entries()) { consume(file.bytes, budget); files.push({ path: [...location, segment(index, file.name)], bytes: file.bytes }); }
          allowedResources.add(resource.id);
        }
        document.title = resource.title;
      } else if (item.materialId) {
        const material = scope.materials.find(material => material.id === item.materialId);
        if (!material) continue;
        document.title = material.title;
        if (material.body) document.prompt.push({ kind: material.kind === "code_example" ? "code" : "markdown", text: material.body });
        if (material.url) document.prompt.push({ kind: "link", url: material.url, text: material.title });
        const metadata = exportRecord(material.metadata);
        if (material.kind === "file" && metadata.storedName) {
          const file = await openStoredMaterial(nodePath.resolve(process.cwd(), "../../storage/course-materials"), [courseId], metadata.storedName);
          try {
            const stat = await file.stat();
            if (stat.size > 25 * 1024 * 1024) throw tooLarge();
            const bytes = new Uint8Array(await file.readFile()); consume(bytes, budget);
            files.push({ path: [...location, segment(0, typeof metadata.originalName === "string" ? metadata.originalName : material.title)], bytes });
          } finally { await file.close(); }
        }
      } else if (item.activityId) {
        document.isActivity = true;
        const selected = section.activities.find(entry => entry.activity.id === item.activityId);
        if (!selected) continue;
        const { activity, access, itemPolicy, mode, sebAllowed } = selected;
        document.title = activity.title;
        const ownAttempts = scope.attempts.filter(attempt => attempt.groupActivityId === activity.assignment.id && attempt.assessmentMode === (mode === "summative" ? "summative" : "formative"));
        const pending = scope.reviews.some(review => ownAttempts.some(attempt => attempt.id === review.attemptId));
        const grade = scope.grades.find(grade => grade.gradebookItemId === itemPolicy?.id && grade.participantId === section.group.participants[0].id);
        const gradingAllowed = !pending && (mode !== "summative" || Boolean(itemPolicy?.gradesReleased && grade));
        const feedbackAllowed = gradingAllowed && mode !== "formative";
        if (mode === "summative" && feedbackAllowed && grade) document.grade = score(grade);
        if (access.locked || (!sebAllowed && getActivityDefinition(activity.activityType.key)?.assessmentFlow !== "deferred")) {
          if (document.grade == null) continue;
          document.prompt = [{ kind: "markdown", text: labels.contentClosed }];
        } else {
          if (mode === "summative" && feedbackAllowed && grade && sebAllowed) {
            const currentGrade = await prisma.grade.findFirst({ where: { id: grade.id, isActive: true }, select: { normalizedResult: true } });
            const comment = exportRecord(exportRecord(currentGrade?.normalizedResult).studentFeedback).feedbackText;
            if (typeof comment === "string") document.gradeComment = comment;
          }
          const context = { user, courseId, groupId: section.group.id, participantId: section.group.participants[0].id, activity: activityRecord(activity), labels, signal: security.signal };
          if (activity.activityType.key !== "test") {
            const prompt = await studentSection({ ...context, attempt: null }, budget, projections);
            document.prompt = prompt.prompt; document.promptPdfs = prompt.promptPdfs;
            for (const [index, file] of (prompt.files ?? []).entries()) files.push({ path: [...location, segment(index, file.name)], bytes: file.bytes });
            promptBudgetConsumed = true;
          } else document.prompt = activity.description ? [{ kind: "markdown", text: activity.description }] : [];
          if (sebAllowed) allowedActivities.add(activity.id);
          else if (!activity.assignment.availableUntil || activity.assignment.availableUntil > new Date()) {
            for (const field of getActivityDefinition(activity.activityType.key)?.preparationMediaFields ?? []) {
              for (const id of extractMediaAssetIds(exportRecord(activity.config)[field])) {
                const owners = preparationImages.get(id) ?? new Set<string>();
                owners.add(activity.id); preparationImages.set(id, owners);
              }
            }
          }
          if (sebAllowed) for (const reference of ownAttempts) {
            security.signal?.throwIfAborted();
            const attempt = await prisma.activityAttempt.findFirst({ where: { id: reference.id, participantId: section.group.participants[0].id, userId: user.id, lifecycle: { in: ["submitted", "graded"] } }, include: {
              selectedForGrades: { where: { isActive: true }, select: { normalizedScore: true, normalizedMaxScore: true, normalizedResult: true } },
              gradeEvents: { where: { eventType: { in: ["auto_graded", "manual_graded", "overridden", "regraded"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { nextValue: true } },
              testRevision: { include: { items: true } }, testItemAttempts: { include: { activity: { include: { activityType: true } } } }
            } });
            if (!attempt) throw changed();
            const metadata = exportRecord(attempt.metadata), snapshot = attempt.selectedForGrades[0] ?? exportRecord(attempt.gradeEvents[0]?.nextValue);
            const stored = exportRecord(exportRecord(snapshot.normalizedResult).studentFeedback);
            const feedback = feedbackAllowed ? Object.keys(stored).length ? { ...exportRecord(stored.details), ...stored } : exportRecord(metadata.teacherFeedback) : {};
            const saved = { coreAttemptId: attempt.id, pluginAttemptRef: attempt.pluginAttemptRef, metadata, feedback, includeGrading: gradingAllowed, includeAiFeedback: feedbackAllowed, state: metadata.timedOut ? exportRecord(metadata.savedResponse) : null };
            const sections: AnswerExportSection[] = [];
            if (activity.activityType.key === "test") {
              const manifest = exportRecord(metadata.submissionManifest ?? metadata.manifest);
              if (!Array.isArray(manifest.items)) throw changed();
              for (const raw of manifest.items) {
                const entry = exportRecord(raw), child = attempt.testItemAttempts.find(child => child.testItemId === entry.testItemId);
                if (!child) throw changed();
                const historical = attempt.testRevision?.items.find(item => item.sourceTestItemId === child.testItemId);
                if (historical) allowedRevisionItems.add(historical.id);
                if (attempt.testRevisionId) allowedRevisions.add(attempt.testRevisionId);
                allowedActivities.add(child.activityId);
                const childActivity = activityRecord({ ...child.activity, title: historical?.title ?? child.activity.title, description: historical?.description ?? child.activity.description,
                  config: historical?.config ?? exportRecord(child.result).configSnapshot ?? child.activity.config });
                sections.push({ ...await studentSection({ ...context, activity: childActivity, attempt: { ...saved, pluginAttemptRef: child.pluginAttemptRef,
                  state: exportRecord(exportRecord(child.result).state), feedback: feedbackAllowed ? { ...exportRecord(exportRecord(child.feedback).aiFeedback), ...exportRecord(child.feedback) } : {} } }, budget, projections),
                  ...(feedbackAllowed ? { score: score(child) } : {}) });
              }
            } else sections.push(await studentSection({ ...context, attempt: saved }, budget, projections));
            document.attempts.push({ number: attempt.attemptNumber, submittedAt: attempt.submittedAt?.toISOString() ?? null, sections, ...(gradingAllowed ? { score: score(snapshot) } : {}) });
          }
        }
      } else continue;
      consume({ path: document.path, title: document.title, groupTitle: document.groupTitle, grade: document.grade, gradeComment: document.gradeComment }, budget);
      if (!promptBudgetConsumed) consume(document.prompt, budget);
      documents.push(document);
      if (documents.length > 1000) throw tooLarge();
    }
  }
  return { courseTitle: scope.course.title, subjectTitle: scope.course.subject.title, studentName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || user.email,
    locale: input.locale, timeZone, exportedAt: new Date().toISOString(), labels, documents, directories, files,
    revalidate: async () => {
      security.signal?.throwIfAborted();
      for (const validate of projections) { security.signal?.throwIfAborted(); await validate(); }
      if (scopeRevision(await collectScope(user, courseId, security)) !== revision) throw changed();
      await security.validateSession?.();
    },
    hasSafeExamBrowserAccess: security.hasSafeExamBrowserAccess,
    authorizeImage: async assetId => Boolean(await prisma.mediaAssetReference.findFirst({ where: { assetId, asset: { status: "active" }, OR: [
      { activityId: { in: [...allowedActivities, ...(preparationImages.get(assetId) ?? [])] } }, { contentResourceId: { in: [...allowedResources] } },
      { testRevisionId: { in: [...allowedRevisions] } }, { testRevisionItemId: { in: [...allowedRevisionItems] } }
    ] }, select: { id: true } }))
  };
}

function activityRecord(activity: { id: string; title: string; description: string; lifecycle: string; config?: unknown; metadata?: unknown; activityType: NonNullable<ServerActivityRecord["activityType"]> }): ServerActivityRecord {
  return { ...activity, config: exportRecord(activity.config), metadata: exportRecord(activity.metadata) };
}
async function studentSection(input: StudentActivityExportInput, budget: { bytes: number }, projections: Array<() => Promise<void>>): Promise<AnswerExportSection & { files?: Array<{ name: string; bytes: Uint8Array }> }> {
  const handler = getStudentActivityExportHandler(input.activity.activityType.key);
  const content = handler ? await handler(input) : { answer: [], prompt: [{ kind: "markdown" as const, text: input.labels.unavailable }] };
  if (handler) {
    const original = digest(content);
    projections.push(async () => { if (digest(await handler(input)) !== original) throw changed(); });
  }
  const section = { title: input.activity.title,
    prompt: [...(!content.replaceDescription && input.activity.description ? [{ kind: "markdown" as const, text: input.activity.description }] : []), ...(content.prompt ?? [])],
    answer: content.answer, grading: input.attempt?.includeGrading ? content.grading ?? [] : [], ...(content.promptPdfs?.length ? { promptPdfs: content.promptPdfs } : {}), ...(content.files?.length ? { files: content.files } : {}) };
  consume(section, budget); return section;
}
function consume(value: unknown, budget: { bytes: number }) {
  const pending = [value];
  while (pending.length) {
    const current = pending.pop();
    if (typeof current === "string") budget.bytes -= Buffer.byteLength(current);
    else if (ArrayBuffer.isView(current)) budget.bytes -= current.byteLength;
    else if (current && typeof current === "object") pending.push(...Object.values(current));
    if (budget.bytes < 0) throw tooLarge();
  }
}
