import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  activityBank: { findUnique: vi.fn() },
  activityVersion: { findMany: vi.fn() }
}));
vi.mock("@cognelo/db", () => ({ prisma: mockPrisma }));
vi.mock("@cognelo/activity-sdk", () => ({
  getActivityDefinition: vi.fn(), getActivityPluginForActivityType: vi.fn(), isCoreActivityType: vi.fn(() => false), listActivityDefinitions: vi.fn(() => [])
}));
vi.mock("./plugins", () => ({ assertActivityTypeAvailable: vi.fn(), ensureCoreActivityTypes: vi.fn(), getEnabledActivityPluginKeys: vi.fn() }));

const { compareBankActivityVersions, structuredChanges } = await import("./activity-version-diff");
const admin: CurrentUser = { id: "admin-1", email: "admin@example.test", name: null, firstName: null, lastName: null, roles: ["admin"] };

describe("activity version diff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "admin-1", activities: [] });
  });

  it("builds semantic and recursive structured changes", async () => {
    mockPrisma.activityVersion.findMany.mockResolvedValue([
      version({ id: "version-1", versionNumber: 1, title: "Loops", config: { prompt: "Old", tests: [{ input: "1" }] } }),
      version({ id: "version-2", versionNumber: 2, title: "Loop practice", config: { prompt: "New", tests: [{ input: "1" }, { input: "2" }] } })
    ]);
    const diff = await compareBankActivityVersions(admin, "bank-1", "activity-1", "version-1", "version-2");
    expect(diff.changeCount).toBe(3);
    expect(diff.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "core", fields: [expect.objectContaining({ key: "title", before: "Loops", after: "Loop practice" })] }),
      expect.objectContaining({ key: "config", fields: [expect.objectContaining({ changes: expect.arrayContaining([
        { path: "prompt", kind: "changed", before: "Old", after: "New" },
        { path: "tests[1]", kind: "added", after: { input: "2" } }
      ]) })] })
    ]));
  });

  it("rejects comparing a version to itself", async () => {
    await expect(compareBankActivityVersions(admin, "bank-1", "activity-1", "version-1", "version-1"))
      .rejects.toMatchObject({ status: 400, code: "ACTIVITY_VERSION_DIFF_SAME_VERSION" });
  });

  it("diffs nested removals", () => {
    expect(structuredChanges({ settings: { enabled: true } }, { settings: {} })).toEqual([
      { path: "settings.enabled", kind: "removed", before: true }
    ]);
  });
});

function version(overrides: Record<string, unknown>) {
  return {
    id: "version-1", bankActivityId: "activity-1", versionNumber: 1, activityTypeId: "type-1", title: "Loops",
    description: "", lifecycle: "published", config: {}, metadata: {}, createdAt: new Date("2026-01-01T00:00:00Z"),
    activityType: { name: "MCQ" }, knowledgeConcepts: [], ...overrides
  };
}
