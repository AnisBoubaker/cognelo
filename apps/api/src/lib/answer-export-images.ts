import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";

const blocked = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(address, prefix);
export function publicImageUrl(value: string) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("Unsupported image URL");
  if (isIP(url.hostname) === 6 || url.hostname.includes(":")) throw new Error("Unsupported image address");
  if (isIP(url.hostname) && blocked.check(url.hostname)) throw new Error("Private image address");
  return url;
}
export type AnswerExportImageBudget = { remainingBytes: number; deadline: number };
export const createAnswerExportImageBudget = (): AnswerExportImageBudget => ({ remainingBytes: 20_000_000, deadline: Date.now() + 30_000 });
export function consumeAnswerExportImageBytes(budget: AnswerExportImageBudget, bytes: number) {
  if (bytes > budget.remainingBytes) { budget.remainingBytes = 0; throw new Error("Export image budget exceeded"); }
  budget.remainingBytes -= bytes;
}

/** No cookies/auth, pinned public IPv4, shared transfer/deadline limits across redirects. */
export async function fetchPublicExportImage(value: string, budget = createAnswerExportImageBudget(), redirects = 0): Promise<{ bytes: Buffer; mime: string }> {
  const url = publicImageUrl(value);
  const remainingMs = Math.min(5000, budget.deadline - Date.now());
  if (remainingMs <= 0 || budget.remainingBytes <= 0) throw new Error("Export image budget exceeded");
  const signal = AbortSignal.timeout(remainingMs);
  const addresses = await Promise.race([
    lookup(url.hostname, { family: 4, all: true }),
    new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("Image lookup timed out")), { once: true }))
  ]);
  if (!addresses.length || addresses.some(({ address }) => blocked.check(address))) throw new Error("Private image address");
  const response = await new Promise<{ bytes: Buffer; mime: string; redirect?: string }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(url, { signal, agent: false, maxHeaderSize: 16 * 1024, lookup: (_host, options, callback) => {
      const address = addresses[0].address;
      if (typeof options === "object" && options.all) callback(null, [{ address, family: 4 }]); else callback(null, address, 4);
    }, headers: { Accept: "image/png,image/jpeg,image/webp,image/gif", "User-Agent": "Cognelo-AnswerExport" } }, (incoming) => {
      if ([301, 302, 303, 307, 308].includes(incoming.statusCode ?? 0) && incoming.headers.location) {
        incoming.destroy();
        try { resolve({ bytes: Buffer.alloc(0), mime: "", redirect: new URL(incoming.headers.location, url).href }); }
        catch { reject(new Error("Invalid image redirect")); }
        return;
      }
      const mime = incoming.headers["content-type"]?.split(";")[0].trim() ?? "";
      if (incoming.statusCode !== 200 || !/^image\/(png|jpeg|webp|gif)$/.test(mime)) { incoming.destroy(); reject(new Error("Unsupported image response")); return; }
      const chunks: Buffer[] = []; let size = 0;
      incoming.on("data", (chunk: Buffer) => {
        size += chunk.length;
        try {
          consumeAnswerExportImageBytes(budget, chunk.length);
          if (size > 10_000_000) throw new Error("Image too large");
          chunks.push(chunk);
        } catch (error) { reject(error); incoming.destroy(); request.destroy(); }
      });
      incoming.on("end", () => resolve({ bytes: Buffer.concat(chunks), mime }));
      incoming.on("error", reject);
      incoming.on("aborted", () => reject(new Error("Image response interrupted")));
    });
    request.on("error", reject);
  });
  if (response.redirect) {
    if (redirects >= 3) throw new Error("Too many image redirects");
    return fetchPublicExportImage(response.redirect, budget, redirects + 1);
  }
  return response;
}
