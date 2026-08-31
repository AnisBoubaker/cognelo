import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
  activityKnowledgeConcept: { delete: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
  bankActivityKnowledgeConcept: { delete: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
  subject: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  subjectKnowledgeConcept: { create: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  subjectKnowledgePrerequisite: { create: vi.fn(), deleteMany: vi.fn() },
  subjectKnowledgeSkill: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  subject: { findUnique: vi.fn() }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: vi.fn() }));
vi.mock("./plugins", () => ({ assertActivityTypePluginEnabled: vi.fn() }));

const { updateSubject } = await import("./subjects");

const admin: CurrentUser = {
  id: "admin-1", email: "admin@example.test", name: null, firstName: null, lastName: null, roles: ["admin"]
};

const retainedConcept = {
  id: "concept-retained",
  title: "Retained",
  skills: "Keep skill",
  skillRecords: [{ id: "skill-keep", title: "Keep skill", position: 0, active: true }],
  positionX: 0,
  positionY: 0
};

describe("saving AI-disclosed knowledge graph deletions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
    mockPrisma.subject.findUnique.mockResolvedValue({ id: "subject-1" });
    tx.subject.update.mockResolvedValue({ id: "subject-1" });
    tx.subject.findUniqueOrThrow.mockResolvedValue({ id: "subject-1" });
    tx.subjectKnowledgeConcept.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({ id: where.id, ...data }));
  });

  it("keeps rejecting omitted concepts that were not disclosed by AI generation", async () => {
    tx.subjectKnowledgeConcept.findMany.mockResolvedValue([
      retainedConcept,
      { id: "concept-removed", title: "Removed", skills: "", skillRecords: [] }
    ]);

    await expect(updateSubject(admin, "subject-1", {
      knowledgeGraph: { concepts: [retainedConcept], prerequisites: [] }
    })).rejects.toMatchObject({ code: "KNOWLEDGE_CONCEPT_DELETE_REQUIRES_CONFIRMATION" });

    expect(tx.subjectKnowledgeConcept.update).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "concept-removed" }, data: { active: false }
    }));
  });

  it("retires an AI-disclosed concept and removes only its current activity links", async () => {
    tx.subjectKnowledgeConcept.findMany.mockResolvedValue([
      retainedConcept,
      { id: "concept-removed", title: "Removed", skills: "Old skill", skillRecords: [{ id: "skill-old", title: "Old skill", position: 0, active: true }] }
    ]);

    await updateSubject(admin, "subject-1", {
      knowledgeGraph: { concepts: [retainedConcept], prerequisites: [] },
      knowledgeGraphDeletions: { conceptIds: ["concept-removed"], skillIds: [] }
    });

    expect(tx.bankActivityKnowledgeConcept.deleteMany).toHaveBeenCalledWith({ where: { conceptId: "concept-removed" } });
    expect(tx.activityKnowledgeConcept.deleteMany).toHaveBeenCalledWith({ where: { conceptId: "concept-removed" } });
    expect(tx.subjectKnowledgeSkill.updateMany).toHaveBeenCalledWith({ where: { conceptId: "concept-removed", active: true }, data: { active: false } });
    expect(tx.subjectKnowledgeConcept.update).toHaveBeenCalledWith({ where: { id: "concept-removed" }, data: { active: false } });
  });

  it("removes an AI-disclosed skill from explicit current activity mappings", async () => {
    tx.subjectKnowledgeConcept.findMany.mockResolvedValue([{ ...retainedConcept, skillRecords: [
      ...retainedConcept.skillRecords,
      { id: "skill-remove", title: "Remove skill", position: 1, active: true }
    ] }]);
    tx.subjectKnowledgeConcept.findUniqueOrThrow.mockResolvedValue({
      bankActivityLinks: [{ bankActivityId: "bank-1", selectsAllSkills: false, selectedSkillIds: ["skill-remove"], selectedSkills: ["Remove skill"] }],
      activityLinks: []
    });

    await updateSubject(admin, "subject-1", {
      knowledgeGraph: { concepts: [retainedConcept], prerequisites: [] },
      knowledgeGraphDeletions: { conceptIds: [], skillIds: ["skill-remove"] }
    });

    expect(tx.bankActivityKnowledgeConcept.delete).toHaveBeenCalledWith({
      where: { bankActivityId_conceptId: { bankActivityId: "bank-1", conceptId: "concept-retained" } }
    });
    expect(tx.subjectKnowledgeSkill.update).toHaveBeenCalledWith({ where: { id: "skill-remove" }, data: { active: false } });
  });
});
