import { getActivityDefinition } from "@cognelo/activity-sdk";
import {
  ActivityBankInputSchema,
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
  SubjectUpdateSchema
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { AppError, forbidden, notFound } from "./errors";
import { isAdmin, isCourseManager, isTeacher } from "./authorization";
import { assertActivityTypePluginEnabled } from "./plugins";
import { generateQuestionAuthoringText } from "./ai-agents";

type GeneratedKnowledgeConcept = { key: string; title: string; description: string };
type GeneratedKnowledgePrerequisite = { sourceKey: string; requiredKey: string };
type GeneratedKnowledgeGraph = { concepts: GeneratedKnowledgeConcept[]; prerequisites: GeneratedKnowledgePrerequisite[] };

const subjectInclude = {
  materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  activityBanks: {
    include: {
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    },
    orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }]
  },
  courses: { orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }] },
  knowledgeConcepts: { orderBy: [{ createdAt: "asc" as const }] },
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
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      }
    });
    await transaction.subjectKnowledgeConcept.deleteMany({ where: { subjectId } });
    const conceptIds = new Map<string, string>();
    for (const concept of knowledgeGraph.concepts) {
      const created = await transaction.subjectKnowledgeConcept.create({
        data: {
          subjectId,
          title: concept.title,
          description: concept.description,
          positionX: concept.positionX,
          positionY: concept.positionY
        }
      });
      conceptIds.set(concept.id, created.id);
    }
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
  return prisma.subjectKnowledgeConcept.create({ data: { subjectId, ...data } });
}

export async function updateSubjectKnowledgeConcept(user: CurrentUser, subjectId: string, conceptId: string, input: unknown) {
  await assertCanManageSubjectById(user, subjectId);
  const concept = await prisma.subjectKnowledgeConcept.findFirst({ where: { id: conceptId, subjectId } });
  if (!concept) throw notFound("Knowledge concept");
  const data = SubjectKnowledgeConceptUpdateSchema.parse(input);
  return prisma.subjectKnowledgeConcept.update({ where: { id: conceptId }, data });
}

export async function deleteSubjectKnowledgeConcept(user: CurrentUser, subjectId: string, conceptId: string) {
  await assertCanManageSubjectById(user, subjectId);
  const concept = await prisma.subjectKnowledgeConcept.findFirst({ where: { id: conceptId, subjectId } });
  if (!concept) throw notFound("Knowledge concept");
  await prisma.subjectKnowledgeConcept.delete({ where: { id: conceptId } });
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
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { title: true } });
  if (!subject) throw notFound("Subject");

  const graph = await generateValidSubjectKnowledgeGraph({
    user,
    title: subject.title,
    description: data.description,
    directions: data.directions,
    locale: data.locale,
    maxConcepts: data.maxConcepts
  });
  const positions = layoutGeneratedKnowledgeGraph(graph);
  const concepts = graph.concepts.map((concept, index) => {
    const position = positions.get(concept.key) ?? { x: 0, y: 0 };
    return {
      id: `generated-concept-${index}-${concept.key}`.slice(0, 160),
      subjectId,
      title: concept.title,
      description: concept.description,
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
}) {
  let issues = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await generateQuestionAuthoringText(input.user, {
      systemPrompt: [
        "You design concise prerequisite knowledge graphs for educators.",
        "Return JSON only, with no Markdown fences or commentary.",
        `Write concept titles and descriptions in locale '${input.locale}'.`,
        `Use no more than ${input.maxConcepts} concepts; fewer concepts are preferred when sufficient.`,
        "The required shape is: {\"concepts\":[{\"key\":\"stable-short-key\",\"title\":\"...\",\"description\":\"...\"}],\"prerequisites\":[{\"sourceKey\":\"concept-that-requires\",\"requiredKey\":\"required-concept\"}]}.",
        "Every prerequisite must point from the concept that requires knowledge to the required concept.",
        "Do not create cycles, self-links, duplicate concepts, or duplicate prerequisites."
      ].join("\n"),
      userPrompt: [
        `Subject title: ${input.title}`,
        `Subject description: ${input.description}`,
        input.directions.trim() ? `Additional teacher directions: ${input.directions.trim()}` : "Additional teacher directions: none.",
        issues ? `The previous response was invalid. Correct these issues: ${issues}` : "Create the smallest useful prerequisite graph for this subject."
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
        description: String(concept.description ?? "").trim()
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
    if (concept.title.length > 160 || concept.description.length > 4000) issues.push(`Concept '${concept.key}' is too long`);
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
  return prisma.activityBank.findMany({
    where: subjectId ? { subjectId } : undefined,
    include: {
      subject: true,
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getActivityBank(user: CurrentUser, activityBankId: string) {
  await assertCanViewActivityBank(user, activityBankId);
  const bank = await prisma.activityBank.findUnique({
    where: { id: activityBankId },
    include: {
      subject: true,
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: {
          activityType: true,
          currentVersion: true,
          versions: { orderBy: { versionNumber: "desc" } }
        },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!bank) {
    throw notFound("Activity bank");
  }
  return bank;
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
      subject: true,
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true },
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
  return prisma.activityBank.update({
    where: { id: activityBankId },
    data: {
      title: data.title,
      description: data.description,
      ownerId: isAdmin(user) ? data.ownerId : undefined,
      metadata: data.metadata as Prisma.InputJsonValue | undefined
    },
    include: {
      subject: true,
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    }
  });
}

export async function listBankActivities(user: CurrentUser, activityBankId: string) {
  await assertCanViewActivityBank(user, activityBankId);
  return prisma.bankActivity.findMany({
    where: { bankId: activityBankId },
    include: {
      activityType: true,
      currentVersion: true,
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
        createdById: user.id
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
        createdById: user.id
      }
    });

    return transaction.bankActivity.update({
      where: { id: bankActivity.id },
      data: { currentVersionId: version.id },
      include: {
        activityType: true,
        currentVersion: true,
        versions: { orderBy: { versionNumber: "desc" } }
      }
    });
  });
}

export async function updateBankActivity(user: CurrentUser, bankActivityId: string, input: unknown) {
  const bankActivity = await prisma.bankActivity.findUnique({
    where: { id: bankActivityId },
    include: { bank: true, activityType: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
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
        createdById: user.id
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
        currentVersionId: version.id
      },
      include: {
        activityType: true,
        currentVersion: true,
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
