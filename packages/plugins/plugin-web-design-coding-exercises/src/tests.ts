import { Prisma, prisma } from "@cognelo/db";
import { assertCanManageCourse, AppError } from "@cognelo/core";
import {
  normalizeWebDesignExerciseConfig,
  webDesignExerciseTestsInputSchema,
  type WebDesignExerciseFile,
  type WebDesignExerciseTestKind
} from "./web-design-coding-exercises";

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
  const validationSummary = {
    phase: "not-run",
    status: "pending-runner",
    message: "Reference validation will run after the Playwright runner is connected."
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
          validationSummary: validationSummary as Prisma.InputJsonValue
        }))
      });
    }

    await transaction.pluginWebDesignExerciseReferenceBundle.upsert({
      where: { activityId: params.activityId },
      create: {
        activityId: params.activityId,
        files: referenceFiles as unknown as Prisma.InputJsonValue,
        validationSummary: validationSummary as Prisma.InputJsonValue
      },
      update: {
        files: referenceFiles as unknown as Prisma.InputJsonValue,
        validationSummary: validationSummary as Prisma.InputJsonValue
      }
    });
  });

  return listWebDesignExerciseTests({ activityId: params.activityId });
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
