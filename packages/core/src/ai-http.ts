import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";
import { AppError } from "./errors";

type Address = { address: string; family: number };
export function isPublicAiAddress(address: string) {
  if (!ipaddr.isValid(address)) return false;
  const ip = ipaddr.process(address);
  return ip.range() === "unicast" && (ip.kind() !== "ipv6" || ip.match(ipaddr.parse("2000::"), 3));
}

/** Pin the validated address and never forward model credentials through redirects. */
export async function fetchAiResponse(endpoint: string, init: { headers: Record<string, string>; body: string }, allowPrivate = false,
  dependencies: { resolve?: (host: string) => Promise<Address[]> } = {}) {
  const url = new URL(endpoint);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) throw new AppError(400, "AI_ENDPOINT_INVALID", "Use an HTTP(S) model endpoint without credentials or fragments.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const timeout = AbortSignal.timeout(120_000);
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await Promise.race([
    (dependencies.resolve ?? ((host) => lookup(host, { all: true })))(hostname),
    new Promise<never>((_, reject) => timeout.addEventListener("abort", () => reject(new AppError(504, "AI_REQUEST_TIMEOUT", "The model request timed out.")), { once: true }))
  ]);
  if (!addresses.length || (!allowPrivate && addresses.some((address) => !isPublicAiAddress(address.address)))) throw new AppError(403, "AI_ENDPOINT_NOT_PUBLIC", "Private model endpoints require an administrator-managed connection.");
  const address = addresses.find((item) => item.family === 4) ?? addresses[0];
  if (url.protocol !== "https:" && isPublicAiAddress(address.address)) throw new AppError(400, "AI_ENDPOINT_HTTPS_REQUIRED", "Public model endpoints must use HTTPS.");
  return new Promise<Response>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      method: "POST", signal: timeout, agent: false, family: address.family, maxHeaderSize: 16 * 1024,
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: { ...init.headers, "Accept-Encoding": "identity", "Content-Length": Buffer.byteLength(init.body) }
    }, (response) => {
      const chunks: Buffer[] = []; let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) { response.destroy(); reject(new AppError(502, "AI_RESPONSE_TOO_LARGE", "The model response exceeds its limit.")); }
        else chunks.push(chunk);
      });
      response.on("end", () => {
        const status = response.statusCode ?? 502;
        if (status < 200 || status > 599) { reject(new AppError(502, "AI_RESPONSE_INVALID", "The model endpoint returned an invalid response.")); return; }
        const body = [204, 205, 304].includes(status) ? null : new Uint8Array(Buffer.concat(chunks));
        resolve(new Response(body, { status, headers: { "Content-Type": "application/json" } }));
      });
      response.on("error", reject);
      response.on("aborted", () => reject(new AppError(502, "AI_RESPONSE_INTERRUPTED", "The model response was interrupted.")));
    });
    request.on("error", () => reject(new AppError(502, "AI_REQUEST_FAILED", "The model endpoint could not be reached.")));
    request.end(init.body);
  });
}
