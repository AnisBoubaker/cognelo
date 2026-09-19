import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { canManageCourse, isAdmin, isCourseManager, isTeacher } from "./authorization";
import { AppError, forbidden, notFound } from "./errors";
import { assignmentRequiresSafeExamBrowser, getGroupAssignedActivity } from "./groups";

export const MAX_MEDIA_IMAGE_BYTES = 10 * 1024 * 1024;
export const MEDIA_ASSET_STAGING_HOURS = 24;
export const MEDIA_ASSET_GC_GRACE_DAYS = 30;
export const MEDIA_ASSET_TRASH_RETENTION_DAYS = 7;
export const MEDIA_STAGING_DIRECTORY_RETENTION_DAYS = 2;
export const MEDIA_ASSET_URL_PATTERN = /\/api\/media-assets\/([a-z0-9]+)\/content\b/g;

type MediaReferenceOwner =
  | { subjectId: string }
  | { bankActivityId: string }
  | { activityVersionId: string }
  | { activityId: string }
  | { testRevisionId: string }
  | { testRevisionItemId: string };

type MediaReferenceOptions = {
  actorId?: string;
  trustedCopy?: boolean;
};

export function getMediaStorageRoot() {
  const configured = process.env.MEDIA_STORAGE_ROOT?.trim();
  const workingDirectory = process.cwd();
  const repositoryRoot = path.basename(workingDirectory) === "api" && path.basename(path.dirname(workingDirectory)) === "apps"
    ? path.resolve(workingDirectory, "../..")
    : workingDirectory;
  return configured
    ? path.resolve(path.isAbsolute(configured) ? configured : path.join(repositoryRoot, configured))
    : path.join(repositoryRoot, "storage", "media");
}

export async function uploadMediaImage(user: CurrentUser, file: File) {
  if (!(isTeacher(user) || isCourseManager(user))) {
    throw forbidden();
  }
  if (!file.size) {
    throw new AppError(400, "MEDIA_FILE_EMPTY", "Choose a non-empty image file.");
  }
  if (file.size > MAX_MEDIA_IMAGE_BYTES) {
    throw new AppError(413, "MEDIA_FILE_TOO_LARGE", "Images must be 10 MB or smaller.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    throw new AppError(400, "MEDIA_IMAGE_TYPE_UNSUPPORTED", "Use a PNG, JPEG, GIF, or WebP image.");
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = path.posix.join("blobs", "sha256", sha256.slice(0, 2), sha256.slice(2, 4), sha256);
  const storageRoot = getMediaStorageRoot();
  const destination = absoluteMediaPath(storageRoot, storageKey);
  const date = new Date().toISOString().slice(0, 10);
  const stagedPath = absoluteMediaPath(storageRoot, path.posix.join("staging", date, `${randomUUID()}.part`));

  await mkdir(path.dirname(stagedPath), { recursive: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(stagedPath, bytes, { flag: "wx", mode: 0o640 });
  try {
    await link(stagedPath, destination);
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      await unlink(stagedPath).catch(() => undefined);
      throw error;
    }
  }
  await unlink(stagedPath).catch(() => undefined);

  const expiresAt = new Date(Date.now() + MEDIA_ASSET_STAGING_HOURS * 60 * 60 * 1000);
  const asset = await prisma.$transaction(async (tx) => {
    const blob = await tx.mediaBlob.upsert({
      where: { sha256 },
      create: { sha256, storageKey, mimeType, byteSize: bytes.byteLength },
      update: {},
      select: { id: true }
    });
    return tx.mediaAsset.create({
      data: {
        blobId: blob.id,
        originalName: normalizeOriginalName(file.name),
        createdById: user.id,
        expiresAt
      },
      include: { blob: true }
    });
  });

  return {
    id: asset.id,
    url: mediaAssetContentUrl(asset.id),
    originalName: asset.originalName,
    mimeType: asset.blob.mimeType,
    byteSize: asset.blob.byteSize
  };
}

type MediaAssetDeliveryOptions = {
  hasSafeExamBrowserAccess?: (scope: { courseId: string; groupId: string; activityId: string }) => boolean | Promise<boolean>;
};

export async function getMediaAssetForDelivery(user: CurrentUser, assetId: string, options: MediaAssetDeliveryOptions = {}) {
  const asset = await loadAssetForDelivery(assetId);
  if (!asset) {
    throw notFound("Image");
  }

  const stagedForCreator = asset.status === "staged" && asset.createdById === user.id && (!asset.expiresAt || asset.expiresAt > new Date());
  if (!(isAdmin(user) || stagedForCreator || await canDeliverActiveAsset(user, asset, options))) {
    throw forbidden();
  }

  const filePath = absoluteMediaPath(getMediaStorageRoot(), asset.blob.storageKey);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new AppError(404, "MEDIA_FILE_MISSING", "The image file is unavailable.");
  }
  return {
    filePath,
    byteSize: fileStat.size,
    mimeType: asset.blob.mimeType,
    originalName: asset.originalName
  };
}

async function canDeliverActiveAsset(
  user: CurrentUser,
  asset: NonNullable<Awaited<ReturnType<typeof loadAssetForDelivery>>>,
  options: MediaAssetDeliveryOptions
) {
  if (asset.status !== "active") {
    return false;
  }
  if (asset.createdById === user.id) {
    return true;
  }
  if ((isTeacher(user) || isCourseManager(user)) && asset.references.some((reference) =>
    Boolean(reference.subjectId || reference.bankActivityId || reference.activityVersionId)
  )) {
    return true;
  }

  const courseActivities = new Map<string, Set<string>>();
  for (const reference of asset.references) {
    const activityContext = reference.activity
      ? { activityId: reference.activity.id, courseId: reference.activity.courseId }
      : reference.testRevision?.test
        ? reference.testRevision.test
        : reference.testRevisionItem?.revision.test;
    if (!activityContext) continue;
    const activityIds = courseActivities.get(activityContext.courseId) ?? new Set<string>();
    activityIds.add(activityContext.activityId);
    courseActivities.set(activityContext.courseId, activityIds);
  }

  for (const [courseId, activityIds] of courseActivities) {
    if (await canManageCourse(user, courseId)) {
      return true;
    }
    const assignments = await prisma.courseGroupActivity.findMany({
      where: {
        activityId: { in: [...activityIds] },
        group: { participants: { some: { userId: user.id } } }
      },
      select: { activityId: true, groupId: true }
    });
    for (const assignment of assignments) {
      try {
        const assignedActivity = await getGroupAssignedActivity(user, courseId, assignment.groupId, assignment.activityId);
        if (
          assignmentRequiresSafeExamBrowser(assignedActivity.assignment.metadata) &&
          !(await options.hasSafeExamBrowserAccess?.({
            courseId,
            groupId: assignment.groupId,
            activityId: assignment.activityId
          }))
        ) {
          continue;
        }
        return true;
      } catch {
        // Try the next assignment. This preserves normal publication and visibility checks.
      }
    }
  }
  return false;
}

async function loadAssetForDelivery(assetId: string) {
  return prisma.mediaAsset.findUnique({
    where: { id: assetId },
    include: {
      blob: true,
      references: {
        include: {
          activity: { select: { id: true, courseId: true } },
          testRevision: { select: { test: { select: { activityId: true, courseId: true } } } },
          testRevisionItem: { select: { revision: { select: { test: { select: { activityId: true, courseId: true } } } } } }
        }
      }
    }
  });
}

export function mediaAssetContentUrl(assetId: string) {
  return `/api/media-assets/${assetId}/content`;
}

export function extractMediaAssetIds(value: unknown) {
  const ids = new Set<string>();
  const seen = new WeakSet<object>();

  function visit(current: unknown) {
    if (typeof current === "string") {
      for (const match of current.matchAll(MEDIA_ASSET_URL_PATTERN)) {
        ids.add(match[1]);
      }
      return;
    }
    if (!current || typeof current !== "object" || seen.has(current)) {
      return;
    }
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    Object.values(current).forEach(visit);
  }

  visit(value);
  return ids;
}

export async function reconcileMediaAssetReferences(
  tx: Prisma.TransactionClient,
  owner: MediaReferenceOwner,
  fields: Record<string, unknown>,
  options: MediaReferenceOptions = {}
) {
  const ownerFilter = owner as Prisma.MediaAssetReferenceWhereInput;
  const desired = new Map<string, Set<string>>(
    Object.entries(fields).map(([fieldKey, value]) => [fieldKey, extractMediaAssetIds(value)])
  );
  const existing = await tx.mediaAssetReference.findMany({
    where: ownerFilter,
    select: { id: true, assetId: true, fieldKey: true }
  });
  const desiredPairs = new Set(
    [...desired].flatMap(([fieldKey, ids]) => [...ids].map((assetId) => referencePair(fieldKey, assetId)))
  );
  const existingPairs = new Set(existing.map((reference) => referencePair(reference.fieldKey, reference.assetId)));
  const additions = [...desired].flatMap(([fieldKey, ids]) =>
    [...ids]
      .filter((assetId) => !existingPairs.has(referencePair(fieldKey, assetId)))
      .map((assetId) => ({ assetId, fieldKey }))
  );
  const removals = existing.filter((reference) => !desiredPairs.has(referencePair(reference.fieldKey, reference.assetId)));

  if (additions.length) {
    const assets = await tx.mediaAsset.findMany({
      where: { id: { in: [...new Set(additions.map((item) => item.assetId))] } },
      select: { id: true, status: true, createdById: true, expiresAt: true }
    });
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const now = new Date();
    for (const addition of additions) {
      const asset = byId.get(addition.assetId);
      const ownedByActor = asset?.createdById === options.actorId;
      const stagedForActor = asset?.status === "staged" && ownedByActor && (!asset.expiresAt || asset.expiresAt > now);
      if (!asset || (!options.trustedCopy && !stagedForActor && !(ownedByActor && asset.status === "active"))) {
        throw new AppError(400, "MEDIA_ASSET_REFERENCE_INVALID", "An inserted image is unavailable or does not belong to this editing session.");
      }
    }
    await tx.mediaAssetReference.createMany({
      data: additions.map((addition) => ({ ...owner, ...addition })),
      skipDuplicates: true
    });
  }

  if (removals.length) {
    await tx.mediaAssetReference.deleteMany({ where: { id: { in: removals.map((reference) => reference.id) } } });
  }

  const desiredIds = [...new Set([...desired.values()].flatMap((ids) => [...ids]))];
  if (desiredIds.length) {
    await tx.mediaAsset.updateMany({
      where: { id: { in: desiredIds } },
      data: { status: "active", expiresAt: null, unreferencedAt: null }
    });
  }
  for (const assetId of new Set(removals.map((reference) => reference.assetId))) {
    if (desiredIds.includes(assetId)) continue;
    const referenceCount = await tx.mediaAssetReference.count({ where: { assetId } });
    if (referenceCount === 0) {
      await tx.mediaAsset.update({ where: { id: assetId }, data: { unreferencedAt: new Date() } });
    }
  }
}

export async function collectMediaGarbage(options: {
  dryRun?: boolean;
  graceDays?: number;
  trashRetentionDays?: number;
  stagingDirectoryRetentionDays?: number;
} = {}) {
  const dryRun = options.dryRun ?? true;
  const graceDays = options.graceDays ?? MEDIA_ASSET_GC_GRACE_DAYS;
  const trashRetentionDays = options.trashRetentionDays ?? MEDIA_ASSET_TRASH_RETENTION_DAYS;
  const stagingDirectoryRetentionDays = options.stagingDirectoryRetentionDays ?? MEDIA_STAGING_DIRECTORY_RETENTION_DAYS;
  const now = new Date();
  const cutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);
  const storageRoot = getMediaStorageRoot();
  const trashDirectories = await findExpiredDatedDirectories(storageRoot, "trash", trashRetentionDays, now);
  const stagingDirectories = await findExpiredDatedDirectories(storageRoot, "staging", stagingDirectoryRetentionDays, now);
  const newlyUnreferenced = await prisma.mediaAsset.count({
    where: { status: "active", unreferencedAt: null, references: { none: {} } }
  });
  const candidates = await prisma.mediaAsset.findMany({
    where: {
      references: { none: {} },
      OR: [
        { status: "staged", expiresAt: { lt: now } },
        { status: "active", unreferencedAt: { lt: cutoff } }
      ]
    },
    include: { blob: true },
    orderBy: { createdAt: "asc" }
  });
  const expiredStagedAssets = candidates.filter((candidate) => candidate.status === "staged").length;
  const eligibleActiveAssets = candidates.length - expiredStagedAssets;
  if (dryRun) {
    return {
      dryRun,
      candidateAssets: candidates.length,
      expiredStagedAssets,
      eligibleActiveAssets,
      newlyUnreferenced,
      trashDirectories: trashDirectories.length,
      staleStagingDirectories: stagingDirectories.length,
      removedAssets: 0,
      trashedBlobs: 0,
      purgedTrashDirectories: 0,
      purgedStagingDirectories: 0
    };
  }

  await prisma.mediaAsset.updateMany({
    where: { status: "active", unreferencedAt: null, references: { none: {} } },
    data: { unreferencedAt: now }
  });

  let removedAssets = 0;
  let trashedBlobs = 0;
  for (const candidate of candidates) {
    const deleted = await prisma.mediaAsset.deleteMany({
      where: { id: candidate.id, references: { none: {} } }
    });
    if (!deleted.count) continue;
    removedAssets += deleted.count;
    const blobDeleted = await prisma.mediaBlob.deleteMany({
      where: { id: candidate.blobId, assets: { none: {} } }
    });
    if (!blobDeleted.count) continue;

    const source = absoluteMediaPath(storageRoot, candidate.blob.storageKey);
    const trashKey = path.posix.join("trash", now.toISOString().slice(0, 10), `${candidate.blob.sha256}-${randomUUID()}`);
    const destination = absoluteMediaPath(storageRoot, trashKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(source, destination).catch(async (error) => {
      if (!isMissingFileError(error)) throw error;
    });
    trashedBlobs += 1;
  }
  for (const directory of [...trashDirectories, ...stagingDirectories]) {
    await rm(directory, { recursive: true, force: true });
  }
  return {
    dryRun,
    candidateAssets: candidates.length,
    expiredStagedAssets,
    eligibleActiveAssets,
    newlyUnreferenced,
    trashDirectories: trashDirectories.length,
    staleStagingDirectories: stagingDirectories.length,
    removedAssets,
    trashedBlobs,
    purgedTrashDirectories: trashDirectories.length,
    purgedStagingDirectories: stagingDirectories.length
  };
}

export async function getMediaMaintenanceOverview(user: CurrentUser) {
  if (!isAdmin(user)) throw forbidden();
  const storageRoot = await assertMediaStorageReady();
  const [blobStats, assetCount, activeAssetCount, stagedAssetCount, unreferencedActiveAssetCount, referenceCount, garbagePreview] = await Promise.all([
    prisma.mediaBlob.aggregate({ _count: { _all: true }, _sum: { byteSize: true } }),
    prisma.mediaAsset.count(),
    prisma.mediaAsset.count({ where: { status: "active" } }),
    prisma.mediaAsset.count({ where: { status: "staged" } }),
    prisma.mediaAsset.count({ where: { status: "active", references: { none: {} } } }),
    prisma.mediaAssetReference.count(),
    collectMediaGarbage()
  ]);
  return {
    storageRoot,
    blobCount: blobStats._count._all,
    storedBytes: blobStats._sum.byteSize ?? 0,
    assetCount,
    activeAssetCount,
    stagedAssetCount,
    unreferencedActiveAssetCount,
    referenceCount,
    garbagePreview,
    policy: {
      maximumImageBytes: MAX_MEDIA_IMAGE_BYTES,
      stagedUploadHours: MEDIA_ASSET_STAGING_HOURS,
      activeGraceDays: MEDIA_ASSET_GC_GRACE_DAYS,
      trashRetentionDays: MEDIA_ASSET_TRASH_RETENTION_DAYS,
      stagingDirectoryRetentionDays: MEDIA_STAGING_DIRECTORY_RETENTION_DAYS
    }
  };
}

export async function runMediaMaintenance(user: CurrentUser) {
  if (!isAdmin(user)) throw forbidden();
  const cleanup = await collectMediaGarbage({ dryRun: false });
  return { cleanup, overview: await getMediaMaintenanceOverview(user) };
}

async function findExpiredDatedDirectories(
  storageRoot: string,
  kind: "staging" | "trash",
  retentionDays: number,
  now: Date
) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new AppError(500, "MEDIA_RETENTION_INVALID", "Media retention must be a positive whole number of days.");
  }
  const parent = path.join(storageRoot, kind);
  const entries = await readdir(parent, { withFileTypes: true }).catch((error) => {
    if (isMissingFileError(error)) return [];
    throw error;
  });
  const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && entry.name < cutoffDate)
    .map((entry) => path.join(parent, entry.name));
}

function referencePair(fieldKey: string, assetId: string) {
  return `${fieldKey}\u0000${assetId}`;
}

function absoluteMediaPath(storageRoot: string, storageKey: string) {
  if (!/^(?:blobs\/sha256\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}|staging\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]+\.part|trash\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]+)$/.test(storageKey)) {
    throw new AppError(500, "MEDIA_STORAGE_KEY_INVALID", "The stored image path is invalid.");
  }
  const resolved = path.resolve(storageRoot, storageKey);
  const root = path.resolve(storageRoot) + path.sep;
  if (!resolved.startsWith(root)) {
    throw new AppError(500, "MEDIA_STORAGE_KEY_INVALID", "The stored image path is invalid.");
  }
  return resolved;
}

function detectImageMimeType(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

function normalizeOriginalName(value: string) {
  const normalized = path.basename(value || "image").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (normalized || "image").slice(0, 255);
}

function isAlreadyExistsError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EEXIST");
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

export async function assertMediaStorageReady() {
  const root = getMediaStorageRoot();
  await mkdir(root, { recursive: true });
  await access(root);
  return root;
}
