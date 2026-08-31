import type { SubjectKnowledgeConcept } from "@/lib/api";

export type KnowledgeGraphGenerationChange = {
  id: string;
  title: string;
  conceptId?: string;
  conceptTitle?: string;
};

export type KnowledgeGraphGenerationDiff = {
  addedConcepts: KnowledgeGraphGenerationChange[];
  deletedConcepts: KnowledgeGraphGenerationChange[];
  addedSkills: KnowledgeGraphGenerationChange[];
  deletedSkills: KnowledgeGraphGenerationChange[];
};

export function diffKnowledgeGraphGeneration(
  before: SubjectKnowledgeConcept[],
  after: SubjectKnowledgeConcept[]
): KnowledgeGraphGenerationDiff {
  const beforeById = new Map(before.map((concept) => [concept.id, concept]));
  const afterById = new Map(after.map((concept) => [concept.id, concept]));
  const deletedConcepts = before
    .filter((concept) => !afterById.has(concept.id))
    .map(({ id, title }) => ({ id, title }));
  const addedConcepts = after
    .filter((concept) => !beforeById.has(concept.id))
    .map(({ id, title }) => ({ id, title }));
  const deletedSkills: KnowledgeGraphGenerationChange[] = [];
  const addedSkills: KnowledgeGraphGenerationChange[] = [];

  for (const beforeConcept of before) {
    const afterConcept = afterById.get(beforeConcept.id);
    const afterSkillIds = new Set(afterConcept?.skillRecords.map((skill) => skill.id) ?? []);
    deletedSkills.push(...beforeConcept.skillRecords
      .filter((skill) => !afterSkillIds.has(skill.id))
      .map(({ id, title }) => ({ id, title, conceptId: beforeConcept.id, conceptTitle: beforeConcept.title })));
  }
  for (const afterConcept of after) {
    const beforeConcept = beforeById.get(afterConcept.id);
    const beforeSkillIds = new Set(beforeConcept?.skillRecords.map((skill) => skill.id) ?? []);
    addedSkills.push(...afterConcept.skillRecords
      .filter((skill) => !beforeSkillIds.has(skill.id))
      .map(({ id, title }) => ({ id, title, conceptId: afterConcept.id, conceptTitle: afterConcept.title })));
  }

  return { addedConcepts, deletedConcepts, addedSkills, deletedSkills };
}
