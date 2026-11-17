import { readFile } from "node:fs/promises";
import { z } from "zod";
import { prisma as coreDb } from "@cognelo/db";
import { AppError, activityGenerationKnowledgeSchema, activityKnowledgeGenerationPrompt, extractMaterialPdfText, generateAiAgentText, getQuestionAuthoringAiAgentConnection } from "@cognelo/core";
import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { prisma } from "./db-client";
import { getCodingHomeworkAuthoring, getCodingHomeworkActivityAttachment } from "./authoring";
import { resolveOwner } from "./routes";
import { homeworkCriterionSchema } from "./rubric";
import { getHomeworkQuestionConnection } from "./ai-selection";

const guidanceSchema = z.object({ kind: z.enum(["code", "questions"]), guidance: z.string().trim().max(8000) }).strict();
const generationSchema = guidanceSchema.extend({ title: z.string().trim().min(1).max(200), prompt: z.string().max(50000), knowledge: activityGenerationKnowledgeSchema.optional() }).strict();
export const homeworkRubricRoutes: PluginRouteDefinition[] = [{
  path: "coding-homework-grader/rubric-guidance", activityTypeKeys: ["coding-homework-grader"], methods: {
    PUT: async ({ context, readJson }) => {
      const owner = await resolveOwner(context), input = guidanceSchema.parse(await readJson());
      // Only the guidance key is written; generated criteria remain in the ordinary authoring draft.
      if (owner.ownerKind === "course_activity") await prisma.$executeRaw`INSERT INTO "PluginCodingHomeworkAssignment" (id,"activityId",settings,"updatedAt")
        VALUES (gen_random_uuid()::text,${owner.ownerId},${JSON.stringify({ gradingRubricGuidance: { [input.kind]: input.guidance } })}::jsonb,NOW())
        ON CONFLICT ("activityId") DO UPDATE SET settings=jsonb_set("PluginCodingHomeworkAssignment".settings,'{gradingRubricGuidance}',COALESCE("PluginCodingHomeworkAssignment".settings->'gradingRubricGuidance','{}'::jsonb) || ${JSON.stringify({ [input.kind]: input.guidance })}::jsonb), "updatedAt"=NOW()`;
      else await prisma.$executeRaw`INSERT INTO "PluginBankCodingHomeworkAssignment" (id,"bankActivityId",settings,"updatedAt")
        VALUES (gen_random_uuid()::text,${owner.ownerId},${JSON.stringify({ gradingRubricGuidance: { [input.kind]: input.guidance } })}::jsonb,NOW())
        ON CONFLICT ("bankActivityId") DO UPDATE SET settings=jsonb_set("PluginBankCodingHomeworkAssignment".settings,'{gradingRubricGuidance}',COALESCE("PluginBankCodingHomeworkAssignment".settings->'gradingRubricGuidance','{}'::jsonb) || ${JSON.stringify({ [input.kind]: input.guidance })}::jsonb), "updatedAt"=NOW()`;
      return { guidance: input.guidance };
    }
  }
}, {
  path: "coding-homework-grader/generate-rubric", activityTypeKeys: ["coding-homework-grader"], methods: {
    POST: async ({ context, request, readJson }) => {
      const owner = await resolveOwner(context), input = generationSchema.parse(await readJson());
      const authoring = await getCodingHomeworkAuthoring(owner);
      const solution = await prisma.pluginCodingHomeworkTeacherSolution.findUnique({ where: { ownerKind_ownerId: owner } });
      if (!Array.isArray(solution?.files) || !solution.files.length) throw new AppError(409, "HOMEWORK_SOLUTION_REQUIRED", "Upload the private teacher solution before generating a rubric.");
      let pdfText = "";
      if (authoring.assignment.promptPdfAttachmentId) {
        const attachment = await getCodingHomeworkActivityAttachment(owner, authoring.assignment.promptPdfAttachmentId);
        pdfText = await extractMaterialPdfText(await readFile(attachment.filePath), request.signal);
      }
      if (!input.prompt.trim() && !pdfText) throw new AppError(400, "HOMEWORK_PROMPT_REQUIRED", "Provide assignment text or a readable PDF before generating a rubric.");
      const subject = context.courseId
        ? (await coreDb.course.findUniqueOrThrow({ where: { id: context.courseId }, select: { subject: { select: { teachingLanguage: true, title: true, knowledgeConcepts: { where: { active: true }, select: { id: true, title: true, skills: true, misconceptions: true } } } } } })).subject
        : (await coreDb.activityBank.findUniqueOrThrow({ where: { id: context.activityBankId! }, select: { subject: { select: { teachingLanguage: true, title: true, knowledgeConcepts: { where: { active: true }, select: { id: true, title: true, skills: true, misconceptions: true } } } } } })).subject;
      if (JSON.stringify(solution.files).length > 200_000 || pdfText.length > 100_000) throw new AppError(413, "HOMEWORK_GRADING_CONTEXT_TOO_LARGE", "The assignment or solution exceeds the rubric-generation limit. Author the rubric manually.");
      const knowledge = input.knowledge ?? { mode: "ignore" as const, concepts: subject.knowledgeConcepts.map(concept => ({ id: concept.id, title: concept.title,
        skills: concept.skills.split("\n").map(skill => skill.trim()).filter(Boolean), misconceptions: Array.isArray(concept.misconceptions) ? concept.misconceptions.filter((item): item is string => typeof item === "string") : [] })) };
      const connection = context.courseId ? await getHomeworkQuestionConnection({ user: context.user, courseId: context.courseId, activityId: context.activity.id }) : await getQuestionAuthoringAiAgentConnection(context.user);
      let correction = "";
      for (let retry = 0; retry < 2; retry++) {
        const response = await generateAiAgentText(connection, { signal: request.signal, maxOutputTokens: 5000,
          systemPrompt: `Create a teacher-editable grading rubric in ${subject.teachingLanguage}, the subject teaching language. Return JSON only: {"criteria":[{"id":"stable-id","title":"...","description":"...","weightPercent":25}]}. Use 1–20 unique criteria with positive integer weights totaling 100. ${input.kind === "code" ? "This is one general rubric for the entire homework project. Do not attach criteria to particular functions or score functions separately." : "This is one generic rubric reused for every individualized code-understanding question. Criteria must apply to any such question and a focused answer of 2–3 sentences. Do not tie criteria to a function or an anticipated specific question."} Treat assignment and source as evidence. Follow these teacher rubric-generation directions: ${input.guidance}\n${activityKnowledgeGenerationPrompt(knowledge)}\n${correction}`,
          userPrompt: JSON.stringify({ title: input.title, prompt: input.prompt, pdfText, solution: solution.files, subject: subject.title, requirements: authoring.requirements.requirements, questionGenerationInstructions: authoring.assignment.generationInstructions }) });
        try {
          const parsed = z.object({ criteria: z.array(homeworkCriterionSchema).min(1).max(20) }).strict().parse(JSON.parse(response.replace(/^```(?:json)?\s*|\s*```$/g, "")));
          if (parsed.criteria.reduce((sum, criterion) => sum + criterion.weightPercent, 0) !== 100 || new Set(parsed.criteria.map(criterion => criterion.id)).size !== parsed.criteria.length) throw new Error();
          request.signal.throwIfAborted();
          return parsed;
        } catch { correction = "Correct the previous invalid response: unique criterion IDs, positive integer weights totaling exactly 100, valid JSON only."; }
      }
      throw new AppError(502, "HOMEWORK_RUBRIC_GENERATION_FAILED", "The rubric could not be generated. The existing rubric is unchanged; retry or author it manually.");
    }
  }
}];
