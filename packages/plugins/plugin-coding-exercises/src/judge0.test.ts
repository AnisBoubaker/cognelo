import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@cognelo/config", () => ({
  getServerEnv: () => ({
    JUDGE0_BASE_URL: "https://judge0.test",
    JUDGE0_AUTH_HEADER: "X-Auth",
    JUDGE0_AUTH_TOKEN: "token"
  })
}));

const { listJudge0Languages, resolveJudge0Language, runJudge0Submission } = await import("./judge0");

describe("Judge0 client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists and resolves configured runtime languages", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json([{ id: 71, name: "Python (3.8.1)" }])
    );

    await expect(listJudge0Languages()).resolves.toEqual([{ id: 71, name: "Python (3.8.1)" }]);
    expect(fetchMock).toHaveBeenCalledWith("https://judge0.test/languages", { headers: { "X-Auth": "token" } });

    fetchMock.mockResolvedValueOnce(Response.json([{ id: 71, name: "Python (3.8.1)" }]));
    await expect(resolveJudge0Language("python")).resolves.toMatchObject({
      languageKey: "python",
      languageId: 71,
      languageName: "Python (3.8.1)"
    });
  });

  it("reports unavailable languages and API failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json([]));

    await expect(resolveJudge0Language("python")).rejects.toMatchObject({
      status: 503,
      code: "JUDGE0_LANGUAGE_NOT_AVAILABLE"
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("bad", { status: 500 }));
    await expect(listJudge0Languages()).rejects.toThrow("Judge0 languages request failed");
  });

  it("runs submissions and surfaces non-2xx submission failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ token: "submission-1", stdout: "ok" }));

    await expect(runJudge0Submission({ languageId: 71, sourceCode: "print('ok')" })).resolves.toMatchObject({
      token: "submission-1",
      stdout: "ok"
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("down", { status: 503 }));
    await expect(runJudge0Submission({ languageId: 71, sourceCode: "print('ok')" })).rejects.toThrow("Judge0 request failed");
  });
});
