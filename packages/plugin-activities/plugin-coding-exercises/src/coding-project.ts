import { AppError } from "@cognelo/core";
import { assembleCodingBlankSource, codingBlankAnswer, codingBlankIds, type CodingBlankAnswers } from "./code-blanks";
import { codingFiles, codingFilePrivate, codingSourceFilesSchema, formatCodingSourceFiles, type CodingSourceFile } from "./coding-files";
import { alignCodingExerciseStarterCodeToTemplate, buildCodingExerciseSource, type CodingExerciseConfig, type CodingExercisePrivateConfig } from "./coding-exercises";

export function resolveCodingFileInput<T extends { sourceCode: string; files?: CodingSourceFile[]; blankAnswers?: CodingBlankAnswers; blankTemplate?: string }>(
  config: CodingExerciseConfig, input: T
): T {
  if (!config.files) return input;
  const definitions = codingFiles(config);
  const supplied = new Map((input.files ?? []).map(file => [file.id, file]));
  if ([...supplied.keys()].some(id => !definitions.some(file => file.id === id))) throw new AppError(409, "CODING_EXERCISE_FILES_CHANGED", "The exercise files changed. Reload before running or submitting.");
  if (!input.files && input.sourceCode.trim()) throw new AppError(409, "CODING_EXERCISE_FILES_REQUIRED", "Submit the exercise's individual source files.");
  const ids = definitions.flatMap(file => codingBlankIds(file.blankTemplate ?? ""));
  if (config.responseMode === "blanks" && Object.keys(input.blankAnswers ?? {}).some(id => !ids.includes(id))) throw new AppError(409, "CODING_EXERCISE_BLANK_RESPONSE_INVALID", "The answer contains an unknown code blank.");
  const untouched = !input.sourceCode.trim() && !(input.files?.length);
  const answers = Object.fromEntries(ids.map(id => [id, codingBlankAnswer(input.blankAnswers ?? {}, id)]));
  const hasBlankAnswers = Object.values(input.blankAnswers ?? {}).some(value => value.trim());
  if (config.responseMode === "blanks" && hasBlankAnswers && definitions.some(file => !supplied.has(file.id))) throw new AppError(409, "CODING_EXERCISE_FILES_CHANGED", "Reload the full file workspace before submitting blank values.");
  const files = codingSourceFilesSchema.parse(definitions.map(file => {
    const submitted = supplied.get(file.id);
    if (config.responseMode === "blanks" && submitted && submitted.blankTemplate !== (file.blankTemplate ?? "")) {
      throw new AppError(409, "CODING_EXERCISE_BLANK_RESPONSE_INVALID", "The code template changed. Reload before running or submitting.");
    }
    return { id: file.id, name: file.name, studentTemplateSource: file.studentTemplateSource,
      sourceCode: config.responseMode === "blanks" ? assembleCodingBlankSource(file.blankTemplate ?? "", answers)
        : submitted?.sourceCode ?? (untouched ? "" : alignCodingExerciseStarterCodeToTemplate(file.starterCode, file.studentTemplateSource)),
      ...(config.responseMode === "blanks" ? { blankTemplate: file.blankTemplate ?? "" } : {}) };
  }));
  const sourceCode = config.responseMode === "blanks" && !Object.values(answers).some(value => value.trim()) ? "" : formatCodingSourceFiles(files);
  const result = { ...input, files, sourceCode, ...(config.responseMode === "blanks" ? { blankAnswers: answers, blankTemplate: definitions[0].blankTemplate ?? "" } : {}) };
  if (config.responseMode !== "blanks") { delete result.blankAnswers; delete result.blankTemplate; }
  return result;
}

/** The first file is the entry point and receives the test harness; every file keeps its own scaffold. */
export function codingExecutionSources(input: {
  config: CodingExerciseConfig; privateConfig: CodingExercisePrivateConfig; sourceCode: string; files?: CodingSourceFile[]; testCode?: string;
}) {
  if (!input.files) return { sourceCode: buildCodingExerciseSource({ ...input, studentSourceCode: input.sourceCode }) };
  const files = input.files.map((file, index) => {
    const privateFile = codingFilePrivate(index === 0 || input.privateConfig.fileSources?.[file.id] ? input.privateConfig : {}, file.id);
    return { name: file.name, sourceCode: buildCodingExerciseSource({ config: input.config,
      privateConfig: { ...input.privateConfig, ...privateFile }, studentSourceCode: file.sourceCode, testCode: index === 0 ? input.testCode : "", includeRuntimeEpilogue: index === 0 }) };
  });
  return { sourceCode: "", files };
}
