import { NextRequest } from "next/server";
import { AppError, uploadMediaImage } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError(400, "MEDIA_FILE_REQUIRED", "Choose an image to upload.");
    }
    return json({ asset: await uploadMediaImage(user, file) }, { status: 201 });
  });
}
