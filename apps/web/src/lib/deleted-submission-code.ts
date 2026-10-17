/** Read retained student code only; never fall back to an activity's reference solution. */
export function deletedSubmissionCode(metadata: Record<string, unknown>): string | null {
  if (typeof metadata.submittedSourceCode === "string") return metadata.submittedSourceCode;
  const state = record(metadata.submittedState);
  const blocks = Array.isArray(state?.blocks) ? state.blocks : [];
  const lines = blocks.flatMap((value) => {
    const block = record(value);
    if (typeof block?.displayText !== "string") return [];
    const indent = typeof block.currentIndent === "number" && Number.isFinite(block.currentIndent)
      ? Math.max(0, Math.min(100, Math.floor(block.currentIndent))) : 0;
    return [`${"  ".repeat(indent)}${block.displayText}`];
  });
  return lines.length ? lines.join("\n") : null;
}

export function deletedSubmissionFiles(metadata: Record<string, unknown>) {
  const files = Array.isArray(metadata.submittedFiles) ? metadata.submittedFiles : [];
  return files.flatMap((value) => {
    const file = record(value);
    if (typeof file?.path !== "string" || typeof file.starterCode !== "string") return [];
    return [{ path: file.path, code: file.starterCode, language: typeof file.language === "string" ? file.language : "text" }];
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
