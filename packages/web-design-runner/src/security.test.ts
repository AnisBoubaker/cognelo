import { createServer } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let child: ChildProcess;
let networkRequests = 0;
let probeUrl: string;
const probe = createServer((_request, response) => { networkRequests++; response.setHeader("Access-Control-Allow-Origin", "*"); response.end("reachable"); });
let base: string;
const token = randomBytes(32).toString("hex");
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const files = [{ path: "index.html", language: "html", starterCode: "<h1>Hello</h1>" }];

beforeAll(async () => {
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("Probe did not bind");
  probeUrl = `http://127.0.0.1:${address.port}/`;
  child = spawn(process.execPath, ["--import", "tsx", "packages/web-design-runner/src/index.ts"], {
    env: { PATH: process.env.PATH, PORT: "0", WEB_DESIGN_RUNNER_TOKEN: token,
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Runner startup timeout")), 15_000);
    child.once("exit", () => { clearTimeout(timer); reject(new Error("Runner exited during startup")); });
    child.stderr?.on("data", () => undefined);
    child.stdout?.on("data", (chunk) => {
      const match = String(chunk).match(/listening on (\d+)/);
      if (match) { clearTimeout(timer); base = `http://127.0.0.1:${match[1]}`; resolve(); }
    });
  });
}, 20_000);
afterAll(async () => { probe.close(); if (child && child.exitCode === null) { child.kill(); await once(child, "exit"); } });

describe("runner trust boundary", () => {
  it("authenticates all endpoints before parsing a body", async () => {
    for (const path of ["/health", "/run", "/screenshot"]) {
      for (const authorization of ["", "Bearer invalid"]) {
        const response = await fetch(base + path, { method: path === "/health" ? "GET" : "POST", headers: { Authorization: authorization }, ...(path === "/health" ? {} : { body: "invalid json" }) });
        expect(response.status).toBe(401);
      }
    }
    expect((await fetch(base + "/health", { headers })).status).toBe(200);
  });
  it("runs supported checks, confines callbacks to Chromium and rejects Node access and unbounded syntax", async () => {
    const response = await fetch(base + "/run", { method: "POST", headers, body: JSON.stringify({ files, timeoutMs: 2000, tests: [
      { id: "ok", name: "Supported check", testCode: 'await expect(page.locator("h1")).toHaveText("Hello"); const node = await page.evaluate(() => typeof process); expect(node).toBe("undefined");' },
      { id: "node", name: "Node rejected", testCode: 'const value = process.env; expect(value).toBeDefined();' },
      { id: "constructor", name: "Constructor rejected", testCode: 'const value = page.constructor; expect(value).toBeDefined();' },
      { id: "loop", name: "Loop rejected", testCode: 'while (true) {}' },
      { id: "network", name: "Network blocked", testCode: `const blocked = await page.evaluate(async () => { try { await fetch(${JSON.stringify(probeUrl)}); return false; } catch { return true; } }); expect(blocked).toBe(true);` }
    ] }) });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.tests.map((test: { status: string }) => test.status)).toEqual(["completed", "failed", "failed", "failed", "completed"]);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(networkRequests).toBe(0);
  }, 25_000);
  it("still produces a cropped PNG", async () => {
    const response = await fetch(base + "/screenshot", { method: "POST", headers, body: JSON.stringify({ files, trimWhitespace: true, viewport: { width: 320, height: 240 } }) });
    expect(response.status).toBe(200);
    expect((await response.json()).imageDataUrl).toMatch(/^data:image\/png;base64,/);
  }, 20_000);
});
