import type { NextRequest } from "next/server";
import { getServerEnv } from "@cognelo/config";
import { StudentCourseExportRequestSchema } from "@cognelo/contracts";
import { assertStudentCourseExportAccess, buildStudentCourseExport, readBoundedJson } from "@cognelo/core";
import { handleRoute, options, requireUser } from "@/lib/http";
import { hasSafeExamBrowserAccess } from "@/lib/safe-exam-browser";
import { createStudentCourseExportFile } from "@/lib/student-course-export-file";
import { studentCourseExportLabels } from "@/lib/student-course-export-labels";

export const runtime = "nodejs";
type Params = { params: Promise<{ courseId: string }> };
export function OPTIONS() { return options(); }
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    await assertStudentCourseExportAccess(user, courseId);
    const input = StudentCourseExportRequestSchema.parse(await readBoundedJson(request, 4096));
    const file = await createStudentCourseExportFile(signal => buildStudentCourseExport(user, courseId, input, studentCourseExportLabels(input.locale), {
      signal, hasSafeExamBrowserAccess: scope => hasSafeExamBrowserAccess(user, scope),
      validateSession: async () => { await requireUser(); }
    }), user, input.locale, request.signal);
    const fileName = encodeURIComponent(file.fileName).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(new Uint8Array(file.bytes), { headers: {
      "Cache-Control": "private, no-store, max-age=0", "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename="course.zip"; filename*=UTF-8''${fileName}`,
      "X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin": getServerEnv().CORS_ORIGIN,
      "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "Content-Disposition"
    } });
  });
}
