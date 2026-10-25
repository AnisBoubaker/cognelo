import { readBoundedJson, MAX_UPLOAD_JSON_BYTES } from "@cognelo/core";
import { getServerEnv } from "@cognelo/config";
import { NextRequest } from "next/server";
import { AnswerExportRequestSchema } from "@cognelo/contracts";
import { buildAnswerExport, listAnswerExportStudents } from "@cognelo/core";
import { createAnswerExportFile } from "@/lib/answer-export-pdf";
import { answerExportLabels } from "@/lib/answer-export-labels";
import { handleRoute, json, options, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; activityId: string }> };
export const runtime = "nodejs";
export function OPTIONS() { return options(); }
export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(); const { courseId, activityId } = await params;
    return json({ students: await listAnswerExportStudents(user, courseId, activityId, request.nextUrl.searchParams.get("groupId") || undefined) });
  });
}
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(); const { courseId, activityId } = await params;
    const input = AnswerExportRequestSchema.parse(await readBoundedJson(request, MAX_UPLOAD_JSON_BYTES));
    const data = await buildAnswerExport(user, courseId, activityId, input, answerExportLabels(input.locale));
    const file = await createAnswerExportFile(data, user);
    return new Response(new Uint8Array(file.bytes), { headers: { "Cache-Control": "no-store", "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename="answers.${input.format}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Access-Control-Allow-Origin": getServerEnv().CORS_ORIGIN, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "Content-Disposition" } });
  });
}
