import { z } from "zod";

export const sampleTestSchema = z.object({
  id: z.string().min(1).max(80),
  input: z.string().max(8000).default(""),
  output: z.string().max(8000).default(""),
  explanation: z.string().max(1000).default("")
});

export const codingExerciseConfigSchema = z.object({
  prompt: z.string().min(10).max(12000),
  language: z.string().min(1).max(40).default("python"),
  starterCode: z.string().max(40000).default(""),
  sampleTests: z.array(sampleTestSchema).max(10).default([]),
  maxEditorSeconds: z.number().int().min(30).max(14400).default(1800)
});

export type CodingExerciseConfig = z.infer<typeof codingExerciseConfigSchema>;
export type CodingExerciseSampleTest = z.infer<typeof sampleTestSchema>;

export const codingExerciseHiddenTestSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  stdin: z.string().max(12000).default(""),
  expectedOutput: z.string().max(12000).default(""),
  isEnabled: z.boolean().default(true),
  weight: z.number().int().min(1).max(100).default(1)
});

export const codingExerciseHiddenTestsInputSchema = z.object({
  tests: z.array(codingExerciseHiddenTestSchema).max(50),
  referenceSolution: z.string().max(60000).default("")
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

export function getJudge0LanguageCandidates(languageKey: string) {
  const normalizedKey = languageKey.trim().toLowerCase();
  const candidates = judge0LanguageNameCandidates[normalizedKey];
  if (!candidates?.length) {
    throw new Error(`Unsupported coding exercise language: ${languageKey}`);
  }

  return { languageKey: normalizedKey, candidates };
}
