import type { Judge0SubmissionResult } from "./judge0";

// Keep a runaway program from turning one saved run (and every later history response)
// into a megabyte-scale page. Comparison always uses Judge0's complete result first.
export const MAX_EXECUTION_OUTPUT_BYTES = 16 * 1024;
export const MAX_EXECUTION_MESSAGE_BYTES = 4 * 1024;

const OUTPUT_SUMMARY_KEYS = new Set(["stdout", "stderr", "compileOutput", "message", "comparisonMessage"]);

export function capExecutionText(value: string | null | undefined, maxBytes = MAX_EXECUTION_OUTPUT_BYTES) {
  if (typeof value !== "string") return { value, truncated: false };
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= maxBytes) return { value, truncated: false };

  // Do not split a UTF-8 character at the byte boundary.
  let end = maxBytes;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return { value: bytes.subarray(0, end).toString("utf8"), truncated: true };
}

export function capJudge0Output(result: Judge0SubmissionResult) {
  const stdout = capExecutionText(result.stdout);
  const stderr = capExecutionText(result.stderr);
  const compileOutput = capExecutionText(result.compile_output);
  const message = capExecutionText(result.message, MAX_EXECUTION_MESSAGE_BYTES);
  return {
    stdout: stdout.value,
    stderr: stderr.value,
    compileOutput: compileOutput.value,
    message: message.value,
    outputTruncated: stdout.truncated || stderr.truncated || compileOutput.truncated || message.truncated
  };
}

// Older rows may predate the write cap. Bound their nested test diagnostics before
// returning them to browsers or passing them into later grading feedback.
export function capExecutionResultSummary(value: unknown): { value: unknown; truncated: boolean } {
  if (Array.isArray(value)) {
    const entries = value.map(capExecutionResultSummary);
    return { value: entries.map((entry) => entry.value), truncated: entries.some((entry) => entry.truncated) };
  }
  if (!value || typeof value !== "object") return { value, truncated: false };

  let truncated = false;
  const result = Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const capped = typeof entry === "string" && OUTPUT_SUMMARY_KEYS.has(key)
      ? capExecutionText(entry, key === "message" || key === "comparisonMessage" ? MAX_EXECUTION_MESSAGE_BYTES : MAX_EXECUTION_OUTPUT_BYTES)
      : capExecutionResultSummary(entry);
    truncated ||= capped.truncated;
    return [key, capped.value];
  }));
  return { value: result, truncated };
}
