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

type Judge0CreateSubmissionResponse = {
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

export async function resolveJudge0Language(languageKey: string) {
  const { languageKey: normalizedLanguageKey, candidates } = getJudge0LanguageCandidates(languageKey);
  const languages = await listJudge0Languages();
  const language = languages.find((entry) => candidates.includes(entry.name));
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
  const response = await fetch(`${env.JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [env.JUDGE0_AUTH_HEADER]: env.JUDGE0_AUTH_TOKEN
    },
    body: JSON.stringify({
      language_id: input.languageId,
      source_code: input.sourceCode,
      stdin: input.stdin,
      expected_output: input.expectedOutput,
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

  return (await response.json()) as Judge0CreateSubmissionResponse;
}
