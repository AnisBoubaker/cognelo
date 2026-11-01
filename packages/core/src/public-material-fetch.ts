import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";
import { isPublicAiAddress } from "./ai-http";
import { AppError } from "./errors";

/** Bounded, DNS-pinned public GET. No cookies, credentials, arbitrary headers or private-network override. */
export async function fetchPublicMaterial(value: string, options: { signal?: AbortSignal; maxBytes?: number; allowedHostname?: string } = {}) {
  const maxBytes = Math.min(options.maxBytes ?? 2 * 1024 * 1024, 25 * 1024 * 1024);
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
  let url = new URL(value);
  for (let redirect = 0; redirect <= 3; redirect++) {
    signal.throwIfAborted();
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || (options.allowedHostname && url.hostname !== options.allowedHostname)) throw new AppError(400, "MATERIAL_URL_INVALID", "Use a public HTTP(S) material URL without credentials.");
    url.hash = "";
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = await new Promise<Array<{ address: string; family: number }>>((resolve, reject) => {
      const abort = () => reject(new AppError(504, "MATERIAL_FETCH_TIMEOUT", "The material request timed out."));
      signal.addEventListener("abort", abort, { once: true });
      (isIP(host) ? Promise.resolve([{ address: host, family: isIP(host) }]) : lookup(host, { all: true }))
        .then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
    if (!addresses.length || addresses.some(address => !isPublicAiAddress(address.address))) throw new AppError(403, "MATERIAL_URL_NOT_PUBLIC", "Only public materials can be fetched.");
    const address = addresses.find(address => address.family === 4) ?? addresses[0];
    const result = await new Promise<{ status: number; headers: IncomingHttpHeaders; bytes: Buffer }>((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
        method: "GET", signal, agent: false, family: address.family, maxHeaderSize: 16_384,
        lookup: (_host, _options, callback) => callback(null, address.address, address.family),
        headers: { "Accept-Encoding": "identity", "User-Agent": "Cognelo-Material-Indexer", Accept: "*/*" }
      }, response => {
        const status = response.statusCode ?? 502;
        if (status !== 200) { resolve({ status, headers: response.headers, bytes: Buffer.alloc(0) }); response.destroy(); return; }
        const chunks: Buffer[] = []; let size = 0;
        response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > maxBytes) { reject(new AppError(413, "MATERIAL_TOO_LARGE", "This material exceeds the extraction size limit.")); response.destroy(); } else chunks.push(chunk); });
        response.on("end", () => resolve({ status, headers: response.headers, bytes: Buffer.concat(chunks) }));
        response.on("error", reject); response.on("aborted", () => reject(new AppError(502, "MATERIAL_FETCH_INTERRUPTED", "The material transfer was interrupted.")));
      });
      request.on("error", reject); request.end();
    });
    if ([301, 302, 303, 307, 308].includes(result.status) && result.headers.location && redirect < 3) { url = new URL(result.headers.location, url); continue; }
    if (result.status !== 200) throw new AppError(422, "MATERIAL_HTTP_ERROR", `The material returned HTTP ${result.status}. Public access is required.`);
    let bytes = result.bytes;
    const encoding = result.headers["content-encoding"];
    if (encoding === "gzip") bytes = gunzipSync(bytes, { maxOutputLength: maxBytes });
    else if (encoding === "deflate") bytes = inflateSync(bytes, { maxOutputLength: maxBytes });
    else if (encoding === "br") bytes = brotliDecompressSync(bytes, { maxOutputLength: maxBytes });
    else if (encoding && encoding !== "identity") throw new AppError(422, "MATERIAL_ENCODING_UNSUPPORTED", "Unsupported material encoding.");
    if (bytes.length > maxBytes) throw new AppError(413, "MATERIAL_TOO_LARGE", "The material exceeds the extraction limit.");
    return { bytes, url: url.href, contentType: result.headers["content-type"] ?? "" };
  }
  throw new AppError(422, "MATERIAL_REDIRECT_LIMIT", "The material redirects too many times.");
}
