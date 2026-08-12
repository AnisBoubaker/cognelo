import type { ActivityKnowledgeConceptSelection } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { AppError } from "./errors";

type StoredConceptLink = {
  conceptId: string;
  selectsAllSkills?: boolean;
  selectedSkills?: unknown;
  selectedSkillIds?: unknown;
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
      : []
  }));
}

export function selectionsFromLegacyIds(conceptIds: string[] | undefined): ActivityKnowledgeConceptSelection[] | undefined {
  return conceptIds?.map((conceptId) => ({ conceptId, selectsAllSkills: true, selectedSkills: [], selectedSkillIds: [] }));
}

export function conceptSelectionCreates(selections: ActivityKnowledgeConceptSelection[]) {
  return selections.map((selection) => ({
    conceptId: selection.conceptId,
    selectsAllSkills: selection.selectsAllSkills,
    selectedSkills: selection.selectedSkills as Prisma.InputJsonValue,
    selectedSkillIds: (selection.selectedSkillIds ?? []) as Prisma.InputJsonValue
  }));
}

export async function assertValidConceptSelections(selections: ActivityKnowledgeConceptSelection[], subjectId: string) {
  if (!selections.length) return;
  const concepts = await prisma.subjectKnowledgeConcept.findMany({
    where: { id: { in: selections.map((selection) => selection.conceptId) }, subjectId },
    select: { id: true, skills: true, skillRecords: { where: { active: true }, select: { id: true, title: true } } }
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
  }
}
