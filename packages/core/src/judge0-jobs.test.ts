import { expect, it, vi } from "vitest";
import { readExecutionServiceJson, runJudge0Job } from "./judge0-jobs";
const runner = { baseUrl: "https://runner.example.test", headers: { "X-Auth-Token": "synthetic" } };
it("queues sandbox work and polls without following redirects or using synchronous execution", async () => {
  const send = vi.fn().mockResolvedValueOnce(Response.json({ token: "job-1" }))
    .mockResolvedValueOnce(Response.json({ token: "job-1", status: { id: 2 } }))
    .mockResolvedValueOnce(Response.json({ token: "job-1", status: { id: 3 } }));
  await expect(runJudge0Job(runner, { source_code: "synthetic" }, { fetch: send, pollIntervalMs: 1 })).resolves.toMatchObject({ status: { id: 3 } });
  expect(send.mock.calls[0][0]).toBe(`${runner.baseUrl}/submissions?base64_encoded=true&wait=false`);
  expect(send.mock.calls[1][0]).toBe(`${runner.baseUrl}/submissions/job-1?base64_encoded=true`);
  for (const [, options] of send.mock.calls) expect(options).toMatchObject({ redirect: "error", headers: runner.headers, signal: expect.any(AbortSignal) });
});
it("rejects path-like tokens and invalid status responses", async () => {
  const send = vi.fn().mockResolvedValue(Response.json({ token: "../outside" }));
  await expect(runJudge0Job(runner, {}, { fetch: send })).rejects.toMatchObject({ code: "EXECUTION_SERVICE_INVALID_RESPONSE" });
  expect(send).toHaveBeenCalledTimes(1);
});
it("bounds polling with a single deadline", async () => {
  const send = vi.fn().mockImplementation(async () => Response.json({ token: "job-1", status: { id: 2 } }));
  await expect(runJudge0Job(runner, {}, { fetch: send, timeoutMs: 20, pollIntervalMs: 100 })).rejects.toMatchObject({ code: "EXECUTION_SERVICE_TIMEOUT" });
});
it("bounds response streams and never returns a provider error body", async () => {
  await expect(readExecutionServiceJson(new Response("private token", { status: 500 }))).rejects.toMatchObject({ code: "EXECUTION_SERVICE_HTTP_ERROR", message: "The execution service returned HTTP 500." });
  await expect(readExecutionServiceJson(new Response('"' + "x".repeat(100) + '"'), 50)).rejects.toMatchObject({ code: "EXECUTION_SERVICE_INVALID_RESPONSE" });
});
