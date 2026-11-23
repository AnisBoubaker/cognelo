import { afterEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildCodingProjectArchive, codingProjectRuntime } from "./project-runner";
const decode = (value: string) => Object.fromEntries(Object.entries(unzipSync(Buffer.from(value, "base64"))).map(([name, bytes]) => [name, strFromU8(bytes)]));
const c = { name: "C (GCC 13.2.0)", source_file: "main.c", compile_cmd: "/gcc %s main.c -lm -pthread", run_cmd: "./a.out" };
afterEach(() => vi.unstubAllGlobals());
describe("server-built sandbox projects", () => {
  it("compiles separate C translation units, retains headers and libraries, and builds only trusted wrapper files", () => {
    const archive = decode(buildCodingProjectArchive([{ name: "entry.c", sourceCode: "ENTRY" }, { name: "helper.c", sourceCode: "HELPER" }, { name: "helper.h", sourceCode: "HEADER" }], c));
    expect(Object.keys(archive).sort()).toEqual(["compile", "entry.c", "helper.c", "helper.h", "run"]);
    expect(archive.compile).toContain("/gcc  'entry.c' 'helper.c' -lm -pthread");
    expect(archive.compile).not.toContain("'helper.h'");
    expect(archive.run).toContain("./a.out");
    expect(archive["helper.h"]).toBe("HEADER");
  });
  it("rejects any filename that could replace wrappers or escape the sandbox archive", () => {
    for (const name of ["compile", "run", "../main.c", "main.c;echo"]) expect(() => buildCodingProjectArchive([{ name, sourceCode: "data" }], c)).toThrow();
  });
  it("syntax-checks Python files with isolated startup, without running the learner program", () => {
    const archive = decode(buildCodingProjectArchive([{ name: "main.py", sourceCode: "raise RuntimeError('must not execute')" }, { name: "helper.py", sourceCode: "print('private')" }],
      { name: "Python (3.12.7)", source_file: "script.py", compile_cmd: null, run_cmd: "/python3 script.py" }, true));
    expect(archive.compile).toContain("-I -S -c");
    expect(archive.compile).toContain("compile(open(name");
    expect(archive.run).toContain("COGNELO_SYNTAX_OK");
    expect(archive.run).not.toContain("main.py");
  });
  it("keeps the Go cache environment intact when choosing a stable output filename", () => {
    const archive = decode(buildCodingProjectArchive([{ name: "entry.go", sourceCode: "package main" }, { name: "helper.go", sourceCode: "package main" }],
      { name: "Go (1.22.7)", source_file: "main.go", compile_cmd: "GOCACHE=/tmp/go-build /go/bin/go build -p 1 %s main.go", run_cmd: "./main" }));
    expect(archive.compile).toContain("GOCACHE=/tmp/go-build /go/bin/go build -o __cognelo_program");
    expect(archive.compile).toContain("'entry.go' 'helper.go'");
  });
  it("keeps renamed C# entry outputs aligned with its runner command", () => {
    const archive = decode(buildCodingProjectArchive([{ name: "Main.cs", sourceCode: "class Program{}" }, { name: "Helper.cs", sourceCode: "class Helper{}" }],
      { name: "C# (Mono 6.6)", source_file: "main.cs", compile_cmd: "mcs %s main.cs", run_cmd: "mono main.exe" }));
    expect(archive.compile).toContain("-out:__cognelo_program.exe");
    expect(archive.run).toContain("mono '__cognelo_program.exe'");
  });
  it("lets Rust discover modules instead of compiling them as multiple entry points", () => {
    const archive = decode(buildCodingProjectArchive([{ name: "main.rs", sourceCode: "mod helper;" }, { name: "helper.rs", sourceCode: "pub fn x() {}" }],
      { name: "Rust (1.81.0)", source_file: "main.rs", compile_cmd: "/rustc %s main.rs", run_cmd: "./main" }));
    expect(archive.compile).not.toContain("'helper.rs'");
    expect(archive.compile).toContain("-o __cognelo_program");
  });
  it("fails before submitting when the runner disallows project archives", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.endsWith("/languages") ? [{ id: 89, name: "Multi-file program" }]
      : url.endsWith("/config_info") ? { enable_additional_files: false } : c)));
    await expect(codingProjectRuntime({ baseUrl: "https://disabled-runner.example", headers: {} }, 50)).rejects.toMatchObject({ code: "CODING_EXERCISE_PROJECT_RUNNER_REQUIRED" });
  });
});
