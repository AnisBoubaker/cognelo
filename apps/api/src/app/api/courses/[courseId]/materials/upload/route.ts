import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { createMaterial } from "@cognara/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SAFE_NAME_PATTERN = /[^a-zA-Z0-9._-]/g;

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const titleValue = formData.get("title");
    const parentIdValue = formData.get("parentId");
    const positionValue = formData.get("position");

    if (!(file instanceof File)) {
      return json({ error: { code: "VALIDATION_ERROR", message: "A file is required." } }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return json({ error: { code: "UPLOAD_TOO_LARGE", message: "Files must be 25 MB or smaller." } }, { status: 413 });
    }

    const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name;
    const originalName = file.name || "course-material";
    const storedName = `${randomUUID()}-${originalName.replace(SAFE_NAME_PATTERN, "_")}`;
    const storageDir = path.join(process.cwd(), "../../storage/course-materials", courseId);
    await mkdir(storageDir, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(storageDir, storedName), bytes);

    const material = await createMaterial(user, courseId, {
      title,
      kind: "file",
      parentId: typeof parentIdValue === "string" && parentIdValue ? parentIdValue : null,
      metadata: {
        originalName,
        storedName,
        mimeType: file.type || "application/octet-stream",
        size: file.size
      },
      position: typeof positionValue === "string" ? Number(positionValue) : 0
    });

    return json({ material }, { status: 201 });
  });
}
