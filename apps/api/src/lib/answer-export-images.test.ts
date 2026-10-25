import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { once } from "node:events";
import { createServer, get as nativeGet, type IncomingMessage, type RequestOptions } from "node:http";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), get: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", async (original) => {
  const httpModule = await original<typeof import("node:http")>();
  return { ...httpModule, default: { ...httpModule, get: mocks.get } };
});
import { fetchPublicExportImage } from "./answer-export-images";
const server = createServer((request, response) => {
  if (request.url === "/redirect") { response.writeHead(302, { Location: "http://[" }); response.end(); }
  else { response.writeHead(200, { "Content-Type": "image/png" }); response.end("1234567890"); }
});
let origin: string;
beforeAll(async () => {
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No test port");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
beforeEach(() => {
  mocks.lookup.mockReset().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  mocks.get.mockReset().mockImplementation((url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) =>
    nativeGet(new URL(url.pathname, origin), { ...options, lookup: undefined }, callback));
});

it("counts actual response bytes across fetches and stops when the shared allowance is exceeded", async () => {
  const budget = { remainingBytes: 15, deadline: Date.now() + 5000 };
  expect((await fetchPublicExportImage("http://public.example/bytes", budget)).bytes.length).toBe(10);
  expect(budget.remainingBytes).toBe(5);
  await expect(fetchPublicExportImage("http://public.example/bytes", budget)).rejects.toThrow(/budget/);
  expect(budget.remainingBytes).toBe(0);
  await expect(fetchPublicExportImage("http://public.example/bytes", budget)).rejects.toThrow(/budget/);
  expect(mocks.get).toHaveBeenCalledTimes(2);
});
it("rejects malformed redirects through the promise instead of throwing from a socket callback", async () => {
  await expect(fetchPublicExportImage("http://public.example/redirect")).rejects.toThrow("Invalid image redirect");
});
it("includes pending DNS in the shared deadline", async () => {
  mocks.lookup.mockImplementation(() => new Promise(() => {}));
  await expect(fetchPublicExportImage("http://public.example/bytes", { remainingBytes: 10, deadline: Date.now() + 25 })).rejects.toThrow(/timed out/);
  expect(mocks.get).not.toHaveBeenCalled();
});
