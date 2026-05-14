import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageActivityBank, assertCanManageCourse, AppError } from "@cognelo/core";
import { codingExerciseHiddenTestsInputSchema, codingExerciseTemplateRequiresTestCodeMarker, parseCodingExercisePrivateConfig } from "./coding-exercises";
import { Prisma, prisma } from "./db-client";
import { getCodingExerciseReferenceSolution, validateReferenceSolutionAgainstHiddenTests } from "./executions";

const codingExerciseHiddenTestsClient = prisma as typeof prisma & {
  pluginCodingExerciseReferenceSolution: {
    upsert(args: Prisma.PluginCodingExerciseReferenceSolutionUpsertArgs): Promise<unknown>;
  };
  pluginBankCodingExerciseReferenceSolution: {
    findUnique(
      args: Prisma.PluginBankCodingExerciseReferenceSolutionFindUniqueArgs
    ): Promise<{
      sourceCode: string;
      privateConfig: unknown;
      validationSummary: unknown;
      createdAt: Date;
      updatedAt: Date;
    } | null>;
    upsert(args: Prisma.PluginBankCodingExerciseReferenceSolutionUpsertArgs): Promise<unknown>;
  };
  pluginBankCodingExerciseHiddenTest: {
    findMany(args: Prisma.PluginBankCodingExerciseHiddenTestFindManyArgs): Promise<
      Array<{
        id: string;
        name: string;
        stdin: string;
        expectedOutput: string;
        isEnabled: boolean;
        weight: number;
        orderIndex: number;
        metadata: unknown;
        createdAt: Date;
        updatedAt: Date;
      }>
    >;
  };
};

type HiddenTestRecord = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  testCode: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function normalizeMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function listCodingExerciseHiddenTests(params: { activityId: string }) {
  const tests = await prisma.pluginCodingExerciseHiddenTest.findMany({
    where: { activityId: params.activityId },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  });
  const referenceSolution = await getCodingExerciseReferenceSolution({
    activityId: params.activityId
  });

  return {
    tests: tests.map((test) => toHiddenTestRecord(test)),
    referenceSolution
  };
}

export async function listBankCodingExerciseHiddenTests(params: { bankActivityId: string }) {
  assertBankCodingExerciseStorageAvailable();
  const [tests, referenceSolution] = await Promise.all([
    codingExerciseHiddenTestsClient.pluginBankCodingExerciseHiddenTest.findMany({
      where: { bankActivityId: params.bankActivityId },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
    }),
    codingExerciseHiddenTestsClient.pluginBankCodingExerciseReferenceSolution.findUnique({
      where: { bankActivityId: params.bankActivityId }
    })
  ]);

  return {
    tests: tests.map((test) => toHiddenTestRecord(test)),
    referenceSolution: referenceSolution ? toReferenceSolutionRecord(referenceSolution) : null
  };
}

export async function replaceCodingExerciseHiddenTests(params: {
  activityId: string;
  courseId: string;
  activityConfig: unknown;
  user: CurrentUser;
  input: unknown;
}) {
  await assertCanManageCourse(params.user, params.courseId);
  const input = await validateCodingExerciseHiddenTestsInput({
    activityConfig: params.activityConfig,
    input: params.input
  });

  if (input.validateOnly) {
    return toValidatedHiddenTestsResponse(input);
  }

  await codingExerciseHiddenTestsClient.$transaction(async (transaction) => {
    await transaction.pluginCodingExerciseHiddenTest.deleteMany({
      where: { activityId: params.activityId }
    });

    if (input.tests.length) {
      await transaction.pluginCodingExerciseHiddenTest.createMany({
        data: input.tests.map((test, index) => ({
          activityId: params.activityId,
          name: test.name,
          stdin: test.stdin,
          expectedOutput: test.expectedOutput,
          orderIndex: index,
          isEnabled: test.isEnabled,
          weight: test.weight,
          metadata: {
            stableId: test.id,
            testCode: test.testCode
          } as Prisma.InputJsonValue
        }))
      });
    }

    await (transaction as typeof codingExerciseHiddenTestsClient).pluginCodingExerciseReferenceSolution.upsert({
      where: { activityId: params.activityId },
      create: {
        activityId: params.activityId,
        sourceCode: input.referenceSolution,
        privateConfig: input.privateConfig as Prisma.InputJsonValue,
        validationSummary: input.validationSummary as Prisma.InputJsonValue
      },
      update: {
        sourceCode: input.referenceSolution,
        privateConfig: input.privateConfig as Prisma.InputJsonValue,
        validationSummary: input.validationSummary as Prisma.InputJsonValue
      }
    });
  });

  return listCodingExerciseHiddenTests({ activityId: params.activityId });
}

export async function replaceBankCodingExerciseHiddenTests(params: {
  activityBankId: string;
  bankActivityId: string;
  activityConfig: unknown;
  user: CurrentUser;
  input: unknown;
}) {
  assertBankCodingExerciseStorageAvailable();
  await assertCanManageActivityBank(params.user, params.activityBankId);
  const input = await validateCodingExerciseHiddenTestsInput({
    activityConfig: params.activityConfig,
    input: params.input
  });

  if (input.validateOnly) {
    return toValidatedHiddenTestsResponse(input);
  }

  await codingExerciseHiddenTestsClient.$transaction(async (transaction) => {
    await transaction.pluginBankCodingExerciseHiddenTest.deleteMany({
      where: { bankActivityId: params.bankActivityId }
    });

    if (input.tests.length) {
      await transaction.pluginBankCodingExerciseHiddenTest.createMany({
        data: input.tests.map((test, index) => ({
          bankActivityId: params.bankActivityId,
          name: test.name,
          stdin: test.stdin,
          expectedOutput: test.expectedOutput,
          orderIndex: index,
          isEnabled: test.isEnabled,
          weight: test.weight,
          metadata: {
            stableId: test.id,
            testCode: test.testCode
          } as Prisma.InputJsonValue
        }))
      });
    }

    await (transaction as typeof codingExerciseHiddenTestsClient).pluginBankCodingExerciseReferenceSolution.upsert({
      where: { bankActivityId: params.bankActivityId },
      create: {
        bankActivityId: params.bankActivityId,
        sourceCode: input.referenceSolution,
        privateConfig: input.privateConfig as Prisma.InputJsonValue,
        validationSummary: input.validationSummary as Prisma.InputJsonValue
      },
      update: {
        sourceCode: input.referenceSolution,
        privateConfig: input.privateConfig as Prisma.InputJsonValue,
        validationSummary: input.validationSummary as Prisma.InputJsonValue
      }
    });
  });

  return listBankCodingExerciseHiddenTests({ bankActivityId: params.bankActivityId });
}

export async function copyBankCodingExerciseDataToCourseActivity(params: { bankActivityId: string; activityId: string }) {
  assertBankCodingExerciseStorageAvailable();
  const [tests, referenceSolution] = await Promise.all([
    prisma.pluginBankCodingExerciseHiddenTest.findMany({
      where: { bankActivityId: params.bankActivityId },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
    }),
    prisma.pluginBankCodingExerciseReferenceSolution.findUnique({
      where: { bankActivityId: params.bankActivityId }
    })
  ]);

  await prisma.$transaction(async (transaction) => {
    await transaction.pluginCodingExerciseHiddenTest.deleteMany({
      where: { activityId: params.activityId }
    });

    await transaction.pluginCodingExerciseReferenceSolution.deleteMany({
      where: { activityId: params.activityId }
    });

    if (tests.length) {
      await transaction.pluginCodingExerciseHiddenTest.createMany({
        data: tests.map((test) => ({
          activityId: params.activityId,
          name: test.name,
          stdin: test.stdin,
          expectedOutput: test.expectedOutput,
          orderIndex: test.orderIndex,
          isEnabled: test.isEnabled,
          weight: test.weight,
          metadata: {
            ...normalizeMetadata(test.metadata),
            stableId: getHiddenTestStableId(test)
          } as Prisma.InputJsonValue
        }))
      });
    }

    if (referenceSolution) {
      await transaction.pluginCodingExerciseReferenceSolution.create({
        data: {
          activityId: params.activityId,
          sourceCode: referenceSolution.sourceCode,
          privateConfig: referenceSolution.privateConfig as Prisma.InputJsonValue,
          validationSummary: referenceSolution.validationSummary as Prisma.InputJsonValue
        }
      });
    }
  });
}

async function validateCodingExerciseHiddenTestsInput(params: { activityConfig: unknown; input: unknown }) {
  const input = codingExerciseHiddenTestsInputSchema.parse(params.input);
  const seenIds = new Set<string>();
  for (const test of input.tests) {
    if (seenIds.has(test.id)) {
      throw new AppError(400, "HIDDEN_TEST_DUPLICATE_ID", "Hidden test ids must be unique.");
    }
    seenIds.add(test.id);
  }

  const privateConfig = parseCodingExercisePrivateConfig(input.privateConfig);
  if (codingExerciseTemplateRequiresTestCodeMarker(privateConfig.templateSource, [...input.sampleTests, ...input.tests])) {
    throw new AppError(
      400,
      "TEST_CODE_MARKER_REQUIRED",
      "Add {{ TEST_CODE }} to the template before saving tests that include test code."
    );
  }

  const validationSummary = await validateReferenceSolutionAgainstHiddenTests({
    activityConfig: input.activityConfig ?? params.activityConfig,
    sourceCode: input.referenceSolution,
    sampleTests: input.sampleTests,
    hiddenTests: input.tests.map((test, index) => ({
      ...test,
      testCode: test.testCode,
      orderIndex: index
    })),
    privateConfig
  });

  if (!validationSummary.accepted) {
    const firstFailedTest = [...validationSummary.sampleTests.tests, ...validationSummary.hiddenTests.tests].find((test) => !test.passed);
    const failureReason =
      (firstFailedTest &&
        typeof firstFailedTest === "object" &&
        "message" in firstFailedTest &&
        typeof firstFailedTest.message === "string" &&
        firstFailedTest.message) ||
      (firstFailedTest &&
        typeof firstFailedTest === "object" &&
        "stderr" in firstFailedTest &&
        typeof firstFailedTest.stderr === "string" &&
        firstFailedTest.stderr) ||
      (firstFailedTest &&
        typeof firstFailedTest === "object" &&
        "compileOutput" in firstFailedTest &&
        typeof firstFailedTest.compileOutput === "string" &&
        firstFailedTest.compileOutput) ||
      (firstFailedTest &&
        typeof firstFailedTest === "object" &&
        "statusLabel" in firstFailedTest &&
        typeof firstFailedTest.statusLabel === "string" &&
        firstFailedTest.statusLabel) ||
      "The reference solution did not pass one of the saved tests.";
    const failedTestName =
      firstFailedTest &&
      typeof firstFailedTest === "object" &&
      "name" in firstFailedTest &&
      typeof firstFailedTest.name === "string"
        ? firstFailedTest.name
        : "unknown";

    throw new AppError(
      400,
      "REFERENCE_SOLUTION_VALIDATION_FAILED",
      `The reference solution failed test "${failedTestName}": ${failureReason}`,
      {
        failedTestId:
          firstFailedTest &&
          typeof firstFailedTest === "object" &&
          "id" in firstFailedTest &&
          typeof firstFailedTest.id === "string"
            ? firstFailedTest.id
            : null,
        validationSummary
      }
    );
  }

  return {
    ...input,
    privateConfig,
    validationSummary
  };
}

function toValidatedHiddenTestsResponse(input: Awaited<ReturnType<typeof validateCodingExerciseHiddenTestsInput>>) {
  const timestamp = new Date().toISOString();
  return {
    tests: input.tests.map((test, index) => ({
      ...test,
      orderIndex: index,
      metadata: { stableId: test.id },
      createdAt: timestamp,
      updatedAt: timestamp
    })),
    referenceSolution: {
      sourceCode: input.referenceSolution,
      privateConfig: input.privateConfig,
      validationSummary: input.validationSummary,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  };
}

function toHiddenTestRecord(test: {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): HiddenTestRecord {
  return {
    id: getHiddenTestStableId(test),
    name: test.name,
    stdin: test.stdin,
    expectedOutput: test.expectedOutput,
    testCode: getHiddenTestCode(test.metadata),
    isEnabled: test.isEnabled,
    weight: test.weight,
    orderIndex: test.orderIndex,
    metadata: normalizeMetadata(test.metadata),
    createdAt: test.createdAt.toISOString(),
    updatedAt: test.updatedAt.toISOString()
  };
}

function getHiddenTestCode(value: unknown) {
  const metadata = normalizeMetadata(value);
  return typeof metadata.testCode === "string" ? metadata.testCode : "";
}

function assertBankCodingExerciseStorageAvailable() {
  if (
    !codingExerciseHiddenTestsClient.pluginBankCodingExerciseHiddenTest ||
    !codingExerciseHiddenTestsClient.pluginBankCodingExerciseReferenceSolution
  ) {
    throw new AppError(
      500,
      "CODING_EXERCISE_BANK_STORAGE_UNAVAILABLE",
      "Coding exercise bank storage is unavailable. Run Prisma generate and restart the API server."
    );
  }
}

function getHiddenTestStableId(test: { id: string; metadata: unknown }) {
  const metadata = normalizeMetadata(test.metadata);
  return typeof metadata.stableId === "string" && metadata.stableId.trim() ? metadata.stableId : test.id;
}

function toReferenceSolutionRecord(referenceSolution: {
  sourceCode: string;
  privateConfig: unknown;
  validationSummary: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    sourceCode: referenceSolution.sourceCode,
    privateConfig: parseCodingExercisePrivateConfig(referenceSolution.privateConfig),
    validationSummary: normalizeMetadata(referenceSolution.validationSummary),
    createdAt: referenceSolution.createdAt.toISOString(),
    updatedAt: referenceSolution.updatedAt.toISOString()
  };
}
