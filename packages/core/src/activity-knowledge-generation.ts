import { z } from "zod";
import type { ActivityKnowledgeConceptSelection } from "@cognelo/contracts";
import { AppError } from "./errors";
import { generateQuestionAuthoringText } from "./ai-agents";

const knowledgeConceptSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(500),
  skills: z.array(z.string().min(1).max(1000)).max(100)
});

export const activityGenerationKnowledgeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("selected"), concepts: z.array(knowledgeConceptSchema).max(500) }),
  z.object({ mode: z.literal("suggest"), concepts: z.array(knowledgeConceptSchema).max(500) }),
  z.object({ mode: z.literal("ignore") })
]);

export type ActivityGenerationKnowledge = z.infer<typeof activityGenerationKnowledgeSchema>;

export function selectedSkillsGenerationPrompt(knowledge: ActivityGenerationKnowledge) {
  if (knowledge.mode !== "selected") return "";
  if (!knowledge.concepts.length) {
    return "No knowledge skills are currently selected. Do not infer additional skills as generation constraints.";
  }
  return [
    "The generated activity must assess or practice these selected learning skills:",
    ...knowledge.concepts.flatMap((concept) => [
      `Concept: ${concept.title}`,
      ...concept.skills.map((skill) => `- ${skill}`)
    ])
  ].join("\n");
}

const suggestionSchema = z.object({
  selections: z.array(z.object({
    conceptId: z.string().min(1),
    skills: z.array(z.string().min(1)).default([])
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
    skills: concept.skills
  }));
  let userPrompt = [
    "Select the skills genuinely assessed or practiced by this generated activity.",
    "A skill is something the learner can perform or an observable learning goal.",
    "Use only exact conceptId and skill strings from the catalog. Select no more than needed.",
    "Return only JSON in this shape: {\"selections\":[{\"conceptId\":\"...\",\"skills\":[\"exact skill\"]}]}",
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
      systemPrompt: "You map generated learning activities to an authoritative knowledge-skill catalog. Return valid JSON only.",
      userPrompt,
      maxOutputTokens: 2500
    });
    const parsed = parseJson(raw);
    const validated = suggestionSchema.safeParse(parsed);
    if (validated.success) {
      const concepts = new Map(input.knowledge.concepts.map((concept) => [concept.id, new Set(concept.skills)]));
      const selectedByConcept = new Map<string, Set<string>>();
      for (const selection of validated.data.selections) {
        const available = concepts.get(selection.conceptId);
        if (!available) continue;
        const selected = selectedByConcept.get(selection.conceptId) ?? new Set<string>();
        selection.skills.filter((skill) => available.has(skill)).forEach((skill) => selected.add(skill));
        if (selected.size) selectedByConcept.set(selection.conceptId, selected);
      }
      return [...selectedByConcept].map(([conceptId, skills]) => ({
        conceptId,
        selectsAllSkills: false,
        selectedSkills: [...skills]
      }));
    }
    userPrompt = `The previous response was invalid. Return the requested JSON only.\n\nPrevious response:\n${raw}`;
  }
  throw new AppError(422, "ACTIVITY_KNOWLEDGE_SUGGESTION_INVALID", "The AI agent could not select valid skills for the generated activity.");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
  } catch {
    return null;
  }
}
