import { NextRequest } from "next/server";
import { RecordIdSchema } from "@cognelo/contracts";
import { compareBankActivityVersions } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string }> };

export function OPTIONS() { return options(); }

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    const fromVersionId = RecordIdSchema.parse(request.nextUrl.searchParams.get("fromVersionId"));
    const toVersionId = RecordIdSchema.parse(request.nextUrl.searchParams.get("toVersionId"));
    const diff = await compareBankActivityVersions(user, activityBankId, bankActivityId, fromVersionId, toVersionId);
    return json({ diff });
  });
}
