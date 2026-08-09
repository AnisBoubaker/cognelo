import { prisma } from "@cognelo/db";
import { handleRoute, json, options } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    await prisma.$queryRaw`SELECT 1`;
    return json({ ok: true });
  });
}
