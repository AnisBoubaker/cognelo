import path from "node:path";
import { access, readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { getGroupMaterialForDownload } from "@cognelo/core";
import { handleRoute, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; materialId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, materialId } = await params;
    const material = await getGroupMaterialForDownload(user, courseId, groupId, materialId);
    const metadata = material.metadata as Record<string, unknown>;
    if (typeof metadata.storedName !== "string") {
      throw new Error("Stored file metadata is missing.");
    }

    const filePath = path.join(process.cwd(), "../../storage/group-materials", courseId, groupId, metadata.storedName);
    await access(filePath);
    const buffer = await readFile(filePath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": typeof metadata.mimeType === "string" ? metadata.mimeType : "application/octet-stream",
        "Content-Disposition": `attachment; filename="${typeof metadata.originalName === "string" ? metadata.originalName : material.title}"`,
        "Cache-Control": "no-store"
      }
    });
  });
}
