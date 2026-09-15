import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  mediaAsset: { count: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  mediaAssetReference: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  mediaBlob: { deleteMany: vi.fn(), upsert: vi.fn() }
}));
const authorization = vi.hoisted(() => ({
  canManageCourse: vi.fn(),
  isAdmin: vi.fn(),
  isCourseManager: vi.fn(),
  isTeacher: vi.fn()
}));

vi.mock("@cognelo/db", () => ({ prisma: db, Prisma: {} }));
vi.mock("./authorization", () => authorization);
vi.mock("./groups", () => ({ getGroupAssignedActivity: vi.fn() }));

import { collectMediaGarbage, extractMediaAssetIds, getMediaMaintenanceOverview, reconcileMediaAssetReferences, uploadMediaImage } from "./media-assets";

let storageRoot = "";

describe("media asset references", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storageRoot = await mkdtemp(path.join(tmpdir(), "cognelo-media-test-"));
    process.env.MEDIA_STORAGE_ROOT = storageRoot;
    db.$transaction.mockImplementation(async (callback) => callback(db));
    db.mediaAsset.count.mockResolvedValue(0);
    db.mediaAsset.findMany.mockResolvedValue([]);
    db.mediaAsset.deleteMany.mockResolvedValue({ count: 0 });
    db.mediaAssetReference.findMany.mockResolvedValue([]);
    db.mediaAssetReference.createMany.mockResolvedValue({ count: 1 });
    db.mediaAssetReference.deleteMany.mockResolvedValue({ count: 0 });
    db.mediaAsset.updateMany.mockResolvedValue({ count: 1 });
    db.mediaBlob.deleteMany.mockResolvedValue({ count: 0 });
    authorization.isTeacher.mockReturnValue(true);
  });

  afterEach(async () => {
    delete process.env.MEDIA_STORAGE_ROOT;
    await rm(storageRoot, { force: true, recursive: true });
  });

  it("finds first-party image references recursively without treating external URLs as assets", () => {
    expect([...extractMediaAssetIds({
      prompt: "![diagram](/api/media-assets/asset123/content)",
      nested: ["/api/media-assets/asset456/content", "https://example.test/image.png"]
    })]).toEqual(["asset123", "asset456"]);
  });

  it("activates a staged upload owned by the author when content is saved", async () => {
    db.mediaAsset.findMany.mockResolvedValue([{ id: "asset123", status: "staged", createdById: "teacher-1", expiresAt: new Date(Date.now() + 60_000) }]);

    await reconcileMediaAssetReferences(db as never, { activityId: "activity-1" }, {
      description: "![diagram](/api/media-assets/asset123/content)"
    }, { actorId: "teacher-1" });

    expect(db.mediaAssetReference.createMany).toHaveBeenCalledWith({
      data: [{ activityId: "activity-1", assetId: "asset123", fieldKey: "description" }],
      skipDuplicates: true
    });
    expect(db.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["asset123"] } },
      data: { status: "active", expiresAt: null, unreferencedAt: null }
    });
  });

  it("rejects references to another author's staged upload", async () => {
    db.mediaAsset.findMany.mockResolvedValue([{ id: "asset123", status: "staged", createdById: "teacher-2", expiresAt: new Date(Date.now() + 60_000) }]);

    await expect(reconcileMediaAssetReferences(db as never, { subjectId: "subject-1" }, {
      description: "/api/media-assets/asset123/content"
    }, { actorId: "teacher-1" })).rejects.toMatchObject({ code: "MEDIA_ASSET_REFERENCE_INVALID", status: 400 });
    expect(db.mediaAssetReference.createMany).not.toHaveBeenCalled();
  });

  it("stores accepted image bytes at a sharded content address", async () => {
    db.mediaBlob.upsert.mockResolvedValue({ id: "blob-1" });
    db.mediaAsset.create.mockResolvedValue({
      id: "asset-1",
      originalName: "diagram.png",
      blob: { mimeType: "image/png", byteSize: 8 }
    });
    const file = new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ], "diagram.png", { type: "application/octet-stream" });

    const result = await uploadMediaImage({ id: "teacher-1" } as never, file);

    expect(result).toMatchObject({ id: "asset-1", url: "/api/media-assets/asset-1/content", mimeType: "image/png" });
    const create = db.mediaBlob.upsert.mock.calls[0][0].create;
    expect(create.storageKey).toMatch(/^blobs\/sha256\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}$/);
    await expect(access(path.join(storageRoot, create.storageKey))).resolves.toBeUndefined();
  });

  it("rejects an SVG even when its declared MIME type says image", async () => {
    const file = new File(["<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"], "diagram.svg", { type: "image/png" });

    await expect(uploadMediaImage({ id: "teacher-1" } as never, file)).rejects.toMatchObject({
      code: "MEDIA_IMAGE_TYPE_UNSUPPORTED",
      status: 400
    });
    expect(db.mediaBlob.upsert).not.toHaveBeenCalled();
  });

  it("restricts the maintenance dashboard to administrators", async () => {
    authorization.isAdmin.mockReturnValue(false);

    await expect(getMediaMaintenanceOverview({ id: "teacher-1" } as never)).rejects.toMatchObject({ status: 403 });
    expect(db.mediaAsset.count).not.toHaveBeenCalled();
  });

  it("reports dated cleanup candidates without deleting them during a dry run", async () => {
    const oldTrash = path.join(storageRoot, "trash", "2000-01-01");
    const oldStaging = path.join(storageRoot, "staging", "2000-01-01");
    await mkdir(oldTrash, { recursive: true });
    await mkdir(oldStaging, { recursive: true });
    await writeFile(path.join(oldTrash, "blob"), "trash");
    await writeFile(path.join(oldStaging, "upload.part"), "staging");

    const result = await collectMediaGarbage();

    expect(result).toMatchObject({ dryRun: true, trashDirectories: 1, staleStagingDirectories: 1 });
    await expect(access(oldTrash)).resolves.toBeUndefined();
    await expect(access(oldStaging)).resolves.toBeUndefined();
  });

  it("purges only expired dated trash and staging directories on a destructive run", async () => {
    const oldTrash = path.join(storageRoot, "trash", "2000-01-01");
    const oldStaging = path.join(storageRoot, "staging", "2000-01-01");
    const futureTrash = path.join(storageRoot, "trash", "2999-01-01");
    await mkdir(oldTrash, { recursive: true });
    await mkdir(oldStaging, { recursive: true });
    await mkdir(futureTrash, { recursive: true });

    const result = await collectMediaGarbage({ dryRun: false });

    expect(result).toMatchObject({ purgedTrashDirectories: 1, purgedStagingDirectories: 1 });
    await expect(access(oldTrash)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(oldStaging)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(futureTrash)).resolves.toBeUndefined();
  });
});
