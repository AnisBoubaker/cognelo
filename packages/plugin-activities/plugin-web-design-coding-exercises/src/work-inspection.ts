import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { constrainWebDesignStudentFiles } from "./web-design-coding-exercises";
export const webDesignWorkInspection: NonNullable<ServerActivityPlugin["workInspection"]> = {
  activityTypeKeys: ["web-design-coding-exercise"],
  async read({ state, activity }) {
    const files = Array.isArray(state?.files) ? constrainWebDesignStudentFiles(activity.config, state.files) : [];
    return { sections: files.flatMap((value, index) => {
      const file = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
      return typeof file.starterCode === "string" ? [{ id: `file-${index}`, title: String(file.path ?? ""), blocks: [{ kind: "code" as const, text: file.starterCode, language: String(file.language ?? "text") }] }] : [];
    }) };
  }
};
