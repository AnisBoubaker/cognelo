import { setTimeout as pause } from "node:timers/promises";
import { AppError } from "./errors";
import { readBoundedJson } from "./request-body";
import type { ResolvedExecutionRunner } from "./execution-runners";

export async function readExecutionServiceJson(response: Response, maximum = 8 * 1024 * 1024): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new AppError(502, "EXECUTION_SERVICE_HTTP_ERROR", `The execution service returned HTTP ${response.status}.`);
  }
  try { return await readBoundedJson(response, maximum); }
  catch { throw new AppError(502, "EXECUTION_SERVICE_INVALID_RESPONSE", "The execution service returned an invalid or oversized response."); }
}

export type Judge0JobResponse = { token?: string; status?: { id: number; description?: string }; [key: string]: unknown };

/** Queue work on the sandbox worker; the API process needs no execution privileges. */
export async function runJudge0Job(
  runner: Pick<ResolvedExecutionRunner, "baseUrl" | "headers">,
  payload: Record<string, unknown>,
  options: { fetch?: typeof fetch; timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<Judge0JobResponse> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? 90_000);
  const send = options.fetch ?? fetch;
  const request = async (url: string, init: RequestInit = {}) => {
    const body = await readExecutionServiceJson(await send(url, { ...init, headers: { "Content-Type": "application/json", ...runner.headers }, redirect: "error", signal }));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw invalidResponse();
    return body as Judge0JobResponse;
  };
  try {
    const created = await request(`${runner.baseUrl}/submissions?base64_encoded=true&wait=false`, { method: "POST", body: JSON.stringify(payload) });
    // Compatible services may already return a terminal result.
    if (terminal(created)) return created;
    if (typeof created.token !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(created.token)) throw invalidResponse();
    const url = `${runner.baseUrl}/submissions/${encodeURIComponent(created.token)}?base64_encoded=true`;
    for (;;) {
      const result = await request(url);
      if (terminal(result)) return result;
      if (result.status?.id !== 1 && result.status?.id !== 2) throw invalidResponse();
      await pause(options.pollIntervalMs ?? 250, undefined, { signal });
    }
  } catch (error) {
    if (signal.aborted) throw new AppError(504, "EXECUTION_SERVICE_TIMEOUT", "The execution service did not finish within its deadline.");
    if (error instanceof AppError) throw error;
    throw new AppError(502, "EXECUTION_SERVICE_UNAVAILABLE", "The execution service could not complete the request.");
  }
}
function terminal(result: Judge0JobResponse) {
  return Number.isInteger(result.status?.id) && result.status!.id >= 3 && result.status!.id <= 14;
}
function invalidResponse() { return new AppError(502, "EXECUTION_SERVICE_INVALID_RESPONSE", "The execution service returned an invalid response."); }
