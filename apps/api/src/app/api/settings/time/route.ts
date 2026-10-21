import { getApplicationTimeSettings, updateApplicationTimeSettings } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";
export function OPTIONS() { return options(); }
export async function GET() { return handleRoute(async () => json(await getApplicationTimeSettings(await requireUser()))); }
export async function PUT(request: NextRequest) { return handleRoute(async () => json(await updateApplicationTimeSettings(await requireUser(), await readJson(request)))); }
