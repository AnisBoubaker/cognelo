import { createServer } from "node:http";
import { prisma, Prisma } from "@cognelo/db";
import { encryptCredential } from "@cognelo/core";
import { credentialsFor } from "./auth";

/** Local-only OpenAI boundary stand-in; all homework/core APIs and storage remain real. */
export async function homeworkModelFixture(token: string, options: { hold?: boolean; failFirst?: number; provider?: "openai" | "codex" | "claude" | "ollama" } = {}) {
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("teacher").email } });
  let sequence = 0, active = 0, maximum = 0, hold = options.hold ?? false, failures = options.failFirst ?? 0;
  const embeddingTexts: string[] = [];
  const requests: Array<{ path: string; model: string; authenticated: boolean }> = [];
  const starts: string[] = [], waiting: Array<() => void> = [];
  const server = createServer(async (request, response) => {
    let counted = false;
    try {
      let raw = ""; for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw);
      requests.push({ path: request.url ?? "", model: body.model, authenticated: request.headers.authorization === "Bearer synthetic-test-key" || request.headers["x-api-key"] === "synthetic-test-key" });
      if (request.url?.endsWith("/embeddings") || request.url?.endsWith("/api/embed")) { embeddingTexts.push(...body.input); response.writeHead(200, { "Content-Type": "application/json" }); const vectors = body.input.map(() => Array.from({ length: body.dimensions ?? 8 }, (_, i) => i === 0 ? 1 : 0)); response.end(JSON.stringify(request.url?.endsWith("/api/embed") ? { embeddings: vectors } : { data: vectors.map((embedding: number[], index: number) => ({ index, embedding })) })); return; }
      const prompt = body.input ?? body.messages.at(-1).content;
      if (prompt.startsWith("Generate a grading rubric")) {
        const text = JSON.stringify({ criteria: [{ title: "Correctness", description: "Handles the requested cases", weightPercent: 100 }] });
        response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ output_text: text, content: [{ text }], message: { content: text } })); return;
      }
      const payload = JSON.parse(prompt);
      if (Array.isArray(payload.functions)) { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ output_text: JSON.stringify({ selectedFunctionKeys: payload.functions.slice(0, 1).map((fn: { key: string }) => fn.key) }) })); return; }
      starts.push(payload.submittedCode ?? ""); sequence++; active++; counted = true; maximum = Math.max(maximum, active); const number = sequence;
      if (hold) await new Promise<void>(resolve => waiting.push(resolve));
      if (response.destroyed) return;
      if (failures-- > 0) { response.writeHead(503); response.end(); return; }
      response.writeHead(200, { "Content-Type": "application/json" }); const text = JSON.stringify({ questionText: `Question ${number}: explain the main control flow and boundary cases of your submitted C function.` }); response.end(JSON.stringify({ output_text: text, content: [{ text }], message: { content: text } }));
    } catch { if (!response.headersSent) response.writeHead(500); response.end(); }
    finally { if (counted) active--; }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const connection = await prisma.aiAgentConnection.create({ data: { displayName: `Homework fixture ${token}`, provider: options.provider ?? "openai", model: "synthetic-model", ownerId: null, baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, apiKey: encryptCredential("synthetic-test-key") } });
  await prisma.user.update({ where: { id: teacher.id }, data: { metadata: { ...teacher.metadata as object, aiPreferences: { questionAuthoringAiAgentConnectionId: connection.id } } } });
  const release = () => { hold = false; waiting.splice(0).forEach(resolve => resolve()); };
  return { connection, requests, starts, embeddingTexts, get active() { return active; }, get maximum() { return maximum; }, release,
    async close() { release(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await prisma.user.update({ where: { id: teacher.id }, data: { metadata: teacher.metadata ?? Prisma.JsonNull } }); await prisma.aiAgentConnection.delete({ where: { id: connection.id } }); }
  };
}
