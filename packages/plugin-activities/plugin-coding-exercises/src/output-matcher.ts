import { RE2 } from "re2-wasm";
import type { CodingExerciseOutputMatchMode } from "./coding-exercises";

export const maxCodingExerciseRegexLength = 4000;

export type CodingExerciseOutputMatcher = {
  outputMatchMode: CodingExerciseOutputMatchMode;
  containsLinesOrderMatters: boolean;
};

export type CodingExerciseOutputComparison = {
  matched: boolean;
  message: string | null;
};

export function validateCodingExerciseOutputMatcher(expectedOutput: string, matcher: CodingExerciseOutputMatcher) {
  if (matcher.outputMatchMode === "contains_lines") {
    if (!getRequiredLines(expectedOutput).length) {
      return "Contains lines requires at least one non-empty expected line.";
    }
    return null;
  }

  if (matcher.outputMatchMode === "regex") {
    if (!expectedOutput.length) {
      return "Regex matching requires a non-empty pattern.";
    }
    if (expectedOutput.length > maxCodingExerciseRegexLength) {
      return `Regex patterns cannot exceed ${maxCodingExerciseRegexLength} characters.`;
    }
    try {
      new RE2(expectedOutput, "u");
    } catch (error) {
      return error instanceof Error ? `Invalid regular expression: ${error.message}` : "Invalid regular expression.";
    }
  }

  return null;
}

export function compareCodingExerciseOutput(
  expectedOutput: string,
  stdout: string,
  matcher: CodingExerciseOutputMatcher
): CodingExerciseOutputComparison {
  const validationError = validateCodingExerciseOutputMatcher(expectedOutput, matcher);
  if (validationError) {
    return { matched: false, message: validationError };
  }

  if (matcher.outputMatchMode === "exact") {
    const matched = normalizeLineEndings(stdout).trim() === normalizeLineEndings(expectedOutput).trim();
    return {
      matched,
      message: matched ? null : "Output did not exactly match the expected output."
    };
  }

  if (matcher.outputMatchMode === "regex") {
    const matched = new RE2(expectedOutput, "u").test(stdout);
    return {
      matched,
      message: matched ? null : "Program output did not match the expected regular expression."
    };
  }

  const requiredLines = getRequiredLines(expectedOutput);
  const outputLines = normalizeLineEndings(stdout).split("\n");
  const matched = matcher.containsLinesOrderMatters
    ? containsLinesInOrder(outputLines, requiredLines)
    : containsLinesInAnyOrder(outputLines, requiredLines);

  return {
    matched,
    message: matched
      ? null
      : matcher.containsLinesOrderMatters
        ? "Program output did not contain every expected line in the required order."
        : "Program output did not contain every expected line."
  };
}

export function getJudge0ExpectedOutput(expectedOutput: string, matcher: CodingExerciseOutputMatcher) {
  return matcher.outputMatchMode === "exact" ? expectedOutput : undefined;
}

function getRequiredLines(expectedOutput: string) {
  return normalizeLineEndings(expectedOutput)
    .split("\n")
    .filter((line) => line.trim().length > 0);
}

function containsLinesInOrder(outputLines: string[], requiredLines: string[]) {
  let outputIndex = 0;
  for (const requiredLine of requiredLines) {
    const nextIndex = outputLines.indexOf(requiredLine, outputIndex);
    if (nextIndex === -1) {
      return false;
    }
    outputIndex = nextIndex + 1;
  }
  return true;
}

function containsLinesInAnyOrder(outputLines: string[], requiredLines: string[]) {
  const availableLineCounts = new Map<string, number>();
  for (const line of outputLines) {
    availableLineCounts.set(line, (availableLineCounts.get(line) ?? 0) + 1);
  }

  for (const requiredLine of requiredLines) {
    const availableCount = availableLineCounts.get(requiredLine) ?? 0;
    if (!availableCount) {
      return false;
    }
    availableLineCounts.set(requiredLine, availableCount - 1);
  }
  return true;
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n?/g, "\n");
}
