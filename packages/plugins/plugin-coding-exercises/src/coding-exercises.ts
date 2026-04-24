import { z } from "zod";

export const codingExerciseTemplateInsertionToken = "{{ STUDENT_CODE }}";

export const codingExerciseExecutionModeSchema = z.enum(["program", "function", "template"]);

export const sampleTestSchema = z.object({
  id: z.string().min(1).max(80),
  input: z.string().max(8000).default(""),
  output: z.string().max(8000).default(""),
  testCode: z.string().max(40000).default(""),
  explanation: z.string().max(1000).default("")
});

export const codingExerciseConfigSchema = z.object({
  prompt: z.string().min(10).max(12000),
  language: z.string().min(1).max(40).default("python"),
  executionMode: codingExerciseExecutionModeSchema.default("program"),
  starterCode: z.string().max(40000).default(""),
  studentTemplateSource: z.string().max(120000).default(""),
  sampleTests: z.array(sampleTestSchema).max(10).default([]),
  maxEditorSeconds: z.number().int().min(30).max(14400).default(1800)
});

export type CodingExerciseConfig = z.infer<typeof codingExerciseConfigSchema>;
export type CodingExerciseSampleTest = z.infer<typeof sampleTestSchema>;
export type CodingExerciseExecutionMode = z.infer<typeof codingExerciseExecutionModeSchema>;

export const codingExerciseHiddenTestSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  stdin: z.string().max(12000).default(""),
  expectedOutput: z.string().max(12000).default(""),
  testCode: z.string().max(40000).default(""),
  isEnabled: z.boolean().default(true),
  weight: z.number().int().min(1).max(100).default(1)
});

export const codingExercisePrivateConfigSchema = z.object({
  hiddenSupportCode: z.string().max(60000).default(""),
  templateSource: z.string().max(120000).default(""),
  templateVisibleLineNumbers: z.array(z.number().int().min(0).max(5000)).max(5000).default([]),
  templatePrefix: z.string().max(60000).default(""),
  templateSuffix: z.string().max(60000).default("")
});

export type CodingExercisePrivateConfig = z.infer<typeof codingExercisePrivateConfigSchema>;

export const codingExerciseHiddenTestsInputSchema = z.object({
  tests: z.array(codingExerciseHiddenTestSchema).max(50),
  sampleTests: z.array(sampleTestSchema).max(10).default([]),
  referenceSolution: z.string().max(60000).default(""),
  privateConfig: codingExercisePrivateConfigSchema.default({})
});

const judge0LanguageNameCandidates: Record<string, readonly string[]> = {
  c: ["C (GCC 13.2.0)", "C (GCC 12.2.0)", "C (GCC 9.2.0)", "C (GCC 8.3.0)", "C (GCC 7.4.0)", "C (Clang 18.1.8)", "C (Clang 7.0.1)"],
  cpp: [
    "C++ (GCC 13.2.0)",
    "C++ (GCC 12.2.0)",
    "C++ (GCC 9.2.0)",
    "C++ (GCC 8.3.0)",
    "C++ (GCC 7.4.0)",
    "C++ (Clang 18.1.8)",
    "C++ (Clang 7.0.1)"
  ],
  javascript: ["JavaScript (Node.js 22.08.0)", "JavaScript (Node.js 20.17.0)", "JavaScript (Node.js 12.14.0)"],
  typescript: ["TypeScript (5.6.2)", "TypeScript (5.4.5)", "TypeScript (3.7.4)"],
  python: ["Python (3.12.5)", "Python (3.11.2)", "Python (3.10.0)", "Python (3.8.1)"],
  java: ["Java (OpenJDK 17.0.6)", "Java (OpenJDK 13.0.1)"],
  go: ["Go (1.22.6)", "Go (1.18.5)", "Go (1.13.5)"],
  rust: ["Rust (1.81.0)", "Rust (1.40.0)"]
};

export function parseCodingExerciseConfig(value: unknown): CodingExerciseConfig {
  return codingExerciseConfigSchema.parse(value ?? {});
}

export function normalizeCodingExerciseSampleTests(value: unknown) {
  return z.array(sampleTestSchema).max(10).parse(value ?? []);
}

export function parseCodingExercisePrivateConfig(value: unknown) {
  const parsed = codingExercisePrivateConfigSchema.parse(value ?? {});

  if (parsed.templateSource.trim()) {
    const templateParts = splitCodingExerciseTemplateSource(parsed.templateSource);
    return {
      ...parsed,
      templatePrefix: templateParts.prefix,
      templateSuffix: templateParts.suffix
    };
  }

  return {
    ...parsed,
    templateSource: buildCodingExerciseTemplateSource(parsed.templatePrefix, parsed.templateSuffix)
  };
}

export function buildCodingExerciseSource(params: {
  config: Pick<CodingExerciseConfig, "executionMode" | "language">;
  privateConfig: CodingExercisePrivateConfig;
  studentSourceCode: string;
  testCode?: string;
}) {
  const sections: string[] = [];
  const hiddenSupportCode = params.privateConfig.hiddenSupportCode.trim();
  const templateParts = splitCodingExerciseTemplateSource(params.privateConfig.templateSource);
  const templatePrefix = templateParts.prefix.trim() || params.privateConfig.templatePrefix.trim();
  const templateSuffix = templateParts.suffix.trim() || params.privateConfig.templateSuffix.trim();
  const testCode = (params.testCode ?? "").trim();

  if (hiddenSupportCode) {
    sections.push(params.privateConfig.hiddenSupportCode);
  }

  if (params.config.executionMode === "template") {
    if (templatePrefix) {
      sections.push(templateParts.prefix);
    }
    sections.push(params.studentSourceCode);
    if (templateSuffix) {
      sections.push(templateParts.suffix);
    }
  } else {
    sections.push(params.studentSourceCode);
  }

  if (testCode) {
    sections.push(params.testCode ?? "");
  }

  const runtimeEpilogue = getCodingExerciseRuntimeEpilogue(params.config.language);
  if (runtimeEpilogue) {
    sections.push(runtimeEpilogue);
  }

  return sections.filter((section) => section.trim().length > 0).join("\n\n");
}

export function buildCodingExerciseTemplateSource(prefix: string, suffix: string) {
  return [prefix, codingExerciseTemplateInsertionToken, suffix].filter((section) => section.length > 0).join("\n\n");
}

export function splitCodingExerciseTemplateSource(templateSource: string) {
  const markerIndex = templateSource.indexOf(codingExerciseTemplateInsertionToken);
  if (markerIndex === -1) {
    return {
      prefix: templateSource,
      suffix: ""
    };
  }

  return {
    prefix: templateSource.slice(0, markerIndex).trimEnd(),
    suffix: templateSource.slice(markerIndex + codingExerciseTemplateInsertionToken.length).trimStart()
  };
}

export function buildCodingExerciseStudentTemplateProjection(params: {
  templateSource: string;
  visibleLineNumbers: number[];
  language: string;
}) {
  return buildCodingExerciseStudentTemplateProjectionFromSource(
    buildCodingExerciseStudentTemplateSource(params.templateSource, params.visibleLineNumbers, params.language)
  );
}

export function buildCodingExerciseStudentTemplateSource(
  templateSource: string,
  visibleLineNumbers: number[],
  language: string
) {
  const lines = templateSource.split("\n");
  const markerLineIndex = lines.findIndex((line) => line.includes(codingExerciseTemplateInsertionToken));
  const visibleLineNumberSet = new Set(visibleLineNumbers);

  if (markerLineIndex === -1) {
    return projectCodingExerciseTemplateSection(lines, 0, visibleLineNumberSet, language).join("\n");
  }

  const projectedPrefix = projectCodingExerciseTemplateSection(lines.slice(0, markerLineIndex), 0, visibleLineNumberSet, language);
  const projectedSuffix = projectCodingExerciseTemplateSection(
    lines.slice(markerLineIndex + 1),
    markerLineIndex + 1,
    visibleLineNumberSet,
    language
  );

  return [...projectedPrefix, codingExerciseTemplateInsertionToken, ...projectedSuffix].join("\n");
}

export function buildCodingExerciseStudentTemplateProjectionFromSource(templateSource: string) {
  const templateParts = splitCodingExerciseTemplateSource(templateSource);
  return {
    readOnlyPrefix: templateParts.prefix ? `${templateParts.prefix}\n` : "",
    readOnlySuffix: templateParts.suffix ? `\n${templateParts.suffix}` : ""
  };
}

function projectCodingExerciseTemplateSection(
  lines: string[],
  lineOffset: number,
  visibleLineNumbers: Set<number>,
  language: string
) {
  const projectedLines: string[] = [];
  let hasHiddenBlock = false;

  for (const [index, line] of lines.entries()) {
    const lineNumber = lineOffset + index;
    const isVisible = visibleLineNumbers.has(lineNumber);

    if (isVisible) {
      if (hasHiddenBlock) {
        projectedLines.push(getCodingExerciseHiddenCodePlaceholder(language));
        hasHiddenBlock = false;
      }
      projectedLines.push(line);
      continue;
    }

    hasHiddenBlock = true;
  }

  if (hasHiddenBlock) {
    projectedLines.push(getCodingExerciseHiddenCodePlaceholder(language));
  }

  return projectedLines;
}

export function getCodingExerciseHiddenCodePlaceholder(language: string) {
  const normalizedLanguage = language.trim().toLowerCase();

  if (normalizedLanguage === "python") {
    return "# Hidden code";
  }

  return "// Hidden code";
}

function getCodingExerciseRuntimeEpilogue(language: string) {
  const normalizedLanguage = language.trim().toLowerCase();

  if (normalizedLanguage === "javascript" || normalizedLanguage === "typescript") {
    // Judge0's Node.js runtime can keep the process alive after synchronous work completes.
    // Exiting explicitly keeps sample runs and validation from hitting the wall-clock timeout.
    return "process.exit(0);";
  }

  return "";
}

export function getJudge0LanguageCandidates(languageKey: string) {
  const normalizedKey = languageKey.trim().toLowerCase();
  const candidates = judge0LanguageNameCandidates[normalizedKey];
  if (!candidates?.length) {
    throw new Error(`Unsupported coding exercise language: ${languageKey}`);
  }

  return { languageKey: normalizedKey, candidates };
}
