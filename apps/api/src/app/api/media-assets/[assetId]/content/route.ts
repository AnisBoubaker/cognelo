import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { getMediaAssetForDelivery } from "@cognelo/core";
import { handleRoute, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ assetId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { assetId } = await params;
    const asset = await getMediaAssetForDelivery(user, assetId);
    const stream = Readable.toWeb(createReadStream(asset.filePath)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.byteSize),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  });
}
