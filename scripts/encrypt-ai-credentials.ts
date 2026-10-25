import { prisma } from "@cognelo/db";
import { encryptCredential } from "../packages/core/src/credentials";

async function main() {
try {
  const rows = await prisma.aiAgentConnection.findMany({ select: { id: true, apiKey: true, baseUrl: true } });
  let migrated = 0;
  for (const row of rows) {
    const data: { apiKey?: string | null; baseUrl?: string; isEnabled?: boolean } = {};
    if (row.apiKey && !row.apiKey.startsWith("ai-v1:")) data.apiKey = encryptCredential(row.apiKey);
    if (row.baseUrl) {
      const url = new URL(row.baseUrl);
      if (url.username || url.password || url.search || url.hash) {
        url.username = ""; url.password = ""; url.search = ""; url.hash = "";
        data.baseUrl = url.href; data.isEnabled = false;
      }
    }
    if (!Object.keys(data).length) continue;
    const result = await prisma.aiAgentConnection.updateMany({ where: { id: row.id, apiKey: row.apiKey, baseUrl: row.baseUrl }, data });
    migrated += result.count;
  }
  console.log(`Protected ${migrated} legacy model connection records.`);
} finally { await prisma.$disconnect(); }

}
void main().catch(() => { console.error("Model credential encryption failed; verify the instance key and database connection."); process.exitCode = 1; });
