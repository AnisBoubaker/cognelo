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

it("keeps optional empty bodies bounded without accepting malformed or deeply nested JSON", async () => {
  const request = (body: string) => new Request("http://example.test", { method: "DELETE", body });
  await expect(readBoundedJson(request(" \n"), 100, { allowEmpty: true })).resolves.toEqual({});
  await expect(readBoundedJson(request(" ".repeat(101)), 100, { allowEmpty: true })).rejects.toMatchObject({ status: 413 });
  await expect(readBoundedJson(request("{"), 100, { allowEmpty: true })).rejects.toMatchObject({ code: "INVALID_JSON" });
  await expect(readBoundedJson(request("[".repeat(34) + "0" + "]".repeat(34)), 100, { allowEmpty: true })).rejects.toMatchObject({ code: "REQUEST_TOO_COMPLEX" });
});
