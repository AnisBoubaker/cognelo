import { enqueueActivityVariation, getActivityVariationJob } from "@/lib/activity-variations";
import { AppError } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string }> };

export function OPTIONS() { return options(); }

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    const job = await enqueueActivityVariation(user, activityBankId, bankActivityId, await readJson(request));
    return json({ job }, { status: 202 });
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    const jobId = request.nextUrl.searchParams.get("jobId")?.trim();
    if (!jobId) throw new AppError(400, "ACTIVITY_VARIATION_JOB_REQUIRED", "An activity variation job id is required.");
    return json({ job: await getActivityVariationJob(user, activityBankId, bankActivityId, jobId) });
  });
}
