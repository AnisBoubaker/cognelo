import { NextRequest } from "next/server";
import { z } from "zod";
import {
  AppError,
  getTestItemExecutionContext,
  saveTestItemAttemptState
} from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string; testItemId: string }> };

const stateInputSchema = z.object({
  parentAttemptId: z.string().min(1),
  state: z.record(z.unknown())
});

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId, testItemId } = await params;
    const parentAttemptId = new URL(request.url).searchParams.get("parentAttemptId");
    if (!parentAttemptId) {
      throw new AppError(400, "TEST_ATTEMPT_REQUIRED", "A parent Test attempt is required.");
    }
    const context = await getTestItemExecutionContext(
      user,
      courseId,
      groupId,
      activityId,
      parentAttemptId,
      testItemId,
      { allowCompletedParent: true }
    );
    return json({
      itemAttempt: context.itemAttempt ? serializeTestItemAttempt(context.itemAttempt) : null
    });
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId, testItemId } = await params;
    const input = stateInputSchema.parse(await readJson(request));
    const itemAttempt = await saveTestItemAttemptState(
      user,
      courseId,
      groupId,
      activityId,
      input.parentAttemptId,
      testItemId,
      input.state
    );
    return json({ itemAttempt: serializeTestItemAttempt(itemAttempt) });
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function serializeTestItemAttempt(itemAttempt: {
  id: string;
  lifecycle: string;
  rawScore: number | null;
  rawMaxScore: number | null;
  normalizedScore: number | null;
  normalizedMaxScore: number | null;
  result: unknown;
  submittedAt: Date | null;
  gradedAt: Date | null;
}) {
  return {
    id: itemAttempt.id,
    lifecycle: itemAttempt.lifecycle,
    rawScore: itemAttempt.rawScore,
    rawMaxScore: itemAttempt.rawMaxScore,
    normalizedScore: itemAttempt.normalizedScore,
    normalizedMaxScore: itemAttempt.normalizedMaxScore,
    state: asRecord(asRecord(itemAttempt.result).state),
    submittedAt: itemAttempt.submittedAt,
    gradedAt: itemAttempt.gradedAt
  };
}
