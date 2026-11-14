import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { parseMcqSource, constrainMcqAnswers } from "./mcq";
import { mcqBlocksMarkdown } from "./submission-export";
export const mcqWorkInspection: NonNullable<ServerActivityPlugin["workInspection"]> = {
  activityTypeKeys: ["mcq"],
  async read({ state, activity }) {
    if (!state) return { sections: [] };
    const parsed = parseMcqSource(String(activity.config?.source ?? ""), String(activity.config?.defaultCodeLanguage ?? "none"));
    const value = state.answers && typeof state.answers === "object" && !Array.isArray(state.answers) ? state.answers as Record<string, unknown> : {};
    const answers = constrainMcqAnswers(activity.config, Object.fromEntries(Object.entries(value).map(([id, choices]) => [id, Array.isArray(choices) ? choices.filter((choice): choice is string => typeof choice === "string") : []])));
    return { sections: parsed.questions.map(question => ({ id: question.id, title: question.title, blocks: [
      { kind: "markdown" as const, text: mcqBlocksMarkdown([...question.leadingBlocks, ...question.promptBlocks]) },
      { kind: "markdown" as const, text: question.choices.map(choice => `${answers[question.id]?.includes(choice.id) ? "☑" : "☐"} ${mcqBlocksMarkdown(choice.blocks)}`).join("\n\n") }
    ] })) };
  }
};
