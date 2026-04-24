import { z } from "zod";

export const codingExerciseTemplateInsertionToken = "{{ STUDENT_CODE }}";

export const codingExerciseExecutionModeSchema = z.literal("template");

export const sampleTestSchema = z.object({
  id: z.string().min(1).max(80),
  input: z.string().max(8000).default(""),
  output: z.string().max(8000).default(""),
  testCode: z.string().max(40000).default(""),
  title: z.string().max(200).default("")
});

export const codingExerciseConfigSchema = z.object({
  prompt: z.string().min(10).max(12000),
  language: z.string().min(1).max(40).default("python"),
  executionMode: codingExerciseExecutionModeSchema.default("template"),
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
  const raw =
    value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  const normalizedSampleTests = Array.isArray(raw.sampleTests)
    ? raw.sampleTests.map((test) => {
        if (!test || typeof test !== "object" || Array.isArray(test)) {
          return test;
        }
        const record = { ...(test as Record<string, unknown>) };
        if (typeof record.title !== "string" && typeof record.explanation === "string") {
          record.title = record.explanation;
        }
        return record;
      })
    : raw.sampleTests;

  if (raw.executionMode === "function" || raw.executionMode === "program") {
    raw.executionMode = "template";
  }

  if (typeof raw.executionMode !== "string") {
    raw.executionMode = "template";
  }

  raw.sampleTests = normalizedSampleTests;
  return codingExerciseConfigSchema.parse(raw);
}

export function normalizeCodingExerciseSampleTests(value: unknown) {
  const raw = Array.isArray(value) ? value : [];
  return z
    .array(
      sampleTestSchema.or(
        z.object({
          id: z.string().min(1).max(80),
          input: z.string().max(8000).default(""),
          output: z.string().max(8000).default(""),
          testCode: z.string().max(40000).default(""),
          explanation: z.string().max(1000).default("")
        }).transform((test) => ({
          id: test.id,
          input: test.input,
          output: test.output,
          testCode: test.testCode,
          title: test.explanation
        }))
      )
    )
    .max(10)
    .parse(raw);
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
  const templateSource = params.privateConfig.templateSource || buildCodingExerciseTemplateSource(params.privateConfig.templatePrefix, params.privateConfig.templateSuffix);
  const testCode = (params.testCode ?? "").trim();

  if (hiddenSupportCode) {
    sections.push(params.privateConfig.hiddenSupportCode);
  }

  if (templateSource.includes(codingExerciseTemplateInsertionToken)) {
    sections.push(templateSource.replace(codingExerciseTemplateInsertionToken, params.studentSourceCode));
  } else if (templateSource.trim().length > 0) {
    sections.push(templateSource);
    sections.push(params.studentSourceCode);
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
    prefix: templateSource.slice(0, markerIndex),
    suffix: templateSource.slice(markerIndex + codingExerciseTemplateInsertionToken.length)
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
  const markerIndentation = getLeadingWhitespace(lines[markerLineIndex] ?? "");

  return [...projectedPrefix, `${markerIndentation}${codingExerciseTemplateInsertionToken}`, ...projectedSuffix].join("\n");
}

export function alignCodingExerciseStarterCodeToTemplate(starterCode: string, templateSource: string) {
  if (!starterCode.trim()) {
    return starterCode;
  }

  const insertionIndentation = getCodingExerciseTemplateInsertionIndentation(templateSource);
  const normalizedStarterLines = dedentCodingExerciseLines(starterCode.split("\n"));

  return normalizedStarterLines
    .map((line) => (line.trim().length ? `${insertionIndentation}${line}` : ""))
    .join("\n");
}

export function buildCodingExerciseStudentTemplateProjectionFromSource(templateSource: string) {
  const templateParts = splitCodingExerciseTemplateSource(templateSource);
  return {
    readOnlyPrefix: templateParts.prefix,
    readOnlySuffix: templateParts.suffix
  };
}

function projectCodingExerciseTemplateSection(
  lines: string[],
  lineOffset: number,
  visibleLineNumbers: Set<number>,
  language: string
) {
  const projectedLines: string[] = [];
  let hiddenLines: string[] = [];

  for (const [index, line] of lines.entries()) {
    const lineNumber = lineOffset + index;
    const isVisible = visibleLineNumbers.has(lineNumber);

    if (isVisible) {
      if (hiddenLines.length) {
        projectedLines.push(...projectCodingExerciseHiddenLines(hiddenLines, projectedLines, language));
        hiddenLines = [];
      }
      projectedLines.push(line);
      continue;
    }

    hiddenLines.push(line);
  }

  if (hiddenLines.length) {
    projectedLines.push(...projectCodingExerciseHiddenLines(hiddenLines, projectedLines, language));
  }

  return projectedLines;
}

export function getCodingExerciseHiddenCodePlaceholder(language: string, indentation = "") {
  const normalizedLanguage = language.trim().toLowerCase();

  if (normalizedLanguage === "python") {
    return `${indentation}# Hidden code`;
  }

  return `${indentation}// Hidden code`;
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

function projectCodingExerciseHiddenLines(hiddenLines: string[], projectedLines: string[], language: string) {
  const hasSubstantiveLine = hiddenLines.some((line) => line.trim().length > 0);
  if (!hasSubstantiveLine) {
    return hiddenLines.map(() => "");
  }

  return [getCodingExerciseHiddenCodePlaceholder(language, getCodingExerciseHiddenPlaceholderIndentation(hiddenLines, projectedLines))];
}

function getCodingExerciseHiddenPlaceholderIndentation(hiddenLines: string[], projectedLines: string[]) {
  const firstSubstantiveHiddenLine = hiddenLines.find((line) => line.trim().length > 0);
  if (firstSubstantiveHiddenLine) {
    return getLeadingWhitespace(firstSubstantiveHiddenLine);
  }

  for (let index = projectedLines.length - 1; index >= 0; index -= 1) {
    const previousLine = projectedLines[index];
    if (previousLine.trim().length > 0) {
      return getLeadingWhitespace(previousLine);
    }
  }

  return "";
}

function getCodingExerciseTemplateInsertionIndentation(templateSource: string) {
  const lines = templateSource.split("\n");
  const markerLineIndex = lines.findIndex((line) => line.includes(codingExerciseTemplateInsertionToken));
  if (markerLineIndex === -1) {
    return "";
  }

  const markerIndentation = getLeadingWhitespace(lines[markerLineIndex] ?? "");
  if (markerIndentation.length > 0) {
    return markerIndentation;
  }

  for (let index = markerLineIndex + 1; index < lines.length; index += 1) {
    const nextLine = lines[index] ?? "";
    if (nextLine.trim().length > 0) {
      return getLeadingWhitespace(nextLine);
    }
  }

  return "";
}

function dedentCodingExerciseLines(lines: string[]) {
  const indentedLines = lines.filter((line) => line.trim().length > 0);
  if (!indentedLines.length) {
    return lines;
  }

  const sharedIndentation = Math.min(...indentedLines.map((line) => getLeadingWhitespace(line).length));
  if (!sharedIndentation) {
    return lines;
  }

  return lines.map((line) => (line.trim().length ? line.slice(sharedIndentation) : ""));
}

function getLeadingWhitespace(line: string) {
  const match = line.match(/^\s*/);
  return match?.[0] ?? "";
}
