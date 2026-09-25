import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@cognelo/config", () => ({
  getServerEnv: () => ({
    JUDGE0_BASE_URL: "https://judge0.test",
    JUDGE0_AUTH_HEADER: "X-Auth",
    JUDGE0_AUTH_TOKEN: "token"
  })
}));

const { getCodingExerciseProgrammingLanguages, listJudge0Languages, resolveJudge0Language, runJudge0Submission } = await import("./judge0");

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

  it("exposes every Judge0 programming language as a stable unique choice", () => {
    expect(getCodingExerciseProgrammingLanguages([
      { id: 48, name: "C (GCC 7.4.0)" },
      { id: 50, name: "C (GCC 9.2.0)" },
      { id: 46, name: "Bash (5.0.0)" },
      { id: 70, name: "Python (2.7.17)" },
      { id: 71, name: "Python (3.8.1)" },
      { id: 43, name: "Plain Text" },
      { id: 89, name: "Multi-file program" }
    ])).toEqual([
      { key: "bash", label: "Bash" },
      { key: "c", label: "C" },
      { key: "python2", label: "Python 2" },
      { key: "python", label: "Python 3" }
    ]);
  });

  it("resolves dynamically discovered languages and requires an explicit choice", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json([{ id: 46, name: "Bash (5.0.0)" }])
    );
    await expect(resolveJudge0Language("bash")).resolves.toEqual({
      languageKey: "bash",
      languageId: 46,
      languageName: "Bash (5.0.0)"
    });
    await expect(resolveJudge0Language("")).rejects.toMatchObject({
      status: 409,
      code: "CODING_EXERCISE_LANGUAGE_REQUIRED"
    });
  });

  it("base64-encodes submission text and decodes Unicode result text", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        token: "submission-1",
        stdout: Buffer.from("allô élève\n", "utf8").toString("base64"),
        stderr: Buffer.from("avertissement : déjà défini", "utf8").toString("base64"),
        compile_output: null,
        message: Buffer.from("terminé", "utf8").toString("base64")
      })
    );

    await expect(
      runJudge0Submission({
        languageId: 71,
        sourceCode: 'print("allô élève")',
        stdin: "Montréal",
        expectedOutput: "allô élève"
      })
    ).resolves.toMatchObject({
      token: "submission-1",
      stdout: "allô élève\n",
      stderr: "avertissement : déjà défini",
      compile_output: null,
      message: "terminé"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://judge0.test/submissions?base64_encoded=true&wait=true",
      expect.objectContaining({
        body: JSON.stringify({
          language_id: 71,
          source_code: Buffer.from('print("allô élève")', "utf8").toString("base64"),
          stdin: Buffer.from("Montréal", "utf8").toString("base64"),
          expected_output: Buffer.from("allô élève", "utf8").toString("base64")
        })
      })
    );
  });

  it("surfaces non-2xx submission failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("down", { status: 503 }));

    await expect(runJudge0Submission({ languageId: 71, sourceCode: "print('ok')" })).rejects.toThrow("Judge0 request failed");
  });

  it("surfaces Judge0 internal errors as service failures instead of grading results", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        token: "submission-internal-error",
        message: Buffer.from("No such file or directory @ rb_sysopen - /box/main.c", "utf8").toString("base64"),
        status: { id: 13, description: "Internal Error" }
      })
    );

    await expect(runJudge0Submission({ languageId: 50, sourceCode: "int main(void) { return 0; }" })).rejects.toMatchObject({
      status: 503,
      code: "JUDGE0_INTERNAL_ERROR"
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Judge0 returned an internal sandbox error.",
      expect.objectContaining({
        token: "submission-internal-error",
        status: "Internal Error",
        message: "No such file or directory @ rb_sysopen - /box/main.c"
      })
    );
  });
});
