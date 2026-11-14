import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { prisma } from "./db-client";
import { projectParsonsState } from "./attempt-types";
export const parsonsWorkInspection: NonNullable<ServerActivityPlugin["workInspection"]> = {
  activityTypeKeys: ["parsons-problem"],
  async read(context) {
    const saved = !context.embedded && context.participant.userId ? await prisma.pluginParsonsAttempt.findFirst({
      where: { activityId: context.activity.id, userId: context.participant.userId, status: "in_progress" }, orderBy: { updatedAt: "desc" }, select: { latestState: true, updatedAt: true }
    }) : null;
    const value = context.embedded ? context.state : saved?.latestState;
    const state = value && typeof value === "object" && !Array.isArray(value) ? projectParsonsState(value as Record<string, unknown>) : {};
    const blocks = Array.isArray(state.blocks) ? state.blocks as Array<{ displayText: string; currentIndent: number }> : [];
    return { savedAt: saved?.updatedAt.toISOString() ?? null, sections: blocks.length ? [{ id: "arrangement", blocks: [{ kind: "code", language: String(context.activity.config?.language ?? "text"),
      text: blocks.map(block => `${"  ".repeat(Math.max(0, Math.min(30, block.currentIndent)))}${block.displayText}`).join("\n") }] }] : [] };
  }
};
