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
/** No cookies/auth, DNS-pinned public IPv4, bounded bytes/time, every redirect revalidated. */
export async function fetchPublicExportImage(value: string, redirects = 0): Promise<{ bytes: Buffer; mime: string }> {
  const url = publicImageUrl(value);
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(({ address }) => blocked.check(address))) throw new Error("Private image address");
  const response = await new Promise<{ bytes: Buffer; mime: string; redirect?: string }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(url, { lookup: (_host, options, callback) => {
      const address = addresses[0].address;
      if (typeof options === "object" && options.all) callback(null, [{ address, family: 4 }]); else callback(null, address, 4);
    }, headers: { Accept: "image/png,image/jpeg,image/webp,image/gif", "User-Agent": "Cognelo-AnswerExport" } }, (incoming) => {
      if ([301, 302, 303, 307, 308].includes(incoming.statusCode ?? 0) && incoming.headers.location) {
        incoming.resume(); resolve({ bytes: Buffer.alloc(0), mime: "", redirect: new URL(incoming.headers.location, url).href }); return;
      }
      const mime = incoming.headers["content-type"]?.split(";")[0].trim() ?? "";
      if (incoming.statusCode !== 200 || !/^image\/(png|jpeg|webp|gif)$/.test(mime)) { incoming.resume(); reject(new Error("Unsupported image response")); return; }
      const chunks: Buffer[] = []; let size = 0;
      incoming.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 10_000_000) { request.destroy(new Error("Image too large")); return; } chunks.push(chunk); });
      incoming.on("end", () => resolve({ bytes: Buffer.concat(chunks), mime }));
      incoming.on("error", reject);
    });
    const timer = setTimeout(() => request.destroy(new Error("Image request timed out")), 5000);
    request.on("close", () => clearTimeout(timer)); request.on("error", reject);
  });
  if (response.redirect) {
    if (redirects >= 3) throw new Error("Too many image redirects");
    return fetchPublicExportImage(response.redirect, redirects + 1);
  }
  return response;
}
