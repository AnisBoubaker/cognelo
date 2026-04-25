import { getServerEnv } from "@cognelo/config";
import { AppError } from "@cognelo/core";
import { z } from "zod";
import type { WebDesignExerciseFile } from "./web-design-coding-exercises";

const runnerTestResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["completed", "failed"]),
  weight: z.number(),
  score: z.number(),
  durationMs: z.number().int().nullable().optional(),
  message: z.string().nullable().optional(),
  details: z.record(z.unknown()).default({})
});

const runnerResultSchema = z.object({
  status: z.enum(["completed", "failed"]),
  score: z.number(),
  maxScore: z.number(),
  durationMs: z.number().int(),
  tests: z.array(runnerTestResultSchema)
});

export type WebDesignRunnerResult = z.infer<typeof runnerResultSchema>;

export async function runWebDesignTestsInRunner(params: {
  files: WebDesignExerciseFile[];
  tests: Array<{
    id: string;
    name: string;
    testCode: string;
    weight: number;
  }>;
  timeoutMs?: number;
}) {
  const env = getServerEnv();

  try {
    const response = await fetch(`${env.WEB_DESIGN_RUNNER_URL}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: params.files,
        tests: params.tests,
        timeoutMs: params.timeoutMs ?? 8000
      })
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body?.error?.message ?? "Runner request failed.");
    }

    return runnerResultSchema.parse(body);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      502,
      "WEB_DESIGN_RUNNER_FAILED",
      error instanceof Error ? error.message : "The web design runner could not complete the tests."
    );
  }
}
