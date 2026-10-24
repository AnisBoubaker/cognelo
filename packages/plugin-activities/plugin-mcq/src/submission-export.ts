import { prisma } from "./db-client";
import { exportRecord, exportText, feedbackExportBlocks, type AnswerExportBlock, type SubmissionExportHandler } from "@cognelo/activity-sdk/server";
import { parseMcqSource, type McqBlock } from "./mcq";
const markdown = (blocks: McqBlock[]): string => blocks.map((block) => {
  if (block.type === "code") return `\n\`\`\`${block.language}\n${block.code}\n\`\`\`\n`;
  if (block.type === "table") return block.markdown;
  if (block.type === "math") return block.display ? `$$${block.expression}$$` : `$${block.expression}$`;
  if (block.type === "list") return block.items.map((item, i) => `${block.ordered ? `${i + 1}.` : "-"} ${item}`).join("\n");
  return block.type === "heading" ? `${"#".repeat(Math.min(6, block.level))} ${block.text}` : block.text;
}).join("\n\n");
export const exportMcqSubmission: SubmissionExportHandler = async (input) => {
  const { labels } = input;
  const parsed = parseMcqSource(exportText(input.activity.config?.source), exportText(input.activity.config?.defaultCodeLanguage) || "none");
  const answers = exportRecord(input.state?.answers ?? input.metadata.submittedAnswers);
  const answer: AnswerExportBlock[] = [];
  for (const [index, question] of parsed.questions.entries()) {
    const selected = Array.isArray(answers[question.id]) ? answers[question.id] as string[] : [];
    if (input.includePrompt) answer.push({ kind: "markdown", title: `${labels.question} ${index + 1}: ${question.title}`, text: markdown([...question.leadingBlocks, ...question.promptBlocks]) });
    const choices = input.includePrompt ? question.choices : question.choices.filter((choice) => selected.includes(choice.id));
    answer.push({ kind: "markdown", title: `${labels.answer} ${index + 1}`, text: choices.length
      ? choices.map((choice) => `${selected.includes(choice.id) ? "☑" : "☐"} ${markdown(choice.blocks)}`).join("\n\n") : labels.noAnswer });
    if (input.includeGrading) answer.push({ kind: "markdown", title: labels.correctAnswer, text: question.choices.filter((choice) => choice.isCorrect).map((choice) => markdown(choice.blocks)).join("\n\n") });
  }
  const savedFeedback = input.includeGrading && !input.state && !Object.keys(input.feedback).length ? await prisma.pluginMcqAiEvaluation.findFirst({
    where: { activityId: input.activity.id, coreAttemptId: input.coreAttemptId, status: "completed" }, orderBy: { version: "desc" }, select: { sanitizedFeedback: true }
  }) : null;
  return { prompt: input.includePrompt && parsed.introBlocks.length ? [{ kind: "markdown", text: markdown(parsed.introBlocks) }] : [], answer, grading: input.includeGrading ? feedbackExportBlocks(savedFeedback?.sanitizedFeedback ?? input.feedback, labels) : [] };
};
