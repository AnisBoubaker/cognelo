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
  return alignCodingExerciseStarterCodeToTemplate(config.starterCode, config.studentTemplateSource);
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
