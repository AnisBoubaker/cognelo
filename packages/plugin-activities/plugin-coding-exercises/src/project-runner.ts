import { zipSync, strToU8 } from "fflate";
import { AppError, readExecutionServiceJson } from "@cognelo/core";
import { codingFileNameSchema } from "./coding-files";

type Runtime = { source_file: string; compile_cmd: string | null; run_cmd: string; name: string };
type ProjectRuntime = { languageId: number; runtime: Runtime };
type SourceFile = { name: string; sourceCode: string };
const runtimeCache = new Map<string, { expires: number; value: ProjectRuntime }>();

/** All archive names and scripts are produced by Cognelo; learners can supply only bounded source text. */
export function buildCodingProjectArchive(files: SourceFile[], runtime: Runtime, syntaxOnly = false) {
  if (!files.length || files.length > 20 || files.reduce((total, file) => total + Buffer.byteLength(file.sourceCode, "utf8"), 0) > 4 * 1024 * 1024) {
    throw new AppError(422, "CODING_EXERCISE_FILES_INVALID", "Use 1–20 source files and at most 4 MiB of assembled source.");
  }
  for (const file of files) codingFileNameSchema.parse(file.name);
  if (new Set(files.map(file => file.name.toLowerCase())).size !== files.length) throw new AppError(422, "CODING_EXERCISE_FILES_INVALID", "Filenames must be unique.");
  const entry = files[0].name;
  const extension = runtime.source_file.slice(runtime.source_file.lastIndexOf(".")).toLowerCase();
  const extensions = /^C\+\+/.test(runtime.name) ? [".cpp", ".cc", ".cxx", ".c"]
    : extension === ".ml" ? [".ml", ".mli"] : extension === ".fs" ? [".fs", ".fsi"]
    : /^Fortran/.test(runtime.name) ? [".f", ".for", ".f90", ".f95", ".f03", ".f08"] : [extension];
  const sources = files.filter((file, index) => index === 0 || (!runtime.name.startsWith("Rust") && extensions.some(suffix => file.name.toLowerCase().endsWith(suffix))));
  if (/^(F#|OCaml|Fortran)/.test(runtime.name) && sources.length > 1) sources.push(sources.shift()!);
  let compile = runtime.compile_cmd?.replace(/%s/g, "").replaceAll(runtime.source_file, sources.map(file => quote(file.name)).join(" ")) ?? "";
  let run = runtime.run_cmd.replaceAll(runtime.source_file, quote(entry));
  if (/^C#.*Mono/.test(runtime.name) && !/[-/]out[:=]/i.test(compile)) {
    compile += " -out:__cognelo_program.exe";
    run = run.replaceAll(runtime.source_file.replace(/\.cs$/i, ".exe"), quote("__cognelo_program.exe"));
  }
  if (/^Java\s*\(/.test(runtime.name)) run = run.replace(/\bMain\b/g, quote(entry.replace(/\.java$/i, "")));
  if (/^(Go|Rust)\s*\(/.test(runtime.name) && !/\s-o(?:\s|=)/.test(compile)) {
    if (runtime.name.startsWith("Go")) compile = compile.replace(/(\s)build(?=\s)/, "$1build -o __cognelo_program");
    else compile += " -o __cognelo_program";
    run = "./__cognelo_program";
  }
  if (/^TypeScript\s*\(/.test(runtime.name)) run = run.replaceAll(runtime.source_file.replace(/\.ts$/, ".js"), quote(entry.replace(/\.ts$/, ".js")));
  if (/^Python\s*\(/.test(runtime.name)) {
    const interpreter = runtime.run_cmd.replace(runtime.source_file, "").trim();
    const check = `for name in ${JSON.stringify(sources.map(file => file.name))}:\n    compile(open(name, 'rb').read(), name, 'exec')`;
    compile = `${interpreter} ${/^Python \(3/.test(runtime.name) ? "-I -S" : "-E -S"} -c ${quote(check)}`;
  }
  const archive: Record<string, Uint8Array> = Object.fromEntries(files.map(file => [file.name, strToU8(file.sourceCode)]));
  if (compile) archive.compile = strToU8(`#!/bin/bash\nset -eu\n${compile}\n`);
  archive.run = strToU8(`#!/bin/bash\nset -eu\n${syntaxOnly ? "printf 'COGNELO_SYNTAX_OK\\n'" : run}\n`);
  if (Object.values(archive).reduce((total, value) => total + value.length, 0) > 4 * 1024 * 1024) throw new AppError(422, "CODING_EXERCISE_PROJECT_TOO_LARGE", "The assembled project exceeds 4 MiB.");
  return Buffer.from(zipSync(archive, { level: 0 })).toString("base64");
}

export async function codingProjectRuntime(runner: { baseUrl: string; headers: Record<string, string> }, languageId: number): Promise<ProjectRuntime> {
  const key = `${runner.baseUrl}:${languageId}`;
  const cached = runtimeCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const get = async (path: string) => readExecutionServiceJson(await fetch(`${runner.baseUrl}${path}`, {
    headers: runner.headers, redirect: "error", signal: AbortSignal.timeout(10000)
  }));
  const [languages, detail, settings] = await Promise.all([get("/languages"), get(`/languages/${languageId}`), get("/config_info")]);
  const project = Array.isArray(languages) ? languages.find(item => item?.name === "Multi-file program") : null;
  if (!project || !Number.isInteger(project.id) || !settings || (settings as Record<string, unknown>).enable_additional_files !== true) {
    throw new AppError(503, "CODING_EXERCISE_PROJECT_RUNNER_REQUIRED", "Configure the execution runner for multi-file programs and server-built project archives.");
  }
  const runtime = detail as Runtime;
  if (!runtime || typeof runtime.source_file !== "string" || !runtime.source_file || runtime.source_file.length > 200 || typeof runtime.run_cmd !== "string" || runtime.run_cmd.length > 20000 || typeof runtime.name !== "string"
    || (runtime.compile_cmd !== null && (typeof runtime.compile_cmd !== "string" || runtime.compile_cmd.length > 20000))) {
    throw new AppError(502, "CODING_EXERCISE_PROJECT_RUNTIME_INVALID", "The execution runner returned an invalid language configuration.");
  }
  const value = { languageId: project.id, runtime };
  if (runtimeCache.size >= 32) runtimeCache.clear();
  runtimeCache.set(key, { expires: Date.now() + 60000, value });
  return value;
}
function quote(value: string) { return "'" + value.replaceAll("'", "'\\''") + "'"; }
