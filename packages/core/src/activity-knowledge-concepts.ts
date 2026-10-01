import type { ActivityKnowledgeConceptSelection } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { AppError } from "./errors";

type StoredConceptLink = {
  conceptId: string;
  selectsAllSkills?: boolean;
  selectedSkills?: unknown;
  selectedSkillIds?: unknown;
  selectedMisconceptions?: unknown;
  selectedMisconceptionIds?: unknown;
};

export function selectionsFromStoredLinks(links: StoredConceptLink[] | undefined): ActivityKnowledgeConceptSelection[] {
  return (links ?? []).map((link) => ({
    conceptId: link.conceptId,
    selectsAllSkills: link.selectsAllSkills ?? true,
    selectedSkills: Array.isArray(link.selectedSkills)
      ? link.selectedSkills.filter((skill): skill is string => typeof skill === "string")
      : [],
    selectedSkillIds: Array.isArray(link.selectedSkillIds)
      ? link.selectedSkillIds.filter((skillId): skillId is string => typeof skillId === "string")
      : [],
    selectedMisconceptions: Array.isArray(link.selectedMisconceptions)
      ? link.selectedMisconceptions.filter((item): item is string => typeof item === "string")
      : [],
    selectedMisconceptionIds: Array.isArray(link.selectedMisconceptionIds)
      ? link.selectedMisconceptionIds.filter((itemId): itemId is string => typeof itemId === "string")
      : []
  }));
}

export function selectionsFromLegacyIds(conceptIds: string[] | undefined): ActivityKnowledgeConceptSelection[] | undefined {
  return conceptIds?.map((conceptId) => ({ conceptId, selectsAllSkills: true, selectedSkills: [], selectedSkillIds: [], selectedMisconceptions: [], selectedMisconceptionIds: [] }));
}

export function conceptSelectionCreates(selections: ActivityKnowledgeConceptSelection[]) {
  return selections.map((selection) => ({
    conceptId: selection.conceptId,
    selectsAllSkills: selection.selectsAllSkills,
    selectedSkills: selection.selectedSkills as Prisma.InputJsonValue,
    selectedSkillIds: (selection.selectedSkillIds ?? []) as Prisma.InputJsonValue,
    selectedMisconceptions: (selection.selectedMisconceptions ?? []) as Prisma.InputJsonValue,
    selectedMisconceptionIds: (selection.selectedMisconceptionIds ?? []) as Prisma.InputJsonValue
  }));
}

export async function assertValidConceptSelections(selections: ActivityKnowledgeConceptSelection[], subjectId: string) {
  if (!selections.length) return;
  const concepts = await prisma.subjectKnowledgeConcept.findMany({
    where: { id: { in: selections.map((selection) => selection.conceptId) }, subjectId },
    select: {
      id: true,
      skills: true,
      misconceptions: true,
      skillRecords: { where: { active: true }, select: { id: true, title: true } },
      misconceptionRecords: { where: { active: true }, select: { id: true, title: true } }
    }
  });
  if (concepts.length !== selections.length) {
    throw new AppError(400, "KNOWLEDGE_CONCEPT_SUBJECT_MISMATCH", "Every selected knowledge concept must belong to the activity's subject.");
  }
  const skillsByConcept = new Map(concepts.map((concept) => [
    concept.id,
    new Set(concept.skills.split(/\r?\n/).map((skill) => skill.trim()).filter(Boolean))
  ]));
  for (const selection of selections) {
    if (selection.selectsAllSkills) continue;
    const availableSkills = skillsByConcept.get(selection.conceptId)!;
    if (selection.selectedSkills.some((skill) => !availableSkills.has(skill))) {
      throw new AppError(400, "KNOWLEDGE_SKILL_MISMATCH", "Every selected skill must currently belong to its knowledge concept.");
    }
    const concept = concepts.find((candidate) => candidate.id === selection.conceptId)!;
    const availableSkillIds = new Set(concept.skillRecords.map((skill) => skill.id));
    if ((selection.selectedSkillIds ?? []).some((skillId) => !availableSkillIds.has(skillId))) {
      throw new AppError(400, "KNOWLEDGE_SKILL_MISMATCH", "Every selected skill must currently belong to its knowledge concept.");
    }
    const availableMisconceptions = new Set(concept.misconceptionRecords.length
      ? concept.misconceptionRecords.map((item) => item.title)
      : jsonStringArray(concept.misconceptions));
    if ((selection.selectedMisconceptions ?? []).some((item) => !availableMisconceptions.has(item))) {
      throw new AppError(400, "KNOWLEDGE_MISCONCEPTION_MISMATCH", "Every selected misconception must currently belong to its knowledge concept.");
    }
    const availableMisconceptionIds = new Set(concept.misconceptionRecords.map((item) => item.id));
    if ((selection.selectedMisconceptionIds ?? []).some((itemId) => !availableMisconceptionIds.has(itemId))) {
      throw new AppError(400, "KNOWLEDGE_MISCONCEPTION_MISMATCH", "Every selected misconception must currently belong to its knowledge concept.");
    }
  }
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
