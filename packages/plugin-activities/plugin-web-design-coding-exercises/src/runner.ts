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

const runnerScreenshotSchema = z.object({
  imageDataUrl: z.string().min(1),
  durationMs: z.number().int(),
  viewport: z.object({
    width: z.number().int(),
    height: z.number().int()
  })
});

export type WebDesignRunnerScreenshot = z.infer<typeof runnerScreenshotSchema>;

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

export async function captureWebDesignScreenshotInRunner(params: {
  files: WebDesignExerciseFile[];
  timeoutMs?: number;
  trimWhitespace?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
}) {
  const env = getServerEnv();

  try {
    const response = await fetch(`${env.WEB_DESIGN_RUNNER_URL}/screenshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: params.files,
        timeoutMs: params.timeoutMs ?? 8000,
        trimWhitespace: params.trimWhitespace ?? false,
        viewport: params.viewport ?? { width: 1024, height: 768 }
      })
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body?.error?.message ?? "Runner screenshot request failed.");
    }

    return runnerScreenshotSchema.parse(body);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      502,
      "WEB_DESIGN_SCREENSHOT_FAILED",
      error instanceof Error ? error.message : "The web design runner could not capture the expected result."
    );
  }
}
