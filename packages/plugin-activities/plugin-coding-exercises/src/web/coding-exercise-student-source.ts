import { assembleCodingBlankSource, codingBlankAnswersSchema } from "../code-blanks";
import { codingFiles, readCodingSourceFiles, formatCodingSourceFiles, type CodingSourceFile } from "../coding-files";
import { codingBlankAnswer, codingBlankIds, readCodingBlankResponse } from "../code-blanks";
import {
  alignCodingExerciseStarterCodeToTemplate,
  buildCodingExerciseTemplateSource,
  codingExerciseTemplateInsertionToken,
  parseCodingExerciseConfig,
  type CodingExerciseConfig
} from "../coding-exercises";

const fallbackConfig: CodingExerciseConfig = {
  prompt: "",
  language: "",
  executionMode: "template",
  starterCode: "",
  studentTemplateSource: "{{ STUDENT_CODE }}",
  sampleTests: [],
  maxEditorSeconds: 1800
};

export function getCodingExerciseActivityConfig(activityConfig: Record<string, unknown> | undefined): CodingExerciseConfig {
  return normalizeCodingExerciseConfigForDisplay(parseCodingExerciseConfig(activityConfig ?? fallbackConfig));
}

export function getCodingExerciseInitialStudentSource(activityConfig: Record<string, unknown> | undefined): string {
  const config = getCodingExerciseActivityConfig(activityConfig);
  if (config.files) return config.responseMode === "blanks" ? "" : formatCodingSourceFiles(getCodingExerciseStudentFiles(config));
  return config.responseMode === "blanks" ? "" : alignCodingExerciseStarterCodeToTemplate(config.starterCode, config.studentTemplateSource);
}

export function hasCodingExerciseAnswer(config: Record<string, unknown>, state: Record<string, unknown> | null) {
  if (config.responseMode === "blanks") {
    const response = readCodingBlankResponse(state);
    return !!response && codingBlankIds(Array.isArray(config.files) ? config.files.map(file => typeof file?.blankTemplate === "string" ? file.blankTemplate : "").join("\n") : typeof config.blankTemplate === "string" ? config.blankTemplate : "").some(id => codingBlankAnswer(response.blankAnswers, id).trim().length > 0);
  }
  if (Array.isArray(config.files)) {
    const files = getCodingExerciseStudentFiles(getCodingExerciseActivityConfig(config), state);
    const initial = getCodingExerciseStudentFiles(getCodingExerciseActivityConfig(config));
    return files.some(file => file.sourceCode.trim() && file.sourceCode.trim() !== initial.find(candidate => candidate.id === file.id)?.sourceCode.trim());
  }
  const source = typeof state?.sourceCode === "string" ? state.sourceCode.trim() : "";
  return source.length > 0 && source !== getCodingExerciseInitialStudentSource(config).trim();
}

export function normalizeCodingExerciseConfigForDisplay(config: CodingExerciseConfig): CodingExerciseConfig {
  if (!config.studentTemplateSource.trim() && config.starterCode.includes(codingExerciseTemplateInsertionToken)) {
    return {
      ...config,
      executionMode: "template",
      studentTemplateSource: config.starterCode,
      starterCode: ""
    };
  }

  if (!config.studentTemplateSource.trim()) {
    return {
      ...config,
      executionMode: "template",
      studentTemplateSource: buildCodingExerciseTemplateSource("", "")
    };
  }

  return {
    ...config,
    executionMode: "template"
  };
}

export function getCodingExerciseStudentFiles(config: CodingExerciseConfig, state?: Record<string, unknown> | null, preserveLayout = false): CodingSourceFile[] {
  const savedFiles = readCodingSourceFiles(state?.files);
  if (preserveLayout && savedFiles) return savedFiles;
  if (!config.files) return [];
  const parsedAnswers = codingBlankAnswersSchema.safeParse(state?.blankAnswers);
  const answers = parsedAnswers.success ? parsedAnswers.data : {};
  return codingFiles(config).map(file => ({ id: file.id, name: file.name, studentTemplateSource: file.studentTemplateSource,
    sourceCode: config.responseMode === "blanks" ? assembleCodingBlankSource(file.blankTemplate ?? "", answers)
      : savedFiles?.find(saved => saved.id === file.id)?.sourceCode ?? alignCodingExerciseStarterCodeToTemplate(file.starterCode, file.studentTemplateSource),
    ...(config.responseMode === "blanks" ? { blankTemplate: file.blankTemplate ?? "" } : {}) }));
}
