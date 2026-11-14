import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
export const codingWorkInspection: NonNullable<ServerActivityPlugin["workInspection"]> = {
  activityTypeKeys: ["coding-exercise"],
  async read({ state, activity }) {
    const source = state?.sourceCode;
    return { sections: typeof source === "string" && source.length ? [{ id: "code", blocks: [{ kind: "code", text: source, language: typeof activity.config?.language === "string" ? activity.config?.language : "text" }] }] : [] };
  }
};
