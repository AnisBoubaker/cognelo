import { Prisma, prisma } from "@cognelo/db";
import { AppError } from "@cognelo/core";
import { z } from "zod";
import { runWebDesignTestsInRunner } from "./runner";
import { webDesignExerciseFileSchema, type WebDesignExerciseFile } from "./web-design-coding-exercises";

export const webDesignExerciseRunInputSchema = z.object({
  files: z.array(webDesignExerciseFileSchema).min(1).max(12)
});

type WebDesignExerciseSubmissionRecord = {
  id: string;
  activityId: string;
  userId: string;
  kind: "run" | "submit";
  status: "pending" | "completed" | "failed";
  files: WebDesignExerciseFile[];
  resultSummary: Record<string, unknown>;
  score: number | null;
  maxScore: number | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  testResults: Array<{
    id: string;
    testId: string | null;
    name: string;
    status: "pending" | "completed" | "failed";
    weight: number;
    score: number | null;
    message: string | null;
    durationMs: number | null;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
};

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeFiles(value: unknown): WebDesignExerciseFile[] {
  const parsed = z.array(webDesignExerciseFileSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export async function listRecentWebDesignExerciseSubmissions(params: {
  activityId: string;
  userId: string;
  kind?: "run" | "submit";
  limit?: number;
}) {
  const submissions = await prisma.pluginWebDesignExerciseSubmission.findMany({
    where: {
      activityId: params.activityId,
      userId: params.userId,
      kind: params.kind
    },
    include: {
      testResults: {
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: [{ createdAt: "desc" }],
    take: params.limit ?? 10
  });

  return submissions.map((submission) => toSubmissionRecord(submission));
}

export async function runWebDesignExercise(params: {
  activityId: string;
  userId: string;
  input: z.infer<typeof webDesignExerciseRunInputSchema>;
}) {
  return executeWebDesignExercise({
    activityId: params.activityId,
    userId: params.userId,
    kind: "run",
    testKind: "sample",
    input: params.input
  });
}

export async function submitWebDesignExercise(params: {
  activityId: string;
  userId: string;
  input: z.infer<typeof webDesignExerciseRunInputSchema>;
}) {
  return executeWebDesignExercise({
    activityId: params.activityId,
    userId: params.userId,
    kind: "submit",
    testKind: "hidden",
    input: params.input
  });
}

async function executeWebDesignExercise(params: {
  activityId: string;
  userId: string;
  kind: "run" | "submit";
  testKind: "sample" | "hidden";
  input: z.infer<typeof webDesignExerciseRunInputSchema>;
}) {
  const input = webDesignExerciseRunInputSchema.parse(params.input);
  const tests = await prisma.pluginWebDesignExerciseTest.findMany({
    where: {
      activityId: params.activityId,
      kind: params.testKind,
      isEnabled: true
    },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  });

  if (!tests.length) {
    throw new AppError(
      400,
      "WEB_DESIGN_NO_TESTS",
      params.testKind === "sample" ? "No enabled sample tests are available." : "No enabled hidden tests are available."
    );
  }

  const pendingSubmission = await prisma.pluginWebDesignExerciseSubmission.create({
    data: {
      activityId: params.activityId,
      userId: params.userId,
      kind: params.kind,
      status: "pending",
      files: input.files as unknown as Prisma.InputJsonValue,
      resultSummary: {
        phase: "pending",
        testKind: params.testKind
      } as Prisma.InputJsonValue
    },
    include: {
      testResults: true
    }
  });

  try {
    const result = await runWebDesignTestsInRunner({
      files: input.files,
      tests: tests.map((test) => ({
        id: test.id,
        name: test.name,
        testCode: test.testCode,
        weight: test.weight
      }))
    });

    await prisma.pluginWebDesignExerciseTestResult.createMany({
      data: result.tests.map((testResult) => ({
        submissionId: pendingSubmission.id,
        testId: tests.find((test) => test.id === testResult.id)?.id,
        name: testResult.name,
        status: testResult.status,
        weight: testResult.weight,
        score: testResult.score,
        message: testResult.message ?? undefined,
        durationMs: testResult.durationMs ?? undefined,
        details: testResult.details as Prisma.InputJsonValue
      }))
    });

    const completedSubmission = await prisma.pluginWebDesignExerciseSubmission.update({
      where: { id: pendingSubmission.id },
      data: {
        status: result.status,
        score: result.score,
        maxScore: result.maxScore,
        message: result.status === "completed" ? null : "One or more tests failed.",
        resultSummary: {
          phase: "finished",
          testKind: params.testKind,
          durationMs: result.durationMs
        } as Prisma.InputJsonValue
      },
      include: {
        testResults: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    return toSubmissionRecord(completedSubmission);
  } catch (error) {
    const failedSubmission = await prisma.pluginWebDesignExerciseSubmission.update({
      where: { id: pendingSubmission.id },
      data: {
        status: "failed",
        message: error instanceof Error ? error.message : "The web design runner failed.",
        resultSummary: {
          phase: "failed-before-result",
          testKind: params.testKind
        } as Prisma.InputJsonValue
      },
      include: {
        testResults: true
      }
    });

    if (error instanceof AppError) {
      throw error;
    }

    return toSubmissionRecord(failedSubmission);
  }
}

function toSubmissionRecord(submission: {
  id: string;
  activityId: string;
  userId: string;
  kind: "run" | "submit";
  status: "pending" | "completed" | "failed";
  files: unknown;
  resultSummary: unknown;
  score: number | null;
  maxScore: number | null;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
  testResults: Array<{
    id: string;
    testId: string | null;
    name: string;
    status: "pending" | "completed" | "failed";
    weight: number;
    score: number | null;
    message: string | null;
    durationMs: number | null;
    details: unknown;
    createdAt: Date;
  }>;
}): WebDesignExerciseSubmissionRecord {
  return {
    id: submission.id,
    activityId: submission.activityId,
    userId: submission.userId,
    kind: submission.kind,
    status: submission.status,
    files: normalizeFiles(submission.files),
    resultSummary: normalizeJsonObject(submission.resultSummary),
    score: submission.score,
    maxScore: submission.maxScore,
    message: submission.message,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    testResults: submission.testResults.map((result) => ({
      id: result.id,
      testId: result.testId,
      name: result.name,
      status: result.status,
      weight: result.weight,
      score: result.score,
      message: result.message,
      durationMs: result.durationMs,
      details: normalizeJsonObject(result.details),
      createdAt: result.createdAt.toISOString()
    }))
  };
}
