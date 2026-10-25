import { AppError } from "./errors";

export const MAX_JSON_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_JSON_BYTES = 36 * 1024 * 1024;
export const MAX_MULTIPART_BYTES = 26 * 1024 * 1024;
const bodyState = globalThis as typeof globalThis & { cogneloLargeBodyReads?: { active: number } };
const largeReads = bodyState.cogneloLargeBodyReads ??= { active: 0 };

export async function readBoundedBody(request: Request, maximum: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new AppError(413, "REQUEST_TOO_LARGE", "The request exceeds the size limit.");
  if (!request.body) return new Uint8Array();
  const large = maximum > MAX_JSON_BYTES && (!declared || Number(declared) > MAX_JSON_BYTES);
  if (large && largeReads.active >= 4) throw new AppError(429, "UPLOAD_CAPACITY_REACHED", "Uploads are busy. Try again shortly.", { retryAfterSeconds: 2 });
  const reader = request.body.getReader();
  if (large) largeReads.active++;
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => {
    void reader.cancel(); reject(new AppError(408, "REQUEST_TIMEOUT", "The request took too long to upload."));
  }, 60_000); });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new AppError(413, "REQUEST_TOO_LARGE", "The request exceeds the size limit.");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } finally { if (large) largeReads.active--; clearTimeout(timer); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** Bound validation work before schemas can produce one error per nested value. */
export function assertJsonComplexity(value: unknown) {
  const pending = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (++nodes > 20_000 || current.depth > 32) throw new AppError(413, "REQUEST_TOO_COMPLEX", "The request contains too much nested data.");
    if (current.value && typeof current.value === "object") {
      const children = Object.values(current.value);
      if (children.length > 2_000) throw new AppError(413, "REQUEST_TOO_COMPLEX", "A request collection exceeds its limit.");
      for (const child of children) pending.push({ value: child, depth: current.depth + 1 });
    }
  }
}

export async function readBoundedJson(request: Request, maximum = MAX_JSON_BYTES): Promise<unknown> {
  const bytes = await readBoundedBody(request, maximum);
  let result: unknown;
  try { result = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new AppError(400, "INVALID_JSON", "A valid JSON request body is required."); }
  assertJsonComplexity(result);
  return result;
}

export async function readBoundedFormData(request: Request, maximum = MAX_MULTIPART_BYTES) {
  const bytes = await readBoundedBody(request, maximum);
  try { return await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { throw new AppError(400, "INVALID_FORM_DATA", "A valid upload form is required."); }
}
