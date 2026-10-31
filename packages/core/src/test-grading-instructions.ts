import { createHash, randomUUID } from "node:crypto";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { resolvePluginAiGradingInstructionsHandler } from "@cognelo/activity-sdk/server";
import { ReplaceTestAiGradingInstructionsSchema, type CurrentUser, type TestAiGradingInstructions } from "@cognelo/contracts";
import { prisma, type Prisma } from "@cognelo/db";
import { assertCanManageCourse } from "./authorization";
import { assertCanManageActivityBank } from "./subjects";
import { withActivityAuthoringChange } from "./activity-authoring-live";
import { isActivityTypeAvailable } from "./plugins";
import { AppError, notFound } from "./errors";

export type TestGradingInstructionsTarget = { scope: "course" | "bank"; ownerId: string; activityId: string };
const itemInclude = { where: { removedAt: null }, include: { activity: { include: { activityType: true } } }, orderBy: [{ position: "asc" as const }, { id: "asc" as const }] };

async function authorize(user: CurrentUser, target: TestGradingInstructionsTarget) {
  if (target.scope === "course") await assertCanManageCourse(user, target.ownerId);
  else await assertCanManageActivityBank(user, target.ownerId);
}
function pluginContext(user: CurrentUser, scope: "course" | "bank", activityId: string, tx: Prisma.TransactionClient) {
  return { scope, activityId, actorUserId: user.id, transaction: {
    query: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => tx.$queryRaw<T>(query, ...values),
    execute: (query: TemplateStringsArray, ...values: unknown[]) => tx.$executeRaw(query, ...values)
  } };
}
async function read(user: CurrentUser, target: TestGradingInstructionsTarget, tx: Prisma.TransactionClient) {
  const test = target.scope === "course"
    ? await tx.test.findFirst({ where: { activityId: target.activityId, courseId: target.ownerId }, include: { items: itemInclude } })
    : await tx.bankTest.findFirst({ where: { bankActivityId: target.activityId, activity: { bankId: target.ownerId } }, include: { items: itemInclude } });
  if (!test) throw notFound("Test");
  const items: TestAiGradingInstructions["items"] = [];
  const supported = new Map<string, boolean>();
  for (const item of test.items) {
    const key = item.activity.activityType.key;
    const handler = resolvePluginAiGradingInstructionsHandler(key);
    if (!getActivityDefinition(key)?.grading?.supportsAiFeedbackGrading || !handler) continue;
    if (!supported.has(key)) supported.set(key, await isActivityTypeAvailable(key));
    if (!supported.get(key)) continue;
    items.push({ testItemId: item.id, activityId: item.activity.id, title: item.activity.title,
      instructions: await handler.getInstructions(pluginContext(user, target.scope, item.activity.id, tx)) });
  }
  const revision = createHash("sha256").update(JSON.stringify({ target, items })).digest("hex");
  return { revision, items, sourceItems: test.items };
}
export async function getTestAiGradingInstructions(user: CurrentUser, target: TestGradingInstructionsTarget): Promise<TestAiGradingInstructions> {
  await authorize(user, target);
  return prisma.$transaction(async tx => {
    const { revision, items } = await read(user, target, tx);
    return { revision, items };
  });
}

export async function replaceTestAiGradingInstructions(user: CurrentUser, target: TestGradingInstructionsTarget, input: unknown) {
  await authorize(user, target);
  const data = ReplaceTestAiGradingInstructionsSchema.parse(input);
  const privateChange: { before: unknown; after: unknown } = { before: null, after: null };
  const replace = async (tx: Prisma.TransactionClient) => {
    const current = await read(user, target, tx);
    if (current.revision !== data.expectedRevision) throw new AppError(409, "TEST_AI_INSTRUCTIONS_CONFLICT", "The Test activities or their instructions changed. Reopen the dialog before replacing them.");
    if (!current.items.length) throw new AppError(409, "TEST_AI_INSTRUCTIONS_UNAVAILABLE", "This Test has no activities with editable AI grading instructions.");
    const changed = current.items.filter(item => item.instructions !== data.instructions);
    privateChange.before = current.items;
    privateChange.after = current.items.map(item => ({ ...item, instructions: data.instructions }));
    for (const item of changed) {
      const source = current.sourceItems.find(source => source.id === item.testItemId)!;
      const handler = resolvePluginAiGradingInstructionsHandler(source.activity.activityType.key)!;
      await handler.replaceInstructions({ ...pluginContext(user, target.scope, item.activityId, tx), instructions: data.instructions });
    }
    if (target.scope === "bank" && changed.length) {
      // Private instructions follow the ordinary bank draft/publication boundary.
      await tx.bankActivity.update({ where: { id: target.activityId }, data: { lifecycle: "draft" } });
      for (const item of changed) {
        const source = current.sourceItems.find(source => source.id === item.testItemId)!;
        const metadata = source.activity.metadata && typeof source.activity.metadata === "object" && !Array.isArray(source.activity.metadata)
          ? source.activity.metadata : {};
        await tx.bankActivity.update({ where: { id: item.activityId }, data: { lifecycle: "draft",
          metadata: { ...metadata, aiGradingInstructionsRevision: randomUUID() }
        } });
      }
    }
    return { updatedCount: changed.length };
  };
  if (target.scope === "course") return withActivityAuthoringChange(user, target.ownerId, target.activityId, data, replace,
    { eventType: "test_ai_grading_instructions_replaced", privateChange, preservePartialSubmissions: true });
  return prisma.$transaction(replace, { isolationLevel: "Serializable", timeout: 30_000 }).catch(error => {
    if ((error as { code?: string }).code === "P2034") throw new AppError(409, "TEST_AI_INSTRUCTIONS_CONFLICT", "The Test changed during replacement. Reopen the dialog and try again.");
    throw error;
  });
}
