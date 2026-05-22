import { NextRequest } from "next/server";
import { z } from "zod";
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

    return json({
      result: await deleteActivitySubmission(user, courseId, {
        attemptId,
        reason: input.reason
      })
    });
  });
}
