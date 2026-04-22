import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { getCourseMaterialForGroupDownload } from "@cognelo/core";
import { handleRoute, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; materialId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, materialId } = await params;
    const material = await getCourseMaterialForGroupDownload(user, courseId, groupId, materialId);
    const metadata = material.metadata as {
      storedName?: string;
      originalName?: string;
      mimeType?: string;
    };

    if (!metadata.storedName) {
      return NextResponse.json({ error: { code: "NOT_DOWNLOADABLE", message: "This material has no stored file." } }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), "../../storage/course-materials", courseId, metadata.storedName);
    const fileStat = await stat(filePath);
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": metadata.mimeType ?? "application/octet-stream",
        "Content-Length": String(fileStat.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.originalName ?? material.title)}"`
      }
    });
  });
}
