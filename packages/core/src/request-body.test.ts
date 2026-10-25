import { expect, it } from "vitest";
import { assertJsonComplexity, readBoundedBody, readBoundedJson } from "./request-body";

it("rejects declared and chunked oversized bodies before parsing", async () => {
  await expect(readBoundedBody(new Request("http://example.test", { method: "POST", body: "small", headers: { "content-length": "100" } }), 10)).rejects.toMatchObject({ status: 413 });
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(6)); controller.enqueue(new Uint8Array(6)); }, cancel() { cancelled = true; } });
  const request = new Request("http://example.test", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await expect(readBoundedBody(request, 10)).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true);
});

it("rejects invalid JSON and bounds depth and collection validation work", async () => {
  await expect(readBoundedJson(new Request("http://example.test", { method: "POST", body: "bad" }))).rejects.toMatchObject({ code: "INVALID_JSON" });
  expect(() => assertJsonComplexity(Array(2001).fill({}))).toThrow();
  let nested: unknown = {};
  for (let i = 0; i < 34; i++) nested = { child: nested };
  expect(() => assertJsonComplexity(nested)).toThrow();
  expect(() => assertJsonComplexity({ source: "legitimate source", files: [1, 2] })).not.toThrow();
});
