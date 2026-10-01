import { z } from "zod";
import type { ActivityKnowledgeConceptSelection, CurrentUser } from "@cognelo/contracts";
import { AppError } from "./errors";
import { generateQuestionAuthoringText } from "./ai-agents";
import { prisma } from "@cognelo/db";
import { assertCanManageActivityBank } from "./subjects";

const knowledgeConceptSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(500),
  skills: z.array(z.string().min(1).max(1000)).max(100),
  skillIds: z.array(z.string().min(1).max(160)).max(100).optional(),
  misconceptions: z.array(z.string().min(1).max(1000)).max(100).optional(),
  misconceptionIds: z.array(z.string().min(1).max(160)).max(100).optional()
});

const knowledgeCatalogSchema = z.array(knowledgeConceptSchema).max(500).default([]);

export const activityGenerationKnowledgeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("selected"), concepts: knowledgeCatalogSchema, selectedConcepts: knowledgeCatalogSchema }),
  z.object({ mode: z.literal("suggest"), concepts: knowledgeCatalogSchema }),
  z.object({ mode: z.literal("ignore"), concepts: knowledgeCatalogSchema })
]);

export type ActivityGenerationKnowledge = z.infer<typeof activityGenerationKnowledgeSchema>;

export async function getBankActivityVariationGenerationContext(
  user: CurrentUser,
  activityBankId: string,
  bankActivityId: string
) {
  await assertCanManageActivityBank(user, activityBankId);
  const bank = await prisma.activityBank.findUnique({
    where: { id: activityBankId },
    include: {
      subject: {
        include: {
          knowledgeConcepts: {
            where: { active: true },
            include: {
              skillRecords: { where: { active: true }, orderBy: [{ position: "asc" }] },
              misconceptionRecords: { where: { active: true }, orderBy: [{ position: "asc" }] }
            },
            orderBy: [{ createdAt: "asc" }]
          }
        }
      },
      activities: {
        where: { id: bankActivityId },
        include: {
          knowledgeConcepts: {
            include: {
              concept: { include: { skillRecords: { orderBy: [{ position: "asc" }] }, misconceptionRecords: { orderBy: [{ position: "asc" }] } } }
            }
          }
        }
      }
    }
  });
  const activity = bank?.activities[0];
  if (!bank || !activity) {
    throw new AppError(404, "BANK_ACTIVITY_NOT_FOUND", "Bank activity was not found.");
  }

  const concepts = bank.subject.knowledgeConcepts.map(toVariationConcept);
  const selectedConcepts = activity.knowledgeConcepts.flatMap((selection) => {
    const concept = toVariationConcept(selection.concept);
    if (selection.selectsAllSkills) return [concept];
    const selectedSkillIds = jsonStringArray(selection.selectedSkillIds);
    const selectedSkills = jsonStringArray(selection.selectedSkills);
    const selectedMisconceptionIds = jsonStringArray(selection.selectedMisconceptionIds);
    const selectedMisconceptions = jsonStringArray(selection.selectedMisconceptions);
    const selectedIndexes = concept.skills
      .map((skill, index) => ({ skill, index }))
      .filter(({ skill, index }) => selectedSkillIds.includes(concept.skillIds[index]) || selectedSkills.includes(skill));
    return [{
      ...concept,
      skills: selectedIndexes.map(({ skill }) => skill),
      skillIds: selectedIndexes.map(({ index }) => concept.skillIds[index]),
      misconceptions: (concept.misconceptions ?? []).filter((item, index) => selectedMisconceptionIds.includes(concept.misconceptionIds?.[index] ?? "") || selectedMisconceptions.includes(item)),
      misconceptionIds: (concept.misconceptionIds ?? []).filter((itemId, index) => selectedMisconceptionIds.includes(itemId) || selectedMisconceptions.includes((concept.misconceptions ?? [])[index] ?? ""))
    }];
  });

  return {
    locale: normalizeVariationLocale(bank.subject.teachingLanguage),
    subject: { title: bank.subject.title, description: bank.subject.description },
    knowledge: { mode: "selected" as const, concepts, selectedConcepts }
  };
}

function toVariationConcept(concept: {
  id: string;
  title: string;
  skills: string;
  misconceptions: unknown;
  skillRecords: Array<{ id: string; title: string }>;
  misconceptionRecords?: Array<{ id: string; title: string }>;
}) {
  const legacySkills = concept.skills.split(/\r?\n/).map((skill) => skill.trim()).filter(Boolean);
  const skills = concept.skillRecords.length ? concept.skillRecords.map((skill) => skill.title) : legacySkills;
  const skillIds = concept.skillRecords.length
    ? concept.skillRecords.map((skill) => skill.id)
    : skills.map((_, index) => `${concept.id}:legacy-skill-${index + 1}`);
  const legacyMisconceptions = jsonStringArray(concept.misconceptions);
  const misconceptionRecords = concept.misconceptionRecords ?? [];
  const misconceptions = misconceptionRecords.length ? misconceptionRecords.map((item) => item.title) : legacyMisconceptions;
  const misconceptionIds = misconceptionRecords.length
    ? misconceptionRecords.map((item) => item.id)
    : misconceptions.map((_, index) => `${concept.id}:legacy-misconception-${index + 1}`);
  return { id: concept.id, title: concept.title, skills, skillIds, misconceptions, misconceptionIds };
}

export function activityKnowledgeGenerationPrompt(knowledge: ActivityGenerationKnowledge) {
  const boundary = knowledge.concepts.length
    ? [
        "The following knowledge catalog defines the intended subject boundary.",
        "Keep the generated activity within this catalog unless the teacher explicitly requests otherwise.",
        "Do not treat every catalog skill as a required target for this activity.",
        ...knowledge.concepts.flatMap((concept) => [
          `Concept: ${concept.title}`,
          ...concept.skills.map((skill) => `- ${skill}`),
          ...(concept.misconceptions ?? []).map((item) => `- Misconception to address: ${item}`)
        ])
      ]
    : ["No knowledge catalog is available. Use the subject title, description, and teacher instructions as the boundary."];

  if (knowledge.mode !== "selected") return boundary.join("\n");

  const selected = knowledge.selectedConcepts.length
    ? [
        "The generated activity must specifically assess or practice these selected learning skills and misconceptions:",
        ...knowledge.selectedConcepts.flatMap((concept) => [
      `Concept: ${concept.title}`,
      ...concept.skills.map((skill) => `- ${skill}`),
      ...(concept.misconceptions ?? []).map((item) => `- Misconception to address: ${item}`)
        ])
      ]
    : ["No knowledge skills or misconceptions are currently selected. Do not infer additional targets."];

  return [...boundary, "", ...selected].join("\n");
}

const suggestionSchema = z.object({
  selections: z.array(z.object({
    conceptId: z.string().min(1),
    skills: z.array(z.string().min(1)).default([]),
    misconceptions: z.array(z.string().min(1)).default([])
  })).max(500)
});

export async function suggestActivityKnowledgeSelections(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  knowledge: ActivityGenerationKnowledge;
  generatedActivity: string;
}): Promise<ActivityKnowledgeConceptSelection[] | undefined> {
  if (input.knowledge.mode !== "suggest") return undefined;
  if (!input.knowledge.concepts.length) return [];

  const catalog = input.knowledge.concepts.map((concept) => ({
    conceptId: concept.id,
    concept: concept.title,
    skills: concept.skills,
    misconceptions: concept.misconceptions ?? []
  }));
  let userPrompt = [
    "Select the skills genuinely assessed or practiced and the misconceptions explicitly elicited or addressed by this generated activity.",
    "A skill is something the learner can perform or an observable learning goal.",
    "Use only exact conceptId, skill, and misconception strings from the catalog. Select no more than needed.",
    "Return only JSON in this shape: {\"selections\":[{\"conceptId\":\"...\",\"skills\":[\"exact skill\"],\"misconceptions\":[\"exact misconception\"]}]}",
    "Return {\"selections\":[]} when none apply.",
    "",
    "Knowledge catalog:",
    JSON.stringify(catalog),
    "",
    "Generated activity:",
    input.generatedActivity.slice(0, 50000)
  ].join("\n");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateQuestionAuthoringText(input.user, {
      systemPrompt: "You map generated learning activities to an authoritative catalog of knowledge skills and misconceptions. Return valid JSON only.",
      userPrompt,
      maxOutputTokens: 2500
    });
    const parsed = parseJson(raw);
    const validated = suggestionSchema.safeParse(parsed);
    if (validated.success) {
      const concepts = new Map(input.knowledge.concepts.map((concept) => [concept.id, concept]));
      const selectedByConcept = new Map<string, { skills: Set<string>; misconceptions: Set<string> }>();
      for (const selection of validated.data.selections) {
        const available = concepts.get(selection.conceptId);
        if (!available) continue;
        const selected = selectedByConcept.get(selection.conceptId) ?? { skills: new Set<string>(), misconceptions: new Set<string>() };
        selection.skills.filter((skill) => available.skills.includes(skill)).forEach((skill) => selected.skills.add(skill));
        selection.misconceptions.filter((item) => (available.misconceptions ?? []).includes(item)).forEach((item) => selected.misconceptions.add(item));
        if (selected.skills.size || selected.misconceptions.size) selectedByConcept.set(selection.conceptId, selected);
      }
      return [...selectedByConcept].map(([conceptId, selected]) => {
        const concept = input.knowledge.concepts.find((candidate) => candidate.id === conceptId)!;
        const selectedSkills = [...selected.skills];
        const selectedMisconceptions = [...selected.misconceptions];
        return {
          conceptId,
          selectsAllSkills: false,
          selectedSkills,
          selectedSkillIds: selectedSkills.map((skill) => concept.skillIds?.[concept.skills.indexOf(skill)]).filter((skillId): skillId is string => Boolean(skillId)),
          selectedMisconceptions,
          selectedMisconceptionIds: selectedMisconceptions.map((item) => concept.misconceptionIds?.[(concept.misconceptions ?? []).indexOf(item)]).filter((itemId): itemId is string => Boolean(itemId))
        };
      });
    }
    userPrompt = `The previous response was invalid. Return the requested JSON only.\n\nPrevious response:\n${raw}`;
  }
  throw new AppError(422, "ACTIVITY_KNOWLEDGE_SUGGESTION_INVALID", "The AI agent could not select valid knowledge targets for the generated activity.");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
  } catch {
    return null;
  }
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function normalizeVariationLocale(value: string): "en" | "fr" | "zh" | "ar" {
  return value === "fr" || value === "zh" || value === "ar" ? value : "en";
}
