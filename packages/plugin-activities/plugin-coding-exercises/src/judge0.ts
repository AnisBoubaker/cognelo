import { getServerEnv } from "@cognelo/config";
import { AppError } from "@cognelo/core";
import { getJudge0LanguageCandidates } from "./coding-exercises";

export type Judge0SubmissionInput = {
  languageId: number;
  sourceCode: string;
  stdin?: string;
  expectedOutput?: string;
  cpuTimeLimit?: number;
  wallTimeLimit?: number;
  memoryLimitKb?: number;
  enablePerProcessAndThreadTimeLimit?: boolean;
  enablePerProcessAndThreadMemoryLimit?: boolean;
};

export type Judge0SubmissionResult = {
  token: string;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?: {
    id: number;
    description: string;
  };
};

export type Judge0Language = {
  id: number;
  name: string;
};

export type CodingExerciseProgrammingLanguage = {
  key: string;
  label: string;
};

const nonProgrammingJudge0Languages = new Set(["executable", "multi-file program", "plain text"]);
const judge0LanguageKeyAliases: Record<string, string> = {
  "c++": "cpp",
  "c#": "csharp",
  "common lisp": "common-lisp",
  "f#": "fsharp",
  "objective-c": "objectivec",
  "vb.net": "vbnet"
};
const judge0LanguageLabelAliases: Record<string, string> = {
  cpp: "C++",
  csharp: "C#",
  "common-lisp": "Common Lisp",
  fsharp: "F#",
  objectivec: "Objective-C",
  vbnet: "VB.Net"
};

type Judge0EncodedSubmissionResponse = {
  token: string;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?: {
    id: number;
    description: string;
  };
};

export async function listJudge0Languages(): Promise<Judge0Language[]> {
  const env = getServerEnv();
  const response = await fetch(`${env.JUDGE0_BASE_URL}/languages`, {
    headers: {
      [env.JUDGE0_AUTH_HEADER]: env.JUDGE0_AUTH_TOKEN
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Judge0 languages request failed with ${response.status}: ${errorText}`);
  }

  return (await response.json()) as Judge0Language[];
}

export function getCodingExerciseProgrammingLanguages(languages: Judge0Language[]): CodingExerciseProgrammingLanguage[] {
  const available = new Map<string, CodingExerciseProgrammingLanguage>();
  for (const language of languages) {
    const option = codingExerciseProgrammingLanguageFromJudge0(language.name);
    if (option) available.set(option.key, option);
  }
  return [...available.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export async function listCodingExerciseProgrammingLanguages() {
  return getCodingExerciseProgrammingLanguages(await listJudge0Languages());
}

function codingExerciseProgrammingLanguageFromJudge0(name: string): CodingExerciseProgrammingLanguage | null {
  const baseName = name.replace(/\s+\([^()]*(?:\([^()]*\)[^()]*)*\)\s*$/, "").trim();
  const normalizedBaseName = baseName.toLowerCase();
  if (!baseName || nonProgrammingJudge0Languages.has(normalizedBaseName)) return null;

  if (normalizedBaseName === "python") {
    const pythonMajorVersion = name.match(/\(\s*(\d+)/)?.[1];
    return pythonMajorVersion === "2"
      ? { key: "python2", label: "Python 2" }
      : { key: "python", label: "Python 3" };
  }

  const key = judge0LanguageKeyAliases[normalizedBaseName]
    ?? normalizedBaseName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!key) return null;
  return { key, label: judge0LanguageLabelAliases[key] ?? baseName };
}

export async function resolveJudge0Language(languageKey: string) {
  const { languageKey: normalizedLanguageKey, candidates } = getJudge0LanguageCandidates(languageKey);
  if (!normalizedLanguageKey) {
    throw new AppError(409, "CODING_EXERCISE_LANGUAGE_REQUIRED", "Choose a programming language before running or validating code.");
  }
  const languages = await listJudge0Languages();
  const language = languages.find((entry) => candidates.includes(entry.name))
    ?? [...languages]
      .filter((entry) => codingExerciseProgrammingLanguageFromJudge0(entry.name)?.key === normalizedLanguageKey)
      .sort((left, right) => right.id - left.id)[0];
  if (!language) {
    throw new AppError(
      503,
      "JUDGE0_LANGUAGE_NOT_AVAILABLE",
      `Judge0 does not currently expose a runtime matching the configured language \`${normalizedLanguageKey}\`.`
    );
  }

  return {
    languageKey: normalizedLanguageKey,
    languageId: language.id,
    languageName: language.name
  };
}

export async function runJudge0Submission(input: Judge0SubmissionInput): Promise<Judge0SubmissionResult> {
  const env = getServerEnv();
  const response = await fetch(`${env.JUDGE0_BASE_URL}/submissions?base64_encoded=true&wait=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [env.JUDGE0_AUTH_HEADER]: env.JUDGE0_AUTH_TOKEN
    },
    body: JSON.stringify({
      language_id: input.languageId,
      source_code: encodeJudge0Text(input.sourceCode),
      stdin: encodeJudge0Text(input.stdin),
      expected_output: encodeJudge0Text(input.expectedOutput),
      cpu_time_limit: input.cpuTimeLimit,
      wall_time_limit: input.wallTimeLimit,
      memory_limit: input.memoryLimitKb,
      enable_per_process_and_thread_time_limit: input.enablePerProcessAndThreadTimeLimit,
      enable_per_process_and_thread_memory_limit: input.enablePerProcessAndThreadMemoryLimit
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Judge0 request failed with ${response.status}: ${errorText}`);
  }

  const result = (await response.json()) as Judge0EncodedSubmissionResponse;
  const decodedResult = {
    ...result,
    stdout: decodeJudge0Text(result.stdout),
    stderr: decodeJudge0Text(result.stderr),
    compile_output: decodeJudge0Text(result.compile_output),
    message: decodeJudge0Text(result.message)
  };

  if (decodedResult.status?.id === 13) {
    console.error("Judge0 returned an internal sandbox error.", {
      token: decodedResult.token,
      status: decodedResult.status.description,
      message: decodedResult.message
    });
    throw new AppError(
      503,
      "JUDGE0_INTERNAL_ERROR",
      "The code execution service encountered an internal sandbox error. Please try again."
    );
  }

  return decodedResult;
}

function encodeJudge0Text(value: string | undefined): string | undefined {
  return value === undefined ? undefined : Buffer.from(value, "utf8").toString("base64");
}

function decodeJudge0Text(value: string | null | undefined): string | null | undefined {
  return typeof value === "string" ? Buffer.from(value, "base64").toString("utf8") : value;
}
