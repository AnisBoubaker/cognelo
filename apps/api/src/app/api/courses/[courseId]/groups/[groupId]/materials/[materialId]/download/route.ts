import { Readable } from "node:stream";
import path from "node:path";
import { NextRequest } from "next/server";
import { getGroupMaterialForDownload, openStoredMaterial } from "@cognelo/core";
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

    const file = await openStoredMaterial(path.resolve(process.cwd(), "../../storage/group-materials"), [courseId, groupId], metadata.storedName);
    const stream = Readable.toWeb(file.createReadStream()) as ReadableStream;

    return new Response(stream, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": typeof metadata.mimeType === "string" ? metadata.mimeType : "application/octet-stream",
        "Content-Disposition": `attachment; filename="${typeof metadata.originalName === "string" ? metadata.originalName : material.title}"`
      }
    });
  });
}
