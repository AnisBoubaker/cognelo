import { feedbackExportBlocks, type AnswerExportBlock, type AnswerExportLabels } from "@cognelo/activity-sdk/server";
import type { HomeworkRubricFeedback } from "./rubric";

/** Saved, human-facing rubric fields only; no private policy, model output or hashes. */
export function homeworkRubricExportBlocks(feedback: HomeworkRubricFeedback, labels: AnswerExportLabels): AnswerExportBlock[] {
  const blocks = feedbackExportBlocks({ summary: feedback.summary, strengths: feedback.strengths, improvements: feedback.improvements }, labels);
  const rows: string[][] = [];
  const score = (value: number | null, weight: number) => value === null ? labels.unavailable : `${Number((value * weight / 100).toFixed(2))} / ${weight}`;
  if (feedback.codeWeightPercent > 0) {
    rows.push([labels.file, `${feedback.codeWeightPercent}%`, score(feedback.codeScore, feedback.codeWeightPercent)]);
    blocks.push(...feedbackExportBlocks(feedback.code, labels));
  }
  if (feedback.questionsWeightPercent > 0) {
    rows.push([labels.question, `${feedback.questionsWeightPercent}%`, score(feedback.questionsScore, feedback.questionsWeightPercent)]);
    feedback.questions.forEach((question, index) => {
      blocks.push({ kind: "markdown", title: `${labels.question} ${index + 1}`, text: labels.rubric }, ...feedbackExportBlocks(question, labels));
    });
  }
  if (rows.length) blocks.unshift({ kind: "table", title: labels.grading, headers: [labels.criterion, labels.weight, labels.score], rows });
  return blocks;
}
