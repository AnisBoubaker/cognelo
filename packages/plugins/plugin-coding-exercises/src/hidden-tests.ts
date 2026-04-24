import { Prisma, prisma } from "@cognelo/db";
import { assertCanManageCourse, AppError } from "@cognelo/core";
import { codingExerciseHiddenTestsInputSchema } from "./coding-exercises";
import { getCodingExerciseReferenceSolution, validateReferenceSolutionAgainstHiddenTests } from "./executions";

const codingExerciseHiddenTestsClient = prisma as typeof prisma & {
  pluginCodingExerciseReferenceSolution: {
    upsert(args: Prisma.PluginCodingExerciseReferenceSolutionUpsertArgs): Promise<unknown>;
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

export async function replaceCodingExerciseHiddenTests(params: {
  activityId: string;
  courseId: string;
  activityConfig: unknown;
  user: { id: string; email: string; name: string | null; roles: ("admin" | "teacher" | "student")[] };
  input: unknown;
}) {
  await assertCanManageCourse(params.user, params.courseId);
  const input = codingExerciseHiddenTestsInputSchema.parse(params.input);
  const seenIds = new Set<string>();
  for (const test of input.tests) {
    if (seenIds.has(test.id)) {
      throw new AppError(400, "HIDDEN_TEST_DUPLICATE_ID", "Hidden test ids must be unique.");
    }
    seenIds.add(test.id);
  }

  const validationSummary = await validateReferenceSolutionAgainstHiddenTests({
    activityConfig: params.activityConfig,
    sourceCode: input.referenceSolution,
    sampleTests: input.sampleTests,
    hiddenTests: input.tests.map((test, index) => ({
      ...test,
      testCode: test.testCode,
      orderIndex: index
    })),
    privateConfig: input.privateConfig
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

  await codingExerciseHiddenTestsClient.$transaction(async (transaction) => {
    await transaction.pluginCodingExerciseHiddenTest.deleteMany({
      where: { activityId: params.activityId }
    });

    if (input.tests.length) {
      await transaction.pluginCodingExerciseHiddenTest.createMany({
        data: input.tests.map((test, index) => ({
          activityId: params.activityId,
          id: test.id,
          name: test.name,
          stdin: test.stdin,
          expectedOutput: test.expectedOutput,
          orderIndex: index,
          isEnabled: test.isEnabled,
          weight: test.weight,
          metadata: {
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
        validationSummary: validationSummary as Prisma.InputJsonValue
      },
      update: {
        sourceCode: input.referenceSolution,
        privateConfig: input.privateConfig as Prisma.InputJsonValue,
        validationSummary: validationSummary as Prisma.InputJsonValue
      }
    });
  });

  return listCodingExerciseHiddenTests({ activityId: params.activityId });
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
    id: test.id,
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
