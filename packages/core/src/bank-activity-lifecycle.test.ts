import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const transaction = vi.hoisted(() => ({
  activityVersion: { create: vi.fn() },
  bankActivity: { create: vi.fn(), update: vi.fn() }
}));
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (client: typeof transaction) => unknown) => handler(transaction)),
  activityBank: { findUnique: vi.fn() },
  bankActivity: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: vi.fn() }));
vi.mock("./plugins", () => ({ assertActivityTypePluginEnabled: vi.fn() }));

const { duplicateBankActivity, moveBankActivity } = await import("./subjects");
const admin: CurrentUser = { id: "admin-1", email: "admin@example.test", name: null, firstName: null, lastName: null, roles: ["admin"] };

describe("bank activity lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (client: typeof transaction) => unknown) => handler(transaction));
  });

  it("duplicates into a new independent version-one activity at the end of the bank", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "owner-1" });
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      id: "activity-1", bankId: "bank-1", activityTypeId: "type-1", title: "Loops", description: "Practice", lifecycle: "draft",
      config: { prompt: "Loop" }, metadata: {}, activityType: { key: "mcq" },
      knowledgeConcepts: [{ conceptId: "concept-1", selectsAllSkills: true, selectedSkills: [], selectedSkillIds: [] }]
    });
    mockPrisma.bankActivity.findFirst.mockResolvedValue({ position: 3 });
    transaction.bankActivity.create.mockResolvedValue({ id: "activity-2", title: "Loops (copy)", description: "Practice", lifecycle: "draft", config: {}, metadata: {} });
    transaction.activityVersion.create.mockResolvedValue({ id: "version-2" });
    transaction.bankActivity.update.mockResolvedValue({ id: "activity-2", activityType: { key: "mcq" } });

    await expect(duplicateBankActivity(admin, "bank-1", "activity-1", { title: "Loops (copy)" })).resolves.toMatchObject({ id: "activity-2" });
    expect(transaction.bankActivity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: "Loops (copy)", position: 4 }) }));
    expect(transaction.activityVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bankActivityId: "activity-2", versionNumber: 1 }) }));
    expect(transaction.bankActivity.update).toHaveBeenCalledWith(expect.objectContaining({ data: { currentVersionId: "version-2" } }));
  });

  it("moves an activity only to a writable bank under the same subject", async () => {
    mockPrisma.bankActivity.findUnique.mockResolvedValue({ id: "activity-1", bankId: "bank-1", bank: { subjectId: "subject-1" } });
    mockPrisma.activityBank.findUnique
      .mockResolvedValueOnce({ id: "bank-1", ownerId: "owner-1" })
      .mockResolvedValueOnce({ id: "bank-2", ownerId: "owner-2", subjectId: "subject-1" })
      .mockResolvedValueOnce({ id: "bank-2", ownerId: "owner-2" });
    mockPrisma.bankActivity.findFirst.mockResolvedValue({ position: 6 });
    mockPrisma.bankActivity.update.mockResolvedValue({ id: "activity-1", bankId: "bank-2" });

    await moveBankActivity(admin, "bank-1", "activity-1", { targetActivityBankId: "bank-2" });
    expect(mockPrisma.bankActivity.update).toHaveBeenCalledWith(expect.objectContaining({ data: { bankId: "bank-2", position: 7 } }));
  });
});
