import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

vi.mock("./media-assets", () => ({ reconcileMediaAssetReferences: vi.fn() }));

const mockPrisma = vi.hoisted(() => ({
  subject: { findUnique: vi.fn() },
  subjectKnowledgeConcept: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
  subjectKnowledgeSkill: { findFirst: vi.fn() },
  subjectKnowledgeMisconception: { findFirst: vi.fn() }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: vi.fn() }));
vi.mock("./plugins", () => ({ assertActivityTypePluginEnabled: vi.fn() }));

const { getSubjectKnowledgeConceptDeletionImpact, getSubjectKnowledgeSkillDeletionImpact, getSubjectKnowledgeMisconceptionDeletionImpact } = await import("./subjects");

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
      misconceptionRecords: [],
      bankActivityLinks: [{ bankActivityId: "bank-1" }, { bankActivityId: "bank-1" }],
      activityLinks: [{ activityId: "activity-1" }, { activityId: "activity-2" }],
      activityVersionLinks: [{ activityVersionId: "version-1" }]
    });

    await expect(getSubjectKnowledgeConceptDeletionImpact(admin, "subject-1", "concept-1")).resolves.toEqual({
      conceptId: "concept-1", skillCount: 2, misconceptionCount: 0, bankActivityCount: 1, courseActivityCount: 2, historicalVersionCount: 1
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

  it("counts whole-concept and explicit misconception targets without rewriting historical versions", async () => {
    mockPrisma.subjectKnowledgeMisconception.findFirst.mockResolvedValue({ id: "misconception-1", title: "Assignment always creates an alias" });
    mockPrisma.subjectKnowledgeConcept.findUniqueOrThrow.mockResolvedValue({
      misconceptionRecords: [
        { id: "misconception-1", title: "Assignment always creates an alias" },
        { id: "misconception-2", title: "Variables have no type" }
      ],
      bankActivityLinks: [{ bankActivityId: "bank-1", selectsAllSkills: true, selectedMisconceptionIds: [], selectedMisconceptions: [] }],
      activityLinks: [{ activityId: "activity-1", selectsAllSkills: false, selectedMisconceptionIds: ["misconception-1"], selectedMisconceptions: ["Assignment always creates an alias"] }],
      activityVersionLinks: [
        { activityVersionId: "version-old", selectedMisconceptionIds: ["misconception-2"], selectedMisconceptions: ["Variables have no type"] },
        { activityVersionId: "version-new", selectedMisconceptionIds: ["misconception-1"], selectedMisconceptions: ["Assignment always creates an alias"] }
      ]
    });

    await expect(getSubjectKnowledgeMisconceptionDeletionImpact(admin, "subject-1", "concept-1", "misconception-1")).resolves.toMatchObject({
      bankActivityCount: 1,
      courseActivityCount: 1,
      historicalVersionCount: 1,
      replacementMisconceptions: [{ id: "misconception-2", title: "Variables have no type" }]
    });
  });
});
