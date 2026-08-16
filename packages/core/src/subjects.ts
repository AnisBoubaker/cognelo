import { getActivityDefinition } from "@cognelo/activity-sdk";
import {
  ActivityBankInputSchema,
  ActivityBankDeleteSchema,
  ActivityBankUpdateSchema,
  BankActivityDeleteSchema,
  BankActivityInputSchema,
  BankActivityUpdateSchema,
  SubjectInputSchema,
  SubjectKnowledgeConceptInputSchema,
  SubjectKnowledgeConceptUpdateSchema,
  SubjectKnowledgeGraphDraftSchema,
  SubjectKnowledgeGraphGenerationInputSchema,
  SubjectKnowledgePrerequisiteInputSchema,
  SubjectKnowledgeSkillDeletionSchema,
  SubjectTeachingLanguageSchema,
  SubjectUpdateSchema
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertValidConceptSelections, conceptSelectionCreates, selectionsFromLegacyIds, selectionsFromStoredLinks } from "./activity-knowledge-concepts";
import { AppError, forbidden, notFound } from "./errors";
import { isAdmin, isCourseManager, isTeacher } from "./authorization";
import { assertActivityTypePluginEnabled } from "./plugins";
import { generateQuestionAuthoringText } from "./ai-agents";

type GeneratedKnowledgeConcept = { key: string; title: string; skills: string };
type GeneratedKnowledgePrerequisite = { sourceKey: string; requiredKey: string };
type GeneratedKnowledgeGraph = { concepts: GeneratedKnowledgeConcept[]; prerequisites: GeneratedKnowledgePrerequisite[] };

const subjectInclude = {
  materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  activityBanks: {
    include: {
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true, knowledgeConcepts: { include: { concept: true } } },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    },
    orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }]
  },
  courses: { orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }] },
  knowledgeConcepts: {
    where: { active: true },
    include: { skillRecords: { where: { active: true }, orderBy: [{ position: "asc" as const }] } },
    orderBy: [{ createdAt: "asc" as const }]
  },
  knowledgePrerequisites: { orderBy: [{ createdAt: "asc" as const }] }
};

export async function listSubjects(user: CurrentUser) {
  await assertCanViewSubjects(user);
  return prisma.subject.findMany({
    include: subjectInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getSubject(user: CurrentUser, subjectId: string) {
  await assertCanViewSubjects(user);
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: subjectInclude
  });
  if (!subject) {
    throw notFound("Subject");
  }
  return subject;
}

export async function createSubject(user: CurrentUser, input: unknown) {
  await assertCanManageSubjects(user);
  const data = SubjectInputSchema.parse(input);
  return prisma.subject.create({
    data: {
      title: data.title,
      description: data.description,
      teachingLanguage: data.teachingLanguage,
      metadata: data.metadata as Prisma.InputJsonValue,
      createdById: user.id
    },
    include: subjectInclude
  });
}

export async function updateSubject(user: CurrentUser, subjectId: string, input: unknown) {
  await assertCanManageSubjects(user);
  const data = SubjectUpdateSchema.parse(input);
  if (!data.knowledgeGraph) {
    return prisma.subject.update({
      where: { id: subjectId },
      data: {
        title: data.title,
        description: data.description,
        teachingLanguage: data.teachingLanguage,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      },
      include: subjectInclude
    });
  }
  const knowledgeGraph = data.knowledgeGraph;
  validateKnowledgeGraphDraft(knowledgeGraph);
  return prisma.$transaction(async (transaction) => {
    await transaction.subject.update({
      where: { id: subjectId },
      data: {
        title: data.title,
        description: data.description,
        teachingLanguage: data.teachingLanguage,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      }
    });
    const storedConcepts = await transaction.subjectKnowledgeConcept.findMany({
      where: { subjectId, active: true },
      include: { skillRecords: { where: { active: true } } }
    });
    const storedConceptIds = new Set(storedConcepts.map((concept) => concept.id));
    const submittedConceptIds = new Set(knowledgeGraph.concepts.map((concept) => concept.id));
    const omittedConceptIds = [...storedConceptIds].filter((conceptId) => !submittedConceptIds.has(conceptId));
    if (omittedConceptIds.length) {
      throw new AppError(409, "KNOWLEDGE_CONCEPT_DELETE_REQUIRES_CONFIRMATION", "Delete concepts through the confirmed concept deletion action before saving the graph.");
    }
    const conceptIds = new Map<string, string>();
    for (const concept of knowledgeGraph.concepts) {
      const isStoredConcept = storedConceptIds.has(concept.id);
      const saved = isStoredConcept
        ? await transaction.subjectKnowledgeConcept.update({
          where: { id: concept.id },
          data: {
            title: concept.title,
            skills: concept.skillRecords?.map((skill) => skill.title).join("\n") ?? concept.skills,
            positionX: concept.positionX,
            positionY: concept.positionY
          }
        })
        : await transaction.subjectKnowledgeConcept.create({
          data: {
          id: concept.id,
          subjectId,
          title: concept.title,
          skills: concept.skillRecords?.map((skill) => skill.title).join("\n") ?? concept.skills,
          positionX: concept.positionX,
          positionY: concept.positionY
          }
        });
      conceptIds.set(concept.id, saved.id);
      if (concept.skillRecords) {
        const stored = storedConcepts.find((candidate) => candidate.id === concept.id);
        const submittedSkillIds = new Set(concept.skillRecords.map((skill) => skill.id));
        if (stored?.skillRecords.some((skill) => !submittedSkillIds.has(skill.id))) {
          throw new AppError(409, "KNOWLEDGE_SKILL_DELETE_REQUIRES_CONFIRMATION", "Delete skills through the confirmed skill deletion action before saving the graph.");
        }
        const storedSkillIds = new Set(stored?.skillRecords.map((skill) => skill.id) ?? []);
        for (const skill of concept.skillRecords) {
          if (storedSkillIds.has(skill.id)) {
            await transaction.subjectKnowledgeSkill.update({ where: { id: skill.id }, data: { title: skill.title, position: skill.position, active: true } });
          } else {
            await transaction.subjectKnowledgeSkill.create({ data: { id: skill.id, subjectId, conceptId: saved.id, title: skill.title, position: skill.position, active: true } });
          }
        }
      }
    }
    await transaction.subjectKnowledgePrerequisite.deleteMany({ where: { subjectId } });
    for (const prerequisite of knowledgeGraph.prerequisites) {
      await transaction.subjectKnowledgePrerequisite.create({
        data: {
          subjectId,
          sourceConceptId: conceptIds.get(prerequisite.sourceConceptId)!,
          requiredConceptId: conceptIds.get(prerequisite.requiredConceptId)!,
          sourceHandle: prerequisite.sourceHandle,
          targetHandle: prerequisite.targetHandle
        }
      });
    }
    return transaction.subject.findUniqueOrThrow({ where: { id: subjectId }, include: subjectInclude });
  });
}

export async function createSubjectKnowledgeConcept(user: CurrentUser, subjectId: string, input: unknown) {
  await assertCanManageSubjectById(user, subjectId);
  const data = SubjectKnowledgeConceptInputSchema.parse(input);
  const { skillRecords: _skillRecords, ...conceptData } = data;
  return prisma.subjectKnowledgeConcept.create({ data: { subjectId, ...conceptData } });
}

export async function updateSubjectKnowledgeConcept(user: CurrentUser, subjectId: string, conceptId: string, input: unknown) {
  await assertCanManageSubjectById(user, subjectId);
  const concept = await prisma.subjectKnowledgeConcept.findFirst({ where: { id: conceptId, subjectId } });
  if (!concept) throw notFound("Knowledge concept");
  const data = SubjectKnowledgeConceptUpdateSchema.parse(input);
  const { skillRecords: _skillRecords, ...conceptData } = data;
  return prisma.subjectKnowledgeConcept.update({ where: { id: conceptId }, data: conceptData });
}

export async function deleteSubjectKnowledgeConcept(user: CurrentUser, subjectId: string, conceptId: string) {
  await assertCanManageSubjectById(user, subjectId);
  const concept = await prisma.subjectKnowledgeConcept.findFirst({ where: { id: conceptId, subjectId, active: true } });
  if (!concept) throw notFound("Knowledge concept");
  const impact = await getSubjectKnowledgeConceptDeletionImpact(user, subjectId, conceptId);
  return prisma.$transaction(async (transaction) => {
    await transaction.bankActivityKnowledgeConcept.deleteMany({ where: { conceptId } });
    await transaction.activityKnowledgeConcept.deleteMany({ where: { conceptId } });
    await transaction.subjectKnowledgePrerequisite.deleteMany({
      where: { OR: [{ sourceConceptId: conceptId }, { requiredConceptId: conceptId }] }
    });
    await transaction.subjectKnowledgeSkill.updateMany({ where: { conceptId, active: true }, data: { active: false } });
    await transaction.subjectKnowledgeConcept.update({ where: { id: conceptId }, data: { active: false } });
    return impact;
  });
}

export async function getSubjectKnowledgeConceptDeletionImpact(user: CurrentUser, subjectId: string, conceptId: string) {
  await assertCanManageSubjectById(user, subjectId);
  const concept = await prisma.subjectKnowledgeConcept.findFirst({
    where: { id: conceptId, subjectId, active: true },
    include: {
      skillRecords: { where: { active: true }, orderBy: { position: "asc" } },
      bankActivityLinks: { select: { bankActivityId: true } },
      activityLinks: { select: { activityId: true } },
      activityVersionLinks: { select: { activityVersionId: true } }
    }
  });
  if (!concept) throw notFound("Knowledge concept");
  return {
    conceptId,
    skillCount: concept.skillRecords.length,
    bankActivityCount: new Set(concept.bankActivityLinks.map((link) => link.bankActivityId)).size,
    courseActivityCount: new Set(concept.activityLinks.map((link) => link.activityId)).size,
    historicalVersionCount: new Set(concept.activityVersionLinks.map((link) => link.activityVersionId)).size
  };
}

export async function getSubjectKnowledgeSkillDeletionImpact(user: CurrentUser, subjectId: string, conceptId: string, skillId: string) {
  await assertCanManageSubjectById(user, subjectId);
  const skill = await prisma.subjectKnowledgeSkill.findFirst({ where: { id: skillId, conceptId, subjectId, active: true } });
  if (!skill) throw notFound("Knowledge skill");
  const concept = await prisma.subjectKnowledgeConcept.findUniqueOrThrow({
    where: { id: conceptId },
    include: {
      skillRecords: { where: { active: true }, orderBy: { position: "asc" } },
      bankActivityLinks: true,
      activityLinks: true,
      activityVersionLinks: true
    }
  });
  const referencesSkill = (link: { selectsAllSkills: boolean; selectedSkillIds: unknown; selectedSkills: unknown }) =>
    link.selectsAllSkills || jsonStringArray(link.selectedSkillIds).includes(skillId) || jsonStringArray(link.selectedSkills).includes(skill.title);
  const historicalReferencesSkill = (link: { selectedSkillIds: unknown; selectedSkills: unknown }) =>
    jsonStringArray(link.selectedSkillIds).includes(skillId) || jsonStringArray(link.selectedSkills).includes(skill.title);
  return {
    skill: { id: skill.id, title: skill.title },
    replacementSkills: concept.skillRecords.filter((candidate) => candidate.id !== skillId).map((candidate) => ({ id: candidate.id, title: candidate.title })),
    bankActivityCount: new Set(concept.bankActivityLinks.filter(referencesSkill).map((link) => link.bankActivityId)).size,
    courseActivityCount: new Set(concept.activityLinks.filter(referencesSkill).map((link) => link.activityId)).size,
    historicalVersionCount: new Set(concept.activityVersionLinks.filter(historicalReferencesSkill).map((link) => link.activityVersionId)).size
  };
}

export async function deleteSubjectKnowledgeSkill(user: CurrentUser, subjectId: string, conceptId: string, skillId: string, input: unknown) {
  await assertCanManageSubjectById(user, subjectId);
  const data = SubjectKnowledgeSkillDeletionSchema.parse(input);
  const impact = await getSubjectKnowledgeSkillDeletionImpact(user, subjectId, conceptId, skillId);
  const replacement = data.mode === "replace"
    ? await prisma.subjectKnowledgeSkill.findFirst({ where: { id: data.replacementSkillId, conceptId, subjectId, active: true } })
    : null;
  if (data.mode === "replace" && (!replacement || replacement.id === skillId)) {
    throw new AppError(400, "INVALID_REPLACEMENT_SKILL", "Choose another active skill from this concept.");
  }
  await prisma.$transaction(async (transaction) => {
    const skill = await transaction.subjectKnowledgeSkill.findUniqueOrThrow({ where: { id: skillId } });
    const updateLinks = async (links: Array<{ bankActivityId?: string; activityId?: string; selectsAllSkills: boolean; selectedSkillIds: unknown; selectedSkills: unknown }>, kind: "bank" | "activity") => {
      for (const link of links) {
        if (link.selectsAllSkills) continue;
        const ids = jsonStringArray(link.selectedSkillIds);
        const titles = jsonStringArray(link.selectedSkills);
        if (!ids.includes(skillId) && !titles.includes(skill.title)) continue;
        const nextIds = [...new Set(ids.filter((id) => id !== skillId).concat(replacement ? [replacement.id] : []))];
        const nextTitles = [...new Set(titles.filter((title) => title !== skill.title).concat(replacement ? [replacement.title] : []))];
        const where = kind === "bank"
          ? { bankActivityId_conceptId: { bankActivityId: link.bankActivityId!, conceptId } }
          : { activityId_conceptId: { activityId: link.activityId!, conceptId } };
        if (!nextIds.length && !nextTitles.length) {
          if (kind === "bank") await transaction.bankActivityKnowledgeConcept.delete({ where: where as never });
          else await transaction.activityKnowledgeConcept.delete({ where: where as never });
        } else if (kind === "bank") {
          await transaction.bankActivityKnowledgeConcept.update({ where: where as never, data: { selectedSkillIds: nextIds, selectedSkills: nextTitles } });
        } else {
          await transaction.activityKnowledgeConcept.update({ where: where as never, data: { selectedSkillIds: nextIds, selectedSkills: nextTitles } });
        }
      }
    };
    const concept = await transaction.subjectKnowledgeConcept.findUniqueOrThrow({
      where: { id: conceptId }, include: { bankActivityLinks: true, activityLinks: true }
    });
    await updateLinks(concept.bankActivityLinks, "bank");
    await updateLinks(concept.activityLinks, "activity");
    await transaction.subjectKnowledgeSkill.update({ where: { id: skillId }, data: { active: false } });
    const remaining = await transaction.subjectKnowledgeSkill.findMany({ where: { conceptId, active: true }, orderBy: { position: "asc" } });
    await transaction.subjectKnowledgeConcept.update({ where: { id: conceptId }, data: { skills: remaining.map((item) => item.title).join("\n") } });
  });
  return impact;
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function createSubjectKnowledgePrerequisite(user: CurrentUser, subjectId: string, input: unknown) {
  await assertCanManageSubjectById(user, subjectId);
  const data = SubjectKnowledgePrerequisiteInputSchema.parse(input);
  const conceptCount = await prisma.subjectKnowledgeConcept.count({
    where: { subjectId, id: { in: [data.sourceConceptId, data.requiredConceptId] } }
  });
  if (conceptCount !== 2) throw new AppError(400, "INVALID_KNOWLEDGE_CONCEPT", "Both concepts must belong to this subject.");
  const existing = await prisma.subjectKnowledgePrerequisite.findUnique({
    where: { sourceConceptId_requiredConceptId: {
      sourceConceptId: data.sourceConceptId,
      requiredConceptId: data.requiredConceptId
    } }
  });
  if (existing) throw new AppError(409, "KNOWLEDGE_PREREQUISITE_EXISTS", "This prerequisite already exists.");
  const prerequisites = await prisma.subjectKnowledgePrerequisite.findMany({
    where: { subjectId }, select: { sourceConceptId: true, requiredConceptId: true }
  });
  const outgoing = new Map<string, string[]>();
  for (const prerequisite of prerequisites) {
    outgoing.set(prerequisite.sourceConceptId, [...(outgoing.get(prerequisite.sourceConceptId) ?? []), prerequisite.requiredConceptId]);
  }
  const pending = [data.requiredConceptId];
  const visited = new Set<string>();
  while (pending.length) {
    const conceptId = pending.pop()!;
    if (conceptId === data.sourceConceptId) {
      throw new AppError(409, "KNOWLEDGE_PREREQUISITE_CYCLE", "This prerequisite would create a cycle.");
    }
    if (visited.has(conceptId)) continue;
    visited.add(conceptId);
    pending.push(...(outgoing.get(conceptId) ?? []));
  }
  return prisma.subjectKnowledgePrerequisite.create({ data: { subjectId, ...data } });
}

export async function deleteSubjectKnowledgePrerequisite(user: CurrentUser, subjectId: string, prerequisiteId: string) {
  await assertCanManageSubjectById(user, subjectId);
  const prerequisite = await prisma.subjectKnowledgePrerequisite.findFirst({ where: { id: prerequisiteId, subjectId } });
  if (!prerequisite) throw notFound("Knowledge prerequisite");
  await prisma.subjectKnowledgePrerequisite.delete({ where: { id: prerequisiteId } });
}

export async function generateSubjectKnowledgeGraph(user: CurrentUser, subjectId: string, input: unknown) {
  await assertCanManageSubjectById(user, subjectId);
  const data = SubjectKnowledgeGraphGenerationInputSchema.parse(input);
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { title: true, teachingLanguage: true } });
  if (!subject) throw notFound("Subject");

  const graph = await generateValidSubjectKnowledgeGraph({
    user,
    title: subject.title,
    description: data.description,
    directions: data.directions,
    locale: data.teachingLanguage ?? SubjectTeachingLanguageSchema.parse(subject.teachingLanguage),
    maxConcepts: data.maxConcepts,
    mode: data.mode,
    existingGraph: data.mode === "iterate" && data.existingGraph ? {
      concepts: data.existingGraph.concepts.map((concept) => ({ key: concept.id, title: concept.title, skills: concept.skills })),
      prerequisites: data.existingGraph.prerequisites.map((edge) => ({
        sourceKey: edge.sourceConceptId,
        requiredKey: edge.requiredConceptId
      }))
    } : undefined
  });
  const positions = layoutGeneratedKnowledgeGraph(graph);
  const concepts = graph.concepts.map((concept, index) => {
    const position = positions.get(concept.key) ?? { x: 0, y: 0 };
    const skillTitles = concept.skills.split(/\r?\n/).map((skill) => skill.trim()).filter(Boolean);
    return {
      id: `generated-concept-${index}-${concept.key}`.slice(0, 160),
      subjectId,
      title: concept.title,
      skills: concept.skills,
      active: true,
      skillRecords: skillTitles.map((title, skillIndex) => ({
        id: `generated-skill-${index}-${skillIndex}-${concept.key}`.slice(0, 160),
        subjectId,
        conceptId: `generated-concept-${index}-${concept.key}`.slice(0, 160),
        title,
        position: skillIndex,
        active: true
      })),
      positionX: position.x,
      positionY: position.y
    };
  });
  const conceptIds = new Map(graph.concepts.map((concept, index) => [concept.key, concepts[index]!.id]));
  const prerequisites = graph.prerequisites.map((prerequisite, index) => ({
    id: `generated-prerequisite-${index}`,
    subjectId,
    sourceConceptId: conceptIds.get(prerequisite.sourceKey)!,
    requiredConceptId: conceptIds.get(prerequisite.requiredKey)!,
    sourceHandle: null,
    targetHandle: null
  }));
  return { concepts, prerequisites };
}

function validateKnowledgeGraphDraft(graph: ReturnType<typeof SubjectKnowledgeGraphDraftSchema.parse>) {
  const conceptIds = new Set<string>();
  for (const concept of graph.concepts) {
    if (conceptIds.has(concept.id)) throw new AppError(400, "DUPLICATE_KNOWLEDGE_CONCEPT", "Knowledge concept identifiers must be unique.");
    conceptIds.add(concept.id);
  }
  const edgeKeys = new Set<string>();
  const outgoing = new Map<string, string[]>();
  for (const prerequisite of graph.prerequisites) {
    if (!conceptIds.has(prerequisite.sourceConceptId) || !conceptIds.has(prerequisite.requiredConceptId)) {
      throw new AppError(400, "INVALID_KNOWLEDGE_CONCEPT", "Every prerequisite must reference concepts in this graph.");
    }
    if (prerequisite.sourceConceptId === prerequisite.requiredConceptId) {
      throw new AppError(400, "KNOWLEDGE_PREREQUISITE_SELF_LINK", "A concept cannot require itself.");
    }
    const edgeKey = `${prerequisite.sourceConceptId}\u0000${prerequisite.requiredConceptId}`;
    if (edgeKeys.has(edgeKey)) throw new AppError(400, "DUPLICATE_KNOWLEDGE_PREREQUISITE", "Knowledge prerequisites must be unique.");
    edgeKeys.add(edgeKey);
    outgoing.set(prerequisite.sourceConceptId, [...(outgoing.get(prerequisite.sourceConceptId) ?? []), prerequisite.requiredConceptId]);
  }
  for (const startId of conceptIds) {
    const pending = [...(outgoing.get(startId) ?? [])];
    const visited = new Set<string>();
    while (pending.length) {
      const conceptId = pending.pop()!;
      if (conceptId === startId) throw new AppError(400, "KNOWLEDGE_PREREQUISITE_CYCLE", "Knowledge prerequisites cannot contain a cycle.");
      if (visited.has(conceptId)) continue;
      visited.add(conceptId);
      pending.push(...(outgoing.get(conceptId) ?? []));
    }
  }
}

async function generateValidSubjectKnowledgeGraph(input: {
  user: CurrentUser;
  title: string;
  description: string;
  directions: string;
  locale: "en" | "fr" | "zh" | "ar";
  maxConcepts: number;
  mode: "new" | "iterate";
  existingGraph?: GeneratedKnowledgeGraph;
}) {
  let issues = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await generateQuestionAuthoringText(input.user, {
      systemPrompt: [
        "You design concise prerequisite knowledge graphs for educators.",
        "Return JSON only, with no Markdown fences or commentary.",
        `Write concept titles and skills in locale '${input.locale}'.`,
        "For each concept, skills is a newline-delimited string, with exactly one skill per non-empty line.",
        "A skill is something the learner can perform or an observable learning goal. Write each skill as a concise, assessable action—not as a topic summary, definition, or vague statement such as 'understand'.",
        "Every concept must include at least one skill.",
        `Use no more than ${input.maxConcepts} concepts; fewer concepts are preferred when sufficient.`,
        "The required shape is: {\"concepts\":[{\"key\":\"stable-short-key\",\"title\":\"...\",\"skills\":\"perform observable skill one\\nperform observable skill two\"}],\"prerequisites\":[{\"sourceKey\":\"concept-that-requires\",\"requiredKey\":\"required-concept\"}]}.",
        "Every prerequisite must point from the concept that requires knowledge to the required concept.",
        "Do not create cycles, self-links, duplicate concepts, or duplicate prerequisites.",
        input.mode === "iterate"
          ? "Revise the supplied graph according to the teacher directions. Return the complete resulting graph, including unchanged concepts and prerequisites that should remain. Reuse existing concept keys whenever a concept remains."
          : "Create a completely new graph from scratch. Do not assume or preserve any prior graph."
      ].join("\n"),
      userPrompt: [
        `Subject title: ${input.title}`,
        `Subject description: ${input.description}`,
        input.mode === "iterate" ? `Current knowledge graph: ${JSON.stringify(input.existingGraph)}` : "Current knowledge graph: intentionally ignored.",
        input.directions.trim() ? `Additional teacher directions: ${input.directions.trim()}` : "Additional teacher directions: none.",
        issues
          ? `The previous response was invalid. Correct these issues: ${issues}`
          : input.mode === "iterate"
            ? "Apply the requested changes and return the full revised graph."
            : "Create the smallest useful prerequisite graph for this subject."
      ].join("\n\n"),
      maxOutputTokens: Math.min(8000, 1200 + input.maxConcepts * 180)
    });
    try {
      const graph = parseGeneratedKnowledgeGraph(response);
      const validationIssues = validateGeneratedKnowledgeGraph(graph, input.maxConcepts);
      if (!validationIssues.length) return graph;
      issues = validationIssues.join("; ");
    } catch (error) {
      issues = error instanceof Error ? error.message : "The response was not valid JSON.";
    }
  }
  throw new AppError(422, "KNOWLEDGE_GRAPH_GENERATION_INVALID", `The AI could not produce a valid knowledge graph: ${issues}`);
}

function parseGeneratedKnowledgeGraph(response: string): GeneratedKnowledgeGraph {
  const start = response.indexOf("{");
  const end = response.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The response did not contain a JSON object.");
  const value = JSON.parse(response.slice(start, end + 1)) as Record<string, unknown>;
  if (!Array.isArray(value.concepts) || !Array.isArray(value.prerequisites)) throw new Error("The JSON must contain concepts and prerequisites arrays.");
  return {
    concepts: value.concepts.map((entry) => {
      const concept = entry as Record<string, unknown>;
      return {
        key: String(concept.key ?? "").trim(),
        title: String(concept.title ?? "").trim(),
        skills: String(concept.skills ?? "").split(/\r?\n/).map((skill) => skill.trim()).filter(Boolean).join("\n")
      };
    }),
    prerequisites: value.prerequisites.map((entry) => {
      const prerequisite = entry as Record<string, unknown>;
      return {
        sourceKey: String(prerequisite.sourceKey ?? "").trim(),
        requiredKey: String(prerequisite.requiredKey ?? "").trim()
      };
    })
  };
}

function validateGeneratedKnowledgeGraph(graph: GeneratedKnowledgeGraph, maxConcepts: number) {
  const issues: string[] = [];
  if (!graph.concepts.length) issues.push("At least one concept is required");
  if (graph.concepts.length > maxConcepts) issues.push(`The graph exceeds the maximum of ${maxConcepts} concepts`);
  const keys = new Set<string>();
  for (const concept of graph.concepts) {
    if (!concept.key || !concept.title) issues.push("Every concept needs a key and title");
    if (!concept.skills.split(/\r?\n/).some((skill) => skill.trim())) issues.push(`Concept '${concept.key}' needs at least one observable skill`);
    if (concept.title.length > 160 || concept.skills.length > 4000) issues.push(`Concept '${concept.key}' is too long`);
    if (keys.has(concept.key)) issues.push(`Duplicate concept key '${concept.key}'`);
    keys.add(concept.key);
  }
  const edgeKeys = new Set<string>();
  const outgoing = new Map<string, string[]>();
  for (const prerequisite of graph.prerequisites) {
    if (!keys.has(prerequisite.sourceKey) || !keys.has(prerequisite.requiredKey)) issues.push("Every prerequisite must reference existing concepts");
    if (prerequisite.sourceKey === prerequisite.requiredKey) issues.push("A concept cannot require itself");
    const edgeKey = `${prerequisite.sourceKey}\u0000${prerequisite.requiredKey}`;
    if (edgeKeys.has(edgeKey)) issues.push("Duplicate prerequisite");
    edgeKeys.add(edgeKey);
    outgoing.set(prerequisite.sourceKey, [...(outgoing.get(prerequisite.sourceKey) ?? []), prerequisite.requiredKey]);
  }
  for (const startKey of keys) {
    const pending = [...(outgoing.get(startKey) ?? [])];
    const visited = new Set<string>();
    while (pending.length) {
      const key = pending.pop()!;
      if (key === startKey) { issues.push("The prerequisites contain a cycle"); break; }
      if (visited.has(key)) continue;
      visited.add(key);
      pending.push(...(outgoing.get(key) ?? []));
    }
  }
  return [...new Set(issues)];
}

function layoutGeneratedKnowledgeGraph(graph: GeneratedKnowledgeGraph) {
  const requiredBySource = new Map<string, string[]>();
  for (const prerequisite of graph.prerequisites) {
    requiredBySource.set(prerequisite.sourceKey, [...(requiredBySource.get(prerequisite.sourceKey) ?? []), prerequisite.requiredKey]);
  }
  const levels = new Map<string, number>();
  const getLevel = (key: string): number => {
    if (levels.has(key)) return levels.get(key)!;
    const level = Math.max(0, ...(requiredBySource.get(key) ?? []).map((requiredKey) => getLevel(requiredKey) + 1));
    levels.set(key, level);
    return level;
  };
  graph.concepts.forEach((concept) => getLevel(concept.key));
  const byLevel = new Map<number, GeneratedKnowledgeConcept[]>();
  for (const concept of graph.concepts) byLevel.set(levels.get(concept.key)!, [...(byLevel.get(levels.get(concept.key)!) ?? []), concept]);
  const positions = new Map<string, { x: number; y: number }>();
  for (const [level, concepts] of byLevel) {
    concepts.forEach((concept, index) => positions.set(concept.key, { x: 80 + index * 240, y: 80 + level * 170 }));
  }
  return positions;
}

export async function listActivityBanks(user: CurrentUser, subjectId?: string) {
  await assertCanViewSubjects(user);
  const banks = await prisma.activityBank.findMany({
    where: subjectId ? { subjectId } : undefined,
    include: {
      subject: { include: { knowledgeConcepts: { where: { active: true }, include: { skillRecords: { where: { active: true }, orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } }, knowledgePrerequisites: { orderBy: { createdAt: "asc" } } } },
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
  return banks.map((bank) => ({ ...bank, canManage: isAdmin(user) || bank.ownerId === user.id }));
}

export async function getActivityBank(user: CurrentUser, activityBankId: string) {
  await assertCanViewActivityBank(user, activityBankId);
  const bank = await prisma.activityBank.findUnique({
    where: { id: activityBankId },
    include: {
      subject: { include: { knowledgeConcepts: { where: { active: true }, include: { skillRecords: { where: { active: true }, orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } }, knowledgePrerequisites: { orderBy: { createdAt: "asc" } } } },
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: {
          activityType: true,
          currentVersion: true,
          knowledgeConcepts: { include: { concept: true } },
          versions: { orderBy: { versionNumber: "desc" } }
        },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!bank) {
    throw notFound("Activity bank");
  }
  return { ...bank, canManage: isAdmin(user) || bank.ownerId === user.id };
}

export async function createActivityBank(user: CurrentUser, input: unknown) {
  await assertCanCreateActivityBank(user);
  const data = ActivityBankInputSchema.parse(input);
  const ownerId = isAdmin(user) && data.ownerId ? data.ownerId : user.id;

  return prisma.activityBank.create({
    data: {
      subjectId: data.subjectId,
      title: data.title,
      description: data.description,
      ownerId,
      metadata: data.metadata as Prisma.InputJsonValue
    },
    include: {
      subject: { include: { knowledgeConcepts: { where: { active: true }, include: { skillRecords: { where: { active: true }, orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } }, knowledgePrerequisites: { orderBy: { createdAt: "asc" } } } },
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true, knowledgeConcepts: { include: { concept: true } } },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    }
  });
}

export async function updateActivityBank(user: CurrentUser, activityBankId: string, input: unknown) {
  const bank = await prisma.activityBank.findUnique({ where: { id: activityBankId } });
  if (!bank) {
    throw notFound("Activity bank");
  }
  if (!isAdmin(user) && bank.ownerId !== user.id) {
    throw forbidden();
  }

  const data = ActivityBankUpdateSchema.parse(input);
  if (data.subjectId && data.subjectId !== bank.subjectId) {
    const activityCount = await prisma.bankActivity.count({ where: { bankId: activityBankId } });
    if (activityCount) {
      throw new AppError(409, "ACTIVITY_BANK_SUBJECT_LOCKED", "The subject cannot be changed while the activity bank contains activities.", {
        activityCount
      });
    }
  }
  return prisma.activityBank.update({
    where: { id: activityBankId },
    data: {
      subjectId: data.subjectId,
      title: data.title,
      description: data.description,
      ownerId: isAdmin(user) ? data.ownerId : undefined,
      metadata: data.metadata as Prisma.InputJsonValue | undefined
    },
    include: {
      subject: { include: { knowledgeConcepts: { where: { active: true }, include: { skillRecords: { where: { active: true }, orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } }, knowledgePrerequisites: { orderBy: { createdAt: "asc" } } } },
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true, knowledgeConcepts: { include: { concept: true } } },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    }
  });
}

export async function deleteActivityBank(user: CurrentUser, activityBankId: string, input: unknown) {
  const data = ActivityBankDeleteSchema.parse(input);
  const bank = await prisma.activityBank.findUnique({
    where: { id: activityBankId },
    include: {
      activities: {
        select: { id: true, position: true, activityType: { select: { key: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!bank) throw notFound("Activity bank");
  await assertCanManageActivityBank(user, activityBankId);

  if (data.action === "delete" && bank.activities.length && !data.force) {
    throw new AppError(
      409,
      "ACTIVITY_BANK_NOT_EMPTY",
      "This activity bank contains activities. Confirm again to delete the bank and all its contents.",
      { activityCount: bank.activities.length }
    );
  }

  if (data.action === "move") {
    if (data.targetActivityBankId === activityBankId) {
      throw new AppError(400, "INVALID_ACTIVITY_BANK_DESTINATION", "Choose a different destination activity bank.");
    }
    const destination = await prisma.activityBank.findUnique({ where: { id: data.targetActivityBankId! } });
    if (!destination) throw notFound("Destination activity bank");
    await assertCanManageActivityBank(user, destination.id);
    if (destination.subjectId !== bank.subjectId) {
      throw new AppError(400, "ACTIVITY_BANK_SUBJECT_MISMATCH", "Activities can only be moved to a bank under the same subject.");
    }

    await prisma.$transaction(async (transaction) => {
      const lastActivity = await transaction.bankActivity.findFirst({
        where: { bankId: destination.id },
        orderBy: [{ position: "desc" }, { createdAt: "desc" }],
        select: { position: true }
      });
      const startingPosition = (lastActivity?.position ?? -1) + 1;
      for (const [index, activity] of bank.activities.entries()) {
        await transaction.bankActivity.update({
          where: { id: activity.id },
          data: { bankId: destination.id, position: startingPosition + index }
        });
      }
      await transaction.activityBank.delete({ where: { id: activityBankId } });
    });

    return { activityCount: bank.activities.length, deletedActivities: [] };
  }

  await prisma.activityBank.delete({ where: { id: activityBankId } });
  return {
    activityCount: bank.activities.length,
    deletedActivities: bank.activities.map((activity) => ({
      bankActivityId: activity.id,
      activityTypeKey: activity.activityType.key
    }))
  };
}

export async function listBankActivities(user: CurrentUser, activityBankId: string) {
  await assertCanViewActivityBank(user, activityBankId);
  return prisma.bankActivity.findMany({
    where: { bankId: activityBankId },
    include: {
      activityType: true,
      currentVersion: true,
      knowledgeConcepts: { include: { concept: true } },
      versions: { orderBy: { versionNumber: "desc" } }
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function createBankActivity(user: CurrentUser, activityBankId: string, input: unknown) {
  await assertCanManageActivityBank(user, activityBankId);
  const data = BankActivityInputSchema.parse(input);
  const activityType = await resolveActivityType(data.activityTypeKey);
  const mergedConfig = validateActivityPayload(data.activityTypeKey, data.config, data.metadata);
  const knowledgeConceptSelections = data.knowledgeConceptSelections ?? selectionsFromLegacyIds(data.knowledgeConceptIds) ?? [];
  if (knowledgeConceptSelections.length) {
    const bank = await prisma.activityBank.findUnique({ where: { id: activityBankId }, select: { subjectId: true } });
    if (!bank) throw notFound("Activity bank");
    await assertValidConceptSelections(knowledgeConceptSelections, bank.subjectId);
  }

  return prisma.$transaction(async (transaction) => {
    const bankActivity = await transaction.bankActivity.create({
      data: {
        bankId: activityBankId,
        activityTypeId: activityType.id,
        title: data.title,
        description: data.description,
        lifecycle: data.lifecycle,
        config: mergedConfig as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        position: data.position,
        createdById: user.id,
        knowledgeConcepts: { create: conceptSelectionCreates(knowledgeConceptSelections) }
      }
    });

    const version = await transaction.activityVersion.create({
      data: {
        bankActivityId: bankActivity.id,
        versionNumber: 1,
        activityTypeId: activityType.id,
        title: data.title,
        description: data.description,
        lifecycle: data.lifecycle,
        config: mergedConfig as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        createdById: user.id,
        knowledgeConcepts: { create: conceptSelectionCreates(knowledgeConceptSelections) }
      }
    });

    return transaction.bankActivity.update({
      where: { id: bankActivity.id },
      data: { currentVersionId: version.id },
      include: {
        activityType: true,
        currentVersion: true,
        knowledgeConcepts: { include: { concept: true } },
        versions: { orderBy: { versionNumber: "desc" } }
      }
    });
  });
}

export async function updateBankActivity(user: CurrentUser, bankActivityId: string, input: unknown) {
  const bankActivity = await prisma.bankActivity.findUnique({
    where: { id: bankActivityId },
    include: { bank: true, activityType: true, knowledgeConcepts: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
  });
  if (!bankActivity) {
    throw notFound("Bank activity");
  }
  await assertCanManageActivityBank(user, bankActivity.bankId);

  const data = BankActivityUpdateSchema.parse(input);
  const activityTypeKey = data.activityTypeKey ?? bankActivity.activityType.key;
  const activityType = data.activityTypeKey ? await resolveActivityType(data.activityTypeKey) : bankActivity.activityType;
  const currentConfig = (bankActivity.config as Record<string, unknown> | null) ?? {};
  const currentMetadata = (bankActivity.metadata as Record<string, unknown> | null) ?? {};
  const mergedConfig = validateActivityPayload(activityTypeKey, data.config ? { ...currentConfig, ...data.config } : currentConfig, data.metadata ?? currentMetadata);
  const nextVersionNumber = (bankActivity.versions[0]?.versionNumber ?? 0) + 1;
  const nextTitle = data.title ?? bankActivity.title;
  const nextDescription = data.description ?? bankActivity.description;
  const nextLifecycle = data.lifecycle ?? bankActivity.lifecycle;
  const nextMetadata = data.metadata ?? currentMetadata;
  const requestedKnowledgeConceptSelections = data.knowledgeConceptSelections ?? selectionsFromLegacyIds(data.knowledgeConceptIds);
  const nextKnowledgeConceptSelections = requestedKnowledgeConceptSelections ?? selectionsFromStoredLinks(bankActivity.knowledgeConcepts);
  if (requestedKnowledgeConceptSelections?.length) {
    await assertValidConceptSelections(nextKnowledgeConceptSelections, bankActivity.bank.subjectId);
  }

  return prisma.$transaction(async (transaction) => {
    const version = await transaction.activityVersion.create({
      data: {
        bankActivityId,
        versionNumber: nextVersionNumber,
        activityTypeId: activityType.id,
        title: nextTitle,
        description: nextDescription,
        lifecycle: nextLifecycle,
        config: mergedConfig as Prisma.InputJsonValue,
        metadata: nextMetadata as Prisma.InputJsonValue,
        createdById: user.id,
        knowledgeConcepts: { create: conceptSelectionCreates(nextKnowledgeConceptSelections) }
      }
    });

    return transaction.bankActivity.update({
      where: { id: bankActivityId },
      data: {
        activityTypeId: activityType.id,
        title: nextTitle,
        description: nextDescription,
        lifecycle: nextLifecycle,
        config: mergedConfig as Prisma.InputJsonValue,
        metadata: nextMetadata as Prisma.InputJsonValue,
        position: data.position,
        currentVersionId: version.id,
        knowledgeConcepts: {
          deleteMany: {},
          create: conceptSelectionCreates(nextKnowledgeConceptSelections)
        }
      },
      include: {
        activityType: true,
        currentVersion: true,
        knowledgeConcepts: { include: { concept: true } },
        versions: { orderBy: { versionNumber: "desc" } }
      }
    });
  });
}

export async function deleteBankActivity(user: CurrentUser, activityBankId: string, bankActivityId: string, input: unknown) {
  const data = BankActivityDeleteSchema.parse(input);
  const bankActivity = await prisma.bankActivity.findUnique({
    where: { id: bankActivityId },
    include: { bank: true, activityType: true }
  });
  if (!bankActivity || bankActivity.bankId !== activityBankId) {
    throw notFound("Bank activity");
  }
  await assertCanManageActivityBank(user, bankActivity.bankId);

  const courseUsages = await prisma.activity.findMany({
    where: { bankActivityId },
    distinct: ["courseId"],
    select: { courseId: true }
  });
  if (courseUsages.length && !data.force) {
    throw new AppError(
      409,
      "BANK_ACTIVITY_IN_USE",
      "This activity is used by courses. Confirm again to remove the bank link from those course activities.",
      { courseCount: courseUsages.length }
    );
  }

  const deleted = await prisma.bankActivity.delete({
    where: { id: bankActivityId },
    include: { activityType: true }
  });

  return {
    bankActivityId,
    activityTypeKey: deleted.activityType.key,
    courseCount: courseUsages.length
  };
}

async function assertCanViewSubjects(user: CurrentUser) {
  if (isAdmin(user) || isTeacher(user) || isCourseManager(user)) {
    return;
  }
  throw forbidden();
}

async function assertCanManageSubjects(user: CurrentUser) {
  if (isCourseManager(user)) {
    return;
  }
  throw forbidden();
}

async function assertCanManageSubjectById(user: CurrentUser, subjectId: string) {
  await assertCanManageSubjects(user);
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subject) throw notFound("Subject");
}

async function assertCanCreateActivityBank(user: CurrentUser) {
  if (isAdmin(user) || isTeacher(user) || isCourseManager(user)) {
    return;
  }
  throw forbidden();
}

async function assertCanViewActivityBank(user: CurrentUser, activityBankId: string) {
  await assertCanViewSubjects(user);
  const bank = await prisma.activityBank.findUnique({ where: { id: activityBankId } });
  if (!bank) {
    throw notFound("Activity bank");
  }
}

export async function assertCanManageActivityBank(user: CurrentUser, activityBankId: string) {
  const bank = await prisma.activityBank.findUnique({ where: { id: activityBankId } });
  if (!bank) {
    throw notFound("Activity bank");
  }
  if (isAdmin(user) || bank.ownerId === user.id) {
    return;
  }
  throw forbidden();
}

async function resolveActivityType(activityTypeKey: string) {
  const activityType = await prisma.activityType.findUnique({
    where: { key: activityTypeKey }
  });
  if (!activityType || !activityType.isEnabled) {
    throw new AppError(400, "UNKNOWN_ACTIVITY_TYPE", "The requested activity type is not available.");
  }
  await assertActivityTypePluginEnabled(activityTypeKey);
  return activityType;
}

function validateActivityPayload(activityTypeKey: string, config: Record<string, unknown>, metadata: Record<string, unknown>) {
  const definition = getActivityDefinition(activityTypeKey);
  const mergedConfig = { ...(definition?.defaultConfig ?? {}), ...config };
  if (definition?.configSchema) {
    definition.configSchema.parse(mergedConfig);
  }
  if (definition?.metadataSchema) {
    definition.metadataSchema.parse(metadata);
  }
  return mergedConfig;
}
