import { readBoundedFormData } from "@cognelo/core";
import { NextRequest } from "next/server";
import { AppError, uploadMediaImage, isTeacher, isCourseManager } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    if (!(isTeacher(user) || isCourseManager(user))) throw new AppError(403, "FORBIDDEN", "Media uploads require authoring access.");
    const formData = await readBoundedFormData(request);
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError(400, "MEDIA_FILE_REQUIRED", "Choose an image to upload.");
    }
    return json({ asset: await uploadMediaImage(user, file) }, { status: 201 });
  });
}
