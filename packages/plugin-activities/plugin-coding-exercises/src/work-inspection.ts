import { readCodingSourceFiles } from "./coding-files";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
export const codingWorkInspection: NonNullable<ServerActivityPlugin["workInspection"]> = {
  activityTypeKeys: ["coding-exercise"],
  async read({ state, activity }) {
    const source = state?.sourceCode;
    const files = readCodingSourceFiles(state?.files);
    if (files) return { sections: files.map(file => ({ id: file.id, title: file.name, blocks: [{ kind: "code" as const, text: file.sourceCode, language: String(activity.config?.language ?? "text") }] })) };
    return { sections: typeof source === "string" && source.length ? [{ id: "code", blocks: [{ kind: "code", text: source, language: typeof activity.config?.language === "string" ? activity.config?.language : "text" }] }] : [] };
  }
};
