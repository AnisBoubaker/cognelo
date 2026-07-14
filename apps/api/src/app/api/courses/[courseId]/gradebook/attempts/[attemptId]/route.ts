import { NextRequest } from "next/server";
import { z } from "zod";
import { runActivityAttemptDeletedHooks } from "@cognelo/activity-sdk/server";
import { deleteActivitySubmission } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; attemptId: string }> };

const deleteSubmissionSchema = z.object({
  reason: z.string().trim().min(1).max(1000)
});

export function OPTIONS() {
  return options();
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    const input = deleteSubmissionSchema.parse(await readJson(request));

    const result = await deleteActivitySubmission(user, courseId, {
      attemptId,
      reason: input.reason
    });
    await runActivityAttemptDeletedHooks({
      user,
      courseId,
      groupId: result.attempt.groupId,
      activityId: result.attempt.activityId,
      pluginKey: result.attempt.pluginKey,
      coreAttemptId: result.attempt.id,
      pluginAttemptRef: result.attempt.pluginAttemptRef,
      reason: input.reason,
      deletedAt: deletionTimestamp(result.attempt.metadata) ?? new Date()
    });

    return json({ result });
  });
}

function deletionTimestamp(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const deletion = (metadata as Record<string, unknown>).deletion;
  if (!deletion || typeof deletion !== "object" || Array.isArray(deletion)) {
    return null;
  }
  const deletedAt = (deletion as Record<string, unknown>).deletedAt;
  return typeof deletedAt === "string" ? deletedAt : null;
}
