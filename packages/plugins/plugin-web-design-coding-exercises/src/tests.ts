import { Prisma, prisma } from "@cognelo/db";
import { assertCanManageCourse, AppError } from "@cognelo/core";
import {
  normalizeWebDesignExerciseConfig,
  parseWebDesignExerciseConfig,
  webDesignExerciseTestsInputSchema,
  webDesignPromptIncludesExpectedResult,
  webDesignPromptRequestsCroppedExpectedResult,
  type WebDesignExerciseFile,
  type WebDesignExerciseTestKind
} from "./web-design-coding-exercises";
import { captureWebDesignScreenshotInRunner, runWebDesignTestsInRunner, type WebDesignRunnerResult } from "./runner";

type WebDesignExerciseTestRecord = {
  id: string;
  name: string;
  kind: WebDesignExerciseTestKind;
  testCode: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
  metadata: Record<string, unknown>;
  validationSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type WebDesignExerciseReferenceBundleRecord = {
  files: WebDesignExerciseFile[];
  validationSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeReferenceFiles(value: unknown): WebDesignExerciseFile[] {
  const candidate = Array.isArray(value) ? value : [];
  return normalizeWebDesignExerciseConfig({
    prompt: "",
    files: candidate as WebDesignExerciseFile[],
    previewEntry: "index.html",
    maxEditorSeconds: 1800
  }).files;
}

export async function listWebDesignExerciseTests(params: { activityId: string }) {
  const [referenceBundle, tests] = await Promise.all([
    prisma.pluginWebDesignExerciseReferenceBundle.findUnique({
      where: { activityId: params.activityId }
    }),
    prisma.pluginWebDesignExerciseTest.findMany({
      where: { activityId: params.activityId },
      orderBy: [{ kind: "asc" }, { orderIndex: "asc" }, { createdAt: "asc" }]
    })
  ]);

  return {
    referenceBundle: referenceBundle ? toReferenceBundleRecord(referenceBundle) : null,
    tests: tests.map((test) => toTestRecord(test))
  };
}

export async function replaceWebDesignExerciseTests(params: {
  activityId: string;
  activityConfig: Record<string, unknown> | undefined;
  courseId: string;
  user: { id: string; email: string; name: string | null; roles: ("admin" | "teacher" | "student")[] };
  input: unknown;
}) {
  await assertCanManageCourse(params.user, params.courseId);
  const input = webDesignExerciseTestsInputSchema.parse(params.input);
  const seenIds = new Set<string>();
  for (const test of input.tests) {
    if (seenIds.has(test.id)) {
      throw new AppError(400, "WEB_DESIGN_TEST_DUPLICATE_ID", "Web design test ids must be unique.");
    }
    seenIds.add(test.id);
  }

  const referenceFiles = normalizeWebDesignExerciseConfig({
    prompt: "",
    files: input.referenceFiles,
    previewEntry: input.referenceFiles.find((file) => file.language === "html")?.path ?? input.referenceFiles[0]?.path ?? "index.html",
    maxEditorSeconds: 1800
  }).files;
  const validation = await validateReferenceBundle({
    files: referenceFiles,
    tests: input.tests
  });
  const activityConfig = parseWebDesignExerciseConfig(params.activityConfig);
  const shouldCaptureExpectedResult = input.shouldCaptureExpectedResult ?? webDesignPromptIncludesExpectedResult(activityConfig.prompt);
  const shouldCropExpectedResult = input.shouldCropExpectedResult ?? webDesignPromptRequestsCroppedExpectedResult(activityConfig.prompt);
  const expectedResult = shouldCaptureExpectedResult
    ? await captureWebDesignScreenshotInRunner({ files: referenceFiles, trimWhitespace: shouldCropExpectedResult })
    : null;
  const referenceSummary = {
    ...validation.referenceSummary,
    expectedResult: expectedResult
      ? {
          imageDataUrl: expectedResult.imageDataUrl,
          generatedAt: new Date().toISOString(),
          durationMs: expectedResult.durationMs,
          viewport: expectedResult.viewport
        }
      : null
  };

  await prisma.$transaction(async (transaction) => {
    await transaction.pluginWebDesignExerciseTest.deleteMany({
      where: { activityId: params.activityId }
    });

    if (input.tests.length) {
      await transaction.pluginWebDesignExerciseTest.createMany({
        data: input.tests.map((test, index) => ({
          id: test.id,
          activityId: params.activityId,
          name: test.name,
          kind: test.kind,
          testCode: test.testCode,
          orderIndex: index,
          isEnabled: test.isEnabled,
          weight: test.weight,
          metadata: test.metadata as Prisma.InputJsonValue,
          validationSummary: (validation.testSummaries.get(test.id) ?? buildSkippedValidationSummary(test.isEnabled)) as Prisma.InputJsonValue
        }))
      });
    }

    await transaction.pluginWebDesignExerciseReferenceBundle.upsert({
      where: { activityId: params.activityId },
      create: {
        activityId: params.activityId,
        files: referenceFiles as unknown as Prisma.InputJsonValue,
        validationSummary: referenceSummary as Prisma.InputJsonValue
      },
      update: {
        files: referenceFiles as unknown as Prisma.InputJsonValue,
        validationSummary: referenceSummary as Prisma.InputJsonValue
      }
    });
  });

  return listWebDesignExerciseTests({ activityId: params.activityId });
}

export async function getWebDesignExpectedResult(params: { activityId: string; activityConfig: Record<string, unknown> | undefined }) {
  const activityConfig = parseWebDesignExerciseConfig(params.activityConfig);
  if (!webDesignPromptIncludesExpectedResult(activityConfig.prompt)) {
    return { imageDataUrl: null };
  }

  const referenceBundle = await prisma.pluginWebDesignExerciseReferenceBundle.findUnique({
    where: { activityId: params.activityId }
  });
  const validationSummary = normalizeJsonObject(referenceBundle?.validationSummary);
  const expectedResult = normalizeJsonObject(validationSummary.expectedResult);
  const imageDataUrl = typeof expectedResult.imageDataUrl === "string" ? expectedResult.imageDataUrl : null;

  return { imageDataUrl };
}

async function validateReferenceBundle(params: {
  files: WebDesignExerciseFile[];
  tests: Array<{
    id: string;
    name: string;
    kind: WebDesignExerciseTestKind;
    testCode: string;
    isEnabled: boolean;
    weight: number;
  }>;
}) {
  const enabledTests = params.tests.filter((test) => test.isEnabled);
  const disabledTestIds = new Set(params.tests.filter((test) => !test.isEnabled).map((test) => test.id));
  const testSummaries = new Map<string, Record<string, unknown>>();

  for (const testId of disabledTestIds) {
    testSummaries.set(testId, buildSkippedValidationSummary(false));
  }

  if (!enabledTests.length) {
    return {
      referenceSummary: {
        phase: "reference-validation",
        status: "skipped",
        enabledTestCount: 0,
        message: "No enabled tests to validate."
      },
      testSummaries
    };
  }

  const result = await runWebDesignTestsInRunner({
    files: params.files,
    tests: enabledTests.map((test) => ({
      id: test.id,
      name: test.name,
      testCode: test.testCode,
      weight: test.weight
    }))
  });

  for (const testResult of result.tests) {
    testSummaries.set(testResult.id, buildTestValidationSummary(testResult));
  }

  if (result.status !== "completed") {
    const failedTests = result.tests.filter((test) => test.status === "failed");
    const firstFailure = failedTests[0];
    const referenceSummary = {
      phase: "reference-validation",
      status: "failed",
      enabledTestCount: enabledTests.length,
      failedCount: failedTests.length,
      score: result.score,
      maxScore: result.maxScore,
      durationMs: result.durationMs
    };
    throw new AppError(
      400,
      "WEB_DESIGN_REFERENCE_VALIDATION_FAILED",
      firstFailure
        ? `Reference validation failed for "${firstFailure.name}": ${firstFailure.message ?? "The test failed."}`
        : "Reference validation failed.",
      {
        failedCount: failedTests.length,
        validationSummary: {
          referenceSummary,
          testSummaries: Object.fromEntries(testSummaries)
        }
      }
    );
  }

  return {
    referenceSummary: {
      phase: "reference-validation",
      status: "completed",
      enabledTestCount: enabledTests.length,
      score: result.score,
      maxScore: result.maxScore,
      durationMs: result.durationMs
    },
    testSummaries
  };
}

function buildTestValidationSummary(testResult: WebDesignRunnerResult["tests"][number]) {
  return {
    phase: "reference-validation",
    status: testResult.status,
    score: testResult.score,
    maxScore: testResult.weight,
    durationMs: testResult.durationMs ?? null,
    message: testResult.message ?? null,
    details: testResult.details
  };
}

function buildSkippedValidationSummary(isEnabled: boolean) {
  return {
    phase: "reference-validation",
    status: isEnabled ? "not-run" : "skipped",
    message: isEnabled ? "The test was not validated." : "Disabled tests are not run against the reference bundle."
  };
}

function toReferenceBundleRecord(bundle: {
  files: unknown;
  validationSummary: unknown;
  createdAt: Date;
  updatedAt: Date;
}): WebDesignExerciseReferenceBundleRecord {
  return {
    files: normalizeReferenceFiles(bundle.files),
    validationSummary: normalizeJsonObject(bundle.validationSummary),
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt.toISOString()
  };
}

function toTestRecord(test: {
  id: string;
  name: string;
  kind: WebDesignExerciseTestKind;
  testCode: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
  metadata: unknown;
  validationSummary: unknown;
  createdAt: Date;
  updatedAt: Date;
}): WebDesignExerciseTestRecord {
  return {
    id: test.id,
    name: test.name,
    kind: test.kind,
    testCode: test.testCode,
    isEnabled: test.isEnabled,
    weight: test.weight,
    orderIndex: test.orderIndex,
    metadata: normalizeJsonObject(test.metadata),
    validationSummary: normalizeJsonObject(test.validationSummary),
    createdAt: test.createdAt.toISOString(),
    updatedAt: test.updatedAt.toISOString()
  };
}
