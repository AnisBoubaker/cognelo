import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@cognelo/config", () => ({
  getServerEnv: () => ({ WEB_DESIGN_RUNNER_URL: "http://runner.test" })
}));

const { captureWebDesignScreenshotInRunner, runWebDesignTestsInRunner } = await import("./runner");

const files = [{ id: "index", path: "index.html", language: "html" as const, starterCode: "<main></main>", isEditable: true, orderIndex: 0 }];

describe("web design runner client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses runner success responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        status: "completed",
        score: 1,
        maxScore: 1,
        durationMs: 20,
        tests: [{ id: "t1", name: "Test", status: "completed", weight: 1, score: 1, details: {} }]
      })
    );

    await expect(
      runWebDesignTestsInRunner({
        files,
        tests: [{ id: "t1", name: "Test", testCode: "await expect(page).toBeTruthy()", weight: 1 }]
      })
    ).resolves.toMatchObject({ status: "completed", score: 1 });
  });

  it("maps non-2xx and malformed runner responses to AppError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ error: { message: "boom" } }, { status: 500 }));

    await expect(runWebDesignTestsInRunner({ files, tests: [] })).rejects.toMatchObject({
      status: 502,
      code: "WEB_DESIGN_RUNNER_FAILED"
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ status: "weird" }));

    await expect(runWebDesignTestsInRunner({ files, tests: [] })).rejects.toMatchObject({
      status: 502,
      code: "WEB_DESIGN_RUNNER_FAILED"
    });
  });

  it("captures screenshots and maps network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        imageDataUrl: "data:image/png;base64,abc",
        durationMs: 12,
        viewport: { width: 1024, height: 768 }
      })
    );

    await expect(captureWebDesignScreenshotInRunner({ files })).resolves.toMatchObject({
      imageDataUrl: "data:image/png;base64,abc"
    });

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));

    await expect(captureWebDesignScreenshotInRunner({ files })).rejects.toMatchObject({
      status: 502,
      code: "WEB_DESIGN_SCREENSHOT_FAILED"
    });
  });
});
