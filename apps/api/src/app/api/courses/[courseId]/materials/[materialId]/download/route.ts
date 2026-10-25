import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { getMaterialForDownload, openStoredMaterial } from "@cognelo/core";
import { handleRoute, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; materialId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, materialId } = await params;
    const material = await getMaterialForDownload(user, courseId, materialId);
    const metadata = material.metadata as {
      storedName?: string;
      originalName?: string;
      mimeType?: string;
    };

    if (!metadata.storedName) {
      return NextResponse.json({ error: { code: "NOT_DOWNLOADABLE", message: "This material has no stored file." } }, { status: 400 });
    }

    const file = await openStoredMaterial(path.resolve(process.cwd(), "../../storage/course-materials"), [courseId], metadata.storedName);
    const fileStat = await file.stat();
    const stream = Readable.toWeb(file.createReadStream()) as ReadableStream;

    return new NextResponse(stream, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": metadata.mimeType ?? "application/octet-stream",
        "Content-Length": String(fileStat.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.originalName ?? material.title)}"`
      }
    });
  });
}
