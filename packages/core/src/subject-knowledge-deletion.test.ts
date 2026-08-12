import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  subject: { findUnique: vi.fn() },
  subjectKnowledgeConcept: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
  subjectKnowledgeSkill: { findFirst: vi.fn() }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: vi.fn() }));
vi.mock("./plugins", () => ({ assertActivityTypePluginEnabled: vi.fn() }));

const { getSubjectKnowledgeConceptDeletionImpact, getSubjectKnowledgeSkillDeletionImpact } = await import("./subjects");

const admin: CurrentUser = {
  id: "admin-1", email: "admin@example.test", name: null, firstName: null, lastName: null, roles: ["admin"]
};

describe("knowledge deletion impact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.subject.findUnique.mockResolvedValue({ id: "subject-1" });
  });

  it("counts distinct current activities and preserved historical versions for a concept", async () => {
    mockPrisma.subjectKnowledgeConcept.findFirst.mockResolvedValue({
      id: "concept-1",
      skillRecords: [{ id: "skill-1" }, { id: "skill-2" }],
      bankActivityLinks: [{ bankActivityId: "bank-1" }, { bankActivityId: "bank-1" }],
      activityLinks: [{ activityId: "activity-1" }, { activityId: "activity-2" }],
      activityVersionLinks: [{ activityVersionId: "version-1" }]
    });

    await expect(getSubjectKnowledgeConceptDeletionImpact(admin, "subject-1", "concept-1")).resolves.toEqual({
      conceptId: "concept-1", skillCount: 2, bankActivityCount: 1, courseActivityCount: 2, historicalVersionCount: 1
    });
  });

  it("counts whole-concept current links but only explicit immutable skill snapshots", async () => {
    mockPrisma.subjectKnowledgeSkill.findFirst.mockResolvedValue({ id: "skill-1", title: "Trace a loop" });
    mockPrisma.subjectKnowledgeConcept.findUniqueOrThrow.mockResolvedValue({
      skillRecords: [{ id: "skill-1", title: "Trace a loop" }, { id: "skill-2", title: "Write a loop" }],
      bankActivityLinks: [{ bankActivityId: "bank-1", selectsAllSkills: true, selectedSkillIds: [], selectedSkills: [] }],
      activityLinks: [{ activityId: "activity-1", selectsAllSkills: false, selectedSkillIds: ["skill-1"], selectedSkills: ["Trace a loop"] }],
      activityVersionLinks: [
        { activityVersionId: "version-old", selectsAllSkills: true, selectedSkillIds: ["skill-2"], selectedSkills: ["Write a loop"] },
        { activityVersionId: "version-new", selectsAllSkills: true, selectedSkillIds: ["skill-1"], selectedSkills: ["Trace a loop"] }
      ]
    });

    await expect(getSubjectKnowledgeSkillDeletionImpact(admin, "subject-1", "concept-1", "skill-1")).resolves.toMatchObject({
      bankActivityCount: 1,
      courseActivityCount: 1,
      historicalVersionCount: 1,
      replacementSkills: [{ id: "skill-2", title: "Write a loop" }]
    });
  });
});
