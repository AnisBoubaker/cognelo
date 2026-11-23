import { z } from "zod";
import { assembleCodingBlankSource, codingBlankIds, parseCodingBlankTemplate, type CodingBlankAnswers } from "./code-blanks";

export const codingFileNameSchema = z.string().max(80).regex(/^[A-Za-z][A-Za-z0-9_.-]*$/)
  .refine(name => !["compile", "run", "main", "a.out", "main.exe"].includes(name.toLowerCase()), "This filename is reserved by the execution service.");
export const codingFileIdSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/);
const blankTemplateSchema = z.string().max(40000).refine(value => {
  try { parseCodingBlankTemplate(value); return true; } catch { return false; }
}, "Use unique {{ BLANK:id }} markers.");
export const codingFileSchema = z.object({
  id: codingFileIdSchema, name: codingFileNameSchema,
  starterCode: z.string().max(40000).default(""), blankTemplate: blankTemplateSchema.optional(),
  studentTemplateSource: z.string().max(120000).default("{{ STUDENT_CODE }}")
});
export const codingFilesSchema = z.array(codingFileSchema).min(1).max(20).superRefine((files, ctx) => {
  if (new Set(files.map(file => file.id)).size !== files.length || new Set(files.map(file => file.name.toLowerCase())).size !== files.length) {
    ctx.addIssue({ code: "custom", message: "File identifiers and filenames must be unique." });
  }
  const ids = files.flatMap(file => { try { return codingBlankIds(file.blankTemplate ?? ""); } catch { return []; } });
  if (new Set(ids).size !== ids.length || ids.length > 50) ctx.addIssue({ code: "custom", message: "Use at most 50 uniquely identified blanks across all files." });
  if (files.reduce((size, file) => size + file.starterCode.length + (file.blankTemplate?.length ?? 0) + file.studentTemplateSource.length, 0) > 240000) {
    ctx.addIssue({ code: "custom", message: "The exercise files exceed 240,000 characters." });
  }
});
export const codingSourceFileSchema = z.object({ id: codingFileIdSchema, name: codingFileNameSchema,
  sourceCode: z.string().max(60000), studentTemplateSource: z.string().max(120000).optional(), blankTemplate: blankTemplateSchema.optional() });
export const codingSourceFilesSchema = z.array(codingSourceFileSchema).max(20).refine(files =>
  new Set(files.map(file => file.id)).size === files.length && files.reduce((total, file) => total + file.sourceCode.length, 0) <= 200000,
"Use unique file identifiers and at most 200,000 source characters.");
export const codingFilePrivateSchema = z.object({ referenceSolution: z.string().max(60000).default(""),
  templateSource: z.string().max(120000).default("{{ STUDENT_CODE }}").transform(value => value || "{{ STUDENT_CODE }}"),
  templateVisibleLineNumbers: z.array(z.number().int().min(0).max(5000)).max(5000).default([]) });
export const codingFilePrivateSourcesSchema = z.record(codingFileIdSchema, codingFilePrivateSchema).refine(value => Object.keys(value).length <= 20,
  "Use at most 20 private file records.");
export type CodingFile = z.infer<typeof codingFileSchema>;
export type CodingSourceFile = z.infer<typeof codingSourceFileSchema>;
export type CodingFilePrivate = z.infer<typeof codingFilePrivateSchema>;
export type CodingFilesConfig = { language?: string; responseMode?: string; files?: CodingFile[]; starterCode?: string; blankTemplate?: string; studentTemplateSource?: string };
export type CodingFilesPrivateConfig = { fileSources?: Record<string, CodingFilePrivate>; blankReferenceAnswers?: CodingBlankAnswers;
  templateSource?: string; templateVisibleLineNumbers?: number[] };

const defaultFileNames: Record<string, string> = {
  c: "main.c", cpp: "main.cpp", python: "main.py", python2: "main.py", java: "Main.java", javascript: "main.js", typescript: "main.ts",
  go: "main.go", rust: "main.rs", csharp: "Main.cs", fsharp: "Main.fs", ruby: "main.rb", php: "main.php", bash: "main.sh", lua: "main.lua",
  swift: "main.swift", kotlin: "Main.kt", scala: "Main.scala", haskell: "Main.hs", ocaml: "main.ml", perl: "main.pl", r: "main.r",
  sql: "main.sql", pascal: "main.pas", fortran: "main.f90", cobol: "main.cob", assembly: "main.asm", clojure: "main.clj",
  "common-lisp": "main.lisp", dart: "main.dart", elixir: "main.exs", erlang: "main.erl", prolog: "main.pro", octave: "main.m",
  groovy: "Main.groovy", basic: "main.bas", brainfuck: "main.bf", befunge: "main.bf", ada: "main.adb", awk: "main.awk",
  julia: "main.jl", nim: "main.nim", crystal: "main.cr", tcl: "main.tcl", raku: "main.raku", vala: "main.vala", zig: "main.zig",
  "visual-basic-net": "Main.vb", "python-for-ml": "main.py", v8: "main.js", objectivec: "main.m", vbnet: "Main.vb", d: "main.d", freebasic: "main.bas", racket: "main.rkt", scheme: "main.scm"
};
export function defaultCodingFileName(language: string) { return defaultFileNames[language.trim().toLowerCase()] ?? "main.txt"; }
export function codingFiles(config: CodingFilesConfig): CodingFile[] {
  return config.files?.length ? config.files : [{ id: "main", name: defaultCodingFileName(config.language ?? ""),
    starterCode: config.starterCode ?? "", blankTemplate: config.blankTemplate, studentTemplateSource: config.studentTemplateSource || "{{ STUDENT_CODE }}" }];
}
export function codingFilePrivate(config: CodingFilesPrivateConfig, id: string, referenceSolution = ""): CodingFilePrivate {
  return (config.fileSources && Object.hasOwn(config.fileSources, id) ? config.fileSources[id] : undefined) ?? { referenceSolution, templateSource: config.templateSource || "{{ STUDENT_CODE }}",
    templateVisibleLineNumbers: config.templateVisibleLineNumbers ?? [] };
}
/** A display/inspection snapshot, never executable source. Execution uses the structured files. */
export function formatCodingSourceFiles(files: CodingSourceFile[]) {
  if (files.every(file => !file.sourceCode.trim())) return "";
  return files.length === 1 ? files[0].sourceCode : files.map(file => `===== ${file.name} =====\n${file.sourceCode}`).join("\n\n");
}
export function referenceCodingFiles(config: CodingFilesConfig, privateConfig: CodingFilesPrivateConfig, legacyReference: string): CodingSourceFile[] {
  return codingFiles(config).map((file, index) => ({ id: file.id, name: file.name,
    sourceCode: config.responseMode === "blanks" ? assembleCodingBlankSource(file.blankTemplate ?? "", privateConfig.blankReferenceAnswers ?? {})
      : codingFilePrivate(privateConfig, file.id, index === 0 ? legacyReference : "").referenceSolution,
    ...(config.responseMode === "blanks" ? { blankTemplate: file.blankTemplate ?? "" } : {}) }));
}
export function readCodingSourceFiles(value: unknown): CodingSourceFile[] | null {
  const parsed = codingSourceFilesSchema.safeParse(value);
  return parsed.success && parsed.data.length ? parsed.data : null;
}
export function codingFileBlankTemplate(config: CodingFilesConfig) { return codingFiles(config).map(file => file.blankTemplate ?? "").join("\n"); }
