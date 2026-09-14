import { NextRequest } from "next/server";
import { deleteActivityBankFolder, updateActivityBankFolder } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string; folderId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, folderId } = await params;
    return json({ folder: await updateActivityBankFolder(user, activityBankId, folderId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, folderId } = await params;
    const result = await deleteActivityBankFolder(user, activityBankId, folderId);
    return json({ ok: true, activityCount: result.activityCount });
  });
}
